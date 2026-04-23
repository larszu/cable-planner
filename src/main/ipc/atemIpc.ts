import { ipcMain, BrowserWindow } from 'electron'
import { Atem, AtemConnectionStatus } from 'atem-connection'

/**
 * Singleton ATEM session. Only one device at a time is supported - matches the
 * usage pattern (open dialog, push, close) and avoids leaking UDP sockets.
 *
 * Protocol implementation comes from the `atem-connection` package, which
 * implements the same packet format documented by the LibAtem project
 * (peschuster) and SuperFlyTV's reverse-engineering work.
 */
let atem: Atem | null = null
let connectedIp: string | null = null

const events: string[] = []
const pushEvent = (line: string) => {
  events.push(`[${new Date().toISOString()}] ${line}`)
  if (events.length > 200) events.splice(0, events.length - 200)
  // Forward to all renderer windows for live status updates.
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('atem:event', line)
  }
}

const ensureDisconnected = async () => {
  if (atem) {
    try {
      await atem.disconnect()
    } catch {
      /* ignore */
    }
    atem = null
    connectedIp = null
  }
}

const summarizeState = () => {
  if (!atem || !atem.state) return null
  const state = atem.state
  const inputs = Object.entries(state.inputs ?? {}).map(([id, input]) => ({
    inputId: Number(id),
    longName: input?.longName ?? '',
    shortName: input?.shortName ?? '',
    portType: input?.internalPortType,
    sourceAvailability: input?.sourceAvailability,
  }))

  // Helper: look up a source's label from the inputs dictionary. ATEM stores
  // ME outputs, aux outputs, media players, supersources etc. in the same
  // `inputs` map keyed by their source id, so the same lookup works for any
  // multiviewer window content.
  const resolveSource = (sourceId: number) => {
    const src = state.inputs?.[sourceId]
    return {
      sourceId,
      longName: src?.longName ?? `Src ${sourceId}`,
      shortName: src?.shortName ?? '',
      portType: src?.internalPortType,
    }
  }

  const multiViewers = (state.settings?.multiViewers ?? []).map((mv, index) => {
    if (!mv) return null
    return {
      index,
      layout: mv.properties?.layout ?? 0,
      programPreviewSwapped: mv.properties?.programPreviewSwapped ?? false,
      windows: mv.windows.map((window, windowIndex) => {
        if (!window) return { windowIndex, ...resolveSource(0) }
        return {
          windowIndex,
          ...resolveSource(window.source),
          safeTitle: window.safeTitle ?? false,
          audioMeter: window.audioMeter ?? false,
        }
      }),
    }
  })

  return {
    productIdentifier: state.info?.productIdentifier ?? '',
    model: state.info?.model,
    apiVersion: state.info?.apiVersion,
    mixEffects: Array.isArray(state.info?.mixEffects) ? state.info.mixEffects.length : undefined,
    auxiliaries: state.info?.capabilities?.auxilliaries,
    inputs,
    multiViewers,
  }
}

export const registerAtemIpc = () => {
  ipcMain.handle('atem:connect', async (_event, ip: string) => {
    await ensureDisconnected()
    if (!ip || typeof ip !== 'string') {
      throw new Error('ATEM IP address is required.')
    }
    atem = new Atem()
    connectedIp = ip

    atem.on('connected', () => pushEvent(`Connected to ATEM at ${ip}`))
    atem.on('disconnected', () => pushEvent(`Disconnected from ATEM at ${ip}`))
    atem.on('error', (msg: string) => pushEvent(`ATEM error: ${msg}`))
    atem.on('info', (msg: string) => pushEvent(`ATEM: ${msg}`))

    try {
      await atem.connect(ip)
    } catch (err) {
      await ensureDisconnected()
      throw new Error(
        `Could not connect to ATEM at ${ip}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    // Wait briefly for initial state sync (the lib emits 'connected' once
    // the initial protocol handshake completes).
    const start = Date.now()
    while (
      atem &&
      atem.status !== AtemConnectionStatus.CONNECTED &&
      Date.now() - start < 5000
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    if (!atem || atem.status !== AtemConnectionStatus.CONNECTED) {
      await ensureDisconnected()
      throw new Error(`ATEM at ${ip} did not finish handshake within 5s.`)
    }

    return { ip, summary: summarizeState() }
  })

  ipcMain.handle('atem:disconnect', async () => {
    await ensureDisconnected()
    return { ok: true }
  })

  ipcMain.handle('atem:state', async () => {
    if (!atem || atem.status !== AtemConnectionStatus.CONNECTED) {
      return null
    }
    return summarizeState()
  })

  ipcMain.handle(
    'atem:set-input-name',
    async (
      _event,
      payload: { inputId: number; longName: string; shortName: string },
    ) => {
      if (!atem || atem.status !== AtemConnectionStatus.CONNECTED) {
        throw new Error('Not connected to an ATEM. Connect first.')
      }
      const { inputId, longName, shortName } = payload
      // setInputSettings is the documented LibAtem command (InCm) — it sets
      // the long (max 20 chars) and short (max 4 chars) input labels.
      await atem.setInputSettings({ longName, shortName }, inputId)
      pushEvent(`Renamed input ${inputId} → "${longName}" / "${shortName}"`)
      return { ok: true }
    },
  )

  ipcMain.handle(
    'atem:bulk-set-input-names',
    async (
      _event,
      payload: { entries: { inputId: number; longName: string; shortName: string }[] },
    ) => {
      if (!atem || atem.status !== AtemConnectionStatus.CONNECTED) {
        throw new Error('Not connected to an ATEM. Connect first.')
      }
      let count = 0
      for (const entry of payload.entries) {
        if (!entry.longName && !entry.shortName) continue
        await atem.setInputSettings(
          {
            longName: entry.longName.slice(0, 20),
            shortName: entry.shortName.slice(0, 4),
          },
          entry.inputId,
        )
        count += 1
      }
      pushEvent(`Bulk-renamed ${count} inputs`)
      return { count }
    },
  )

  ipcMain.handle('atem:get-events', async () => events.slice(-100))

  ipcMain.handle('atem:get-status', async () => ({
    connected: !!atem && atem.status === AtemConnectionStatus.CONNECTED,
    ip: connectedIp,
  }))

  ipcMain.handle(
    'atem:apply-mv-config',
    async (
      _event,
      config: {
        multiViewers: {
          index: number
          layout: number
          programPreviewSwapped?: boolean
          windows: { windowIndex: number; sourceId: number }[]
        }[]
      },
    ) => {
      if (!atem || atem.status !== AtemConnectionStatus.CONNECTED) {
        throw new Error('ATEM not connected')
      }
      let applied = 0
      for (const mv of config.multiViewers) {
        try {
          await atem.setMultiViewerProperties(
            {
              layout: mv.layout,
              programPreviewSwapped: mv.programPreviewSwapped ?? false,
            },
            mv.index,
          )
        } catch (err) {
          pushEvent(`MV ${mv.index} properties failed: ${(err as Error).message}`)
        }
        for (const win of mv.windows) {
          try {
            await atem.setMultiViewerWindowSource(win.sourceId, mv.index, win.windowIndex)
            applied++
          } catch (err) {
            pushEvent(
              `MV ${mv.index} window ${win.windowIndex} source ${win.sourceId} failed: ${(err as Error).message}`,
            )
          }
        }
      }
      pushEvent(`Applied MV config: ${applied} window assignments`)
      return { applied }
    },
  )
}
