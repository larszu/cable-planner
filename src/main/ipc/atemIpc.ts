import { ipcMain, BrowserWindow } from 'electron'
import { Atem, AtemConnectionStatus } from 'atem-connection'
import { Bonjour, type Service } from 'bonjour-service'
import { mapAtemWindowIndexToCp, mapCpWindowIndexToAtem } from '../util/mvWindowMapping.js'

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
// v7.9.93 — Connect-Lock gegen Race wenn der User schnell zwei IPs
// hintereinander connect't. Ohne Lock konnten zwei parallele atem.connect()
// im selben Modul-Scope laufen — alte Listener feuerten auf neue atem-
// Instanz oder umgekehrt.
let connectInFlight: Promise<unknown> | null = null

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
    const old = atem
    // v7.9.93 — Listener vor disconnect() abreißen damit late-firing
    // events nicht mehr in pushEvent() landen + GC den alten Object
    // sauber abräumt.
    try { old.removeAllListeners() } catch { /* ignore */ }
    try {
      await old.disconnect()
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
    // #289/#293 — externalPortType (Bitmask: SDI=1, HDMI=2, ..., XLR=32,
    // RCA=128, ...) und areNamesDefault brauchen wir im Renderer um beim
    // Bulk-Pre-Fill Audio-Quellen (XLR/RJ45-Talkback) und Mediaplayer
    // nicht aus Versehen zu ueberschreiben. internalPortType klassifiziert
    // die Source-Kategorie (External=0, MediaPlayer=4/5, MEOutput=128,
    // Auxiliary=129, MultiViewer=131).
    externalPortType: input?.externalPortType,
    areNamesDefault: input?.areNamesDefault ?? false,
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
    if (!ip || typeof ip !== 'string') {
      throw new Error('ATEM IP address is required.')
    }
    // v7.9.93 — Serialisiere connect-Aufrufe damit zwei parallele
    // connect-IPC-Calls (User klickt schnell mit zwei IPs) nicht
    // race-en. Der zweite Call wartet bis der erste durch ist.
    if (connectInFlight) {
      try { await connectInFlight } catch { /* der erste darf scheitern */ }
    }
    const runConnect = async (): Promise<{ ip: string; summary: ReturnType<typeof summarizeState> }> => {
      await ensureDisconnected()
      const localAtem = new Atem()
      atem = localAtem
      connectedIp = ip

      // v7.9.93 — Event-Wait via Promise statt Polling-Loop. Wir
      // wrappen 'connected' / 'error' / Timeout in race().
      const handshake = new Promise<void>((resolve, reject) => {
        const onConnected = () => {
          cleanupOnce()
          resolve()
        }
        const onError = (msg: string) => {
          cleanupOnce()
          reject(new Error(msg))
        }
        const cleanupOnce = () => {
          localAtem.off('connected', onConnected)
          localAtem.off('error', onError)
        }
        localAtem.once('connected', onConnected)
        localAtem.once('error', onError)
        setTimeout(() => {
          cleanupOnce()
          reject(new Error('Handshake timeout (5s)'))
        }, 5000)
      })

      // Permanente Listener für UI-Events.
      localAtem.on('connected', () => pushEvent(`Connected to ATEM at ${ip}`))
      localAtem.on('disconnected', () => pushEvent(`Disconnected from ATEM at ${ip}`))
      localAtem.on('error', (msg: string) => pushEvent(`ATEM error: ${msg}`))
      localAtem.on('info', (msg: string) => pushEvent(`ATEM: ${msg}`))

      try {
        await localAtem.connect(ip)
        await handshake
      } catch (err) {
        // Wenn dieser Connect noch der "aktuelle" ist → aufräumen.
        // Bei concurrent-replace könnte atem schon auf ein anderes Objekt
        // zeigen — dann nichts kaputt machen.
        if (atem === localAtem) await ensureDisconnected()
        throw new Error(
          `Could not connect to ATEM at ${ip}: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        )
      }

      if (atem !== localAtem || localAtem.status !== AtemConnectionStatus.CONNECTED) {
        if (atem === localAtem) await ensureDisconnected()
        throw new Error(`ATEM at ${ip} did not finish handshake within 5s.`)
      }

      return { ip, summary: summarizeState() }
    }
    const promise = runConnect()
    connectInFlight = promise
    try {
      return await promise
    } finally {
      if (connectInFlight === promise) connectInFlight = null
    }
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

  // #288 — MV-Setup vom live verbundenen ATEM auslesen und in das
  // CP-Quadranten-Schema konvertieren. Spiegel zu atem:apply-mv-config:
  // dort schickt der Renderer CP-Indices an die Hardware, hier lesen wir
  // die Hardware-Indices zurueck und uebersetzen sie zur CP-Form damit
  // sie 1:1 in den AtemMvConfig-State passen.
  ipcMain.handle(
    'atem:read-mv-config',
    async (): Promise<{
      multiViewers: Array<{
        index: number
        layout: number
        programPreviewSwapped: boolean
        windows: Array<{ windowIndex: number; sourceId: number }>
      }>
    }> => {
      if (!atem || atem.status !== AtemConnectionStatus.CONNECTED) {
        throw new Error('ATEM not connected')
      }
      const state = atem.state
      const mvSettings = state?.settings?.multiViewers ?? []
      const result = mvSettings.map((mv, mvIndex) => {
        if (!mv) {
          return {
            index: mvIndex,
            layout: 0,
            programPreviewSwapped: false,
            windows: [] as Array<{ windowIndex: number; sourceId: number }>,
          }
        }
        const layout = mv.properties?.layout ?? 0
        const windows: Array<{ windowIndex: number; sourceId: number }> = []
        mv.windows.forEach((window, atemWindowIndex) => {
          if (!window) return
          const cpIndex = mapAtemWindowIndexToCp(atemWindowIndex, layout)
          if (cpIndex === undefined) return
          windows.push({ windowIndex: cpIndex, sourceId: window.source ?? 0 })
        })
        return {
          index: mvIndex,
          layout,
          programPreviewSwapped: mv.properties?.programPreviewSwapped ?? false,
          windows,
        }
      })
      pushEvent(
        `Read MV config: ${result.length} multi-viewer(s), ` +
          `${result.reduce((s, m) => s + m.windows.length, 0)} window-assignments`,
      )
      return { multiViewers: result }
    },
  )

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
      let skipped = 0
      for (const mv of config.multiViewers) {
        try {
          // v7.9.123 / Bug-1b — Layout-Code direkt durchsenden inkl.
          // Constellation-Werten (16=Grid16Small, 32=Quad4Big). atem-
          // connection's TypeScript-Enum kennt diese Werte nicht; wir
          // cast'en die Zahl und vertrauen darauf dass die Hardware
          // sie kennt (Constellation HD/4K/8K-Firmware tut das). Bei
          // aelteren Modellen wird die Hardware den Befehl ignorieren
          // oder auf 0 zurueckfallen.
          await atem.setMultiViewerProperties(
            {
              layout: mv.layout,
              programPreviewSwapped: mv.programPreviewSwapped ?? false,
            },
            mv.index,
          )
        } catch (err) {
          pushEvent(`MV ${mv.index} properties (layout=${mv.layout}) failed: ${(err as Error).message}`)
        }
        for (const win of mv.windows) {
          // v7.9.123 / Bug-1a — CP-internes Quadranten-Schema (Windows
          // 0-3 = grosse Slots, 10-13/20-23/30-33/40-43 = kleine Cells)
          // ist NICHT das ATEM-Format. ATEM erwartet 0-15 (Grid16),
          // 0-9 (Standard-10-Tile) oder 0-3 (Quad4Big). Mapping macht
          // mapCpWindowIndexToAtem in atemMvLayout.ts.
          const atemWindowIndex = mapCpWindowIndexToAtem(win.windowIndex, mv.layout)
          if (atemWindowIndex < 0) {
            // Dieser CP-Slot hat im gewaehlten Layout keine Entsprechung
            // (z.B. user hat im Default-Layout Quadrant 2 als 'big'
            // markiert, aber Default kennt nur Big-Slots an Position 0+1).
            skipped++
            continue
          }
          try {
            await atem.setMultiViewerWindowSource(win.sourceId, mv.index, atemWindowIndex)
            applied++
          } catch (err) {
            pushEvent(
              `MV ${mv.index} window ${atemWindowIndex} (cp ${win.windowIndex}) source ${win.sourceId} failed: ${(err as Error).message}`,
            )
          }
        }
      }
      pushEvent(
        `Applied MV config: ${applied} window assignments` +
          (skipped > 0 ? ` (${skipped} ohne Entsprechung im Layout uebersprungen)` : ''),
      )
      return { applied, skipped }
    },
  )

  // v7.9.52 — OpenSwitcher-style Live-Audio-Routing.
  //
  // Liest den vollständigen Audio-State live aus dem aktuellen Switcher und
  // gibt ihn im AtemAudioConfig-Format zurück (kompatibel zum XML-Flow,
  // sodass das gleiche UI beide Quellen verarbeiten kann). Anders als
  // der XML-Pfad, der nur eine offline gespeicherte ATEM-Profile-XML
  // patcht, holt das hier den TATSÄCHLICHEN aktuellen Zustand.
  //
  // atem-connection legt den State unter atem.state.audio (Classic) /
  // atem.state.fairlight + atem.state.fairlight.audioRouting (Matrix
  // auf Extreme/Constellation). Wir mappen direkt darauf.
  ipcMain.handle('atem:read-audio-config', async () => {
    if (!atem || atem.status !== AtemConnectionStatus.CONNECTED) {
      throw new Error('ATEM not connected')
    }
    const state = atem.state
    if (!state) return null

    // Input-Labels (gleiche Quelle wie summarizeState)
    const inputLabels: Record<number, { shortName: string; longName: string; externalPortType?: string }> = {}
    for (const [idStr, input] of Object.entries(state.inputs ?? {})) {
      if (!input) continue
      const id = Number(idStr)
      inputLabels[id] = {
        shortName: input.shortName ?? '',
        longName: input.longName ?? '',
        externalPortType: input.internalPortType?.toString(),
      }
    }

    // Classic Mixer (state.audio.channels)
    let classic:
      | {
          programOutGain: number
          programOutBalance: number
          programOutFollowFadeToBlack: boolean
          audioFollowVideoCrossfadeTransition: boolean
          inputs: Array<{
            id: number
            mixOption: 'Off' | 'On' | 'AudioFollowVideo'
            gain: number | null
            balance: number
          }>
        }
      | undefined
    if (state.audio?.channels) {
      const inputs: Array<{ id: number; mixOption: 'Off' | 'On' | 'AudioFollowVideo'; gain: number | null; balance: number }> = []
      for (const [idStr, channel] of Object.entries(state.audio.channels)) {
        if (!channel) continue
        const mixOption = channel.mixOption === 0 ? 'Off' : channel.mixOption === 1 ? 'On' : 'AudioFollowVideo'
        inputs.push({
          id: Number(idStr),
          mixOption,
          gain: Number.isFinite(channel.gain) ? channel.gain : null,
          balance: channel.balance,
        })
      }
      classic = {
        programOutGain: state.audio.master?.gain ?? 0,
        programOutBalance: state.audio.master?.balance ?? 0,
        programOutFollowFadeToBlack: state.audio.master?.followFadeToBlack ?? false,
        audioFollowVideoCrossfadeTransition:
          (state.audio as unknown as { audioFollowVideoCrossfadeTransition?: boolean })
            .audioFollowVideoCrossfadeTransition ?? false,
        inputs,
      }
    }

    // Fairlight Audio Routing Matrix (Extreme/Constellation)
    let matrix: { sources: Array<{ id: number; name: string }>; outputs: Array<{ id: number; sourceId: number; name: string }> } | undefined
    const routing = state.fairlight?.audioRouting
    if (routing) {
      const sources = Object.entries(routing.sources ?? {}).map(([id, s]) => ({
        id: Number(id),
        name: (s as { name?: string })?.name ?? `Source ${id}`,
      }))
      const outputs = Object.entries(routing.outputs ?? {}).map(([id, o]) => {
        const out = o as { sourceId?: number | bigint; name?: string }
        const srcId = typeof out.sourceId === 'bigint' ? Number(out.sourceId) : out.sourceId ?? 0
        return { id: Number(id), sourceId: srcId, name: out.name ?? `Output ${id}` }
      })
      matrix = { sources, outputs }
    }

    return {
      classicMixer: classic,
      matrix,
      inputLabels,
    }
  })

  // v7.9.52 — Sendet ein bearbeitetes AtemAudioConfig an den Switcher.
  // Nur die jeweils befüllten Sections werden gepusht (Matrix UND/ODER
  // Classic UND/ODER Labels). Keine Validierung gegen Mixer-Capabilities —
  // wenn etwas nicht unterstützt wird, fängt atem-connection den Fehler
  // und wir loggen ihn ins event-Log; gesendet wird trotzdem alles.
  ipcMain.handle(
    'atem:apply-audio-config',
    async (
      _event,
      config: {
        matrix?: { outputs: Array<{ id: number; sourceId: number }> }
        classicMixer?: {
          inputs: Array<{
            id: number
            mixOption: 'Off' | 'On' | 'AudioFollowVideo'
            gain: number | null
            balance: number
          }>
        }
        inputLabels?: Record<number, { shortName: string; longName: string }>
      },
    ): Promise<{ matrixApplied: number; classicApplied: number; labelsApplied: number }> => {
      if (!atem || atem.status !== AtemConnectionStatus.CONNECTED) {
        throw new Error('ATEM not connected')
      }
      let matrixApplied = 0
      let classicApplied = 0
      let labelsApplied = 0

      if (config.inputLabels) {
        for (const [idStr, label] of Object.entries(config.inputLabels)) {
          try {
            await atem.setInputSettings(
              { longName: label.longName.slice(0, 20), shortName: label.shortName.slice(0, 4) },
              Number(idStr),
            )
            labelsApplied += 1
          } catch (err) {
            pushEvent(`Label-Push ${idStr} failed: ${(err as Error).message}`)
          }
        }
      }

      if (config.classicMixer) {
        for (const input of config.classicMixer.inputs) {
          try {
            await atem.setClassicAudioMixerInputProps(input.id, {
              mixOption: input.mixOption === 'Off' ? 0 : input.mixOption === 'On' ? 1 : 2,
              gain: input.gain ?? -Infinity,
              balance: input.balance,
            })
            classicApplied += 1
          } catch (err) {
            pushEvent(`Classic input ${input.id} failed: ${(err as Error).message}`)
          }
        }
      }

      if (config.matrix) {
        for (const output of config.matrix.outputs) {
          try {
            // setFairlightAudioRoutingOutputProperties nimmt outputId als
            // erstes Argument; das war historisch die "sourceId" — der
            // Parameter-Name in der atem-connection API ist verwirrend
            // benannt, gemeint ist die ID des Outputs (= AROC index).
            await atem.setFairlightAudioRoutingOutputProperties(output.id, {
              sourceId: BigInt(output.sourceId),
            } as unknown as Partial<{ sourceId: number; name: string }>)
            matrixApplied += 1
          } catch (err) {
            pushEvent(`Matrix output ${output.id} failed: ${(err as Error).message}`)
          }
        }
      }

      pushEvent(
        `Applied audio config: matrix=${matrixApplied}, classic=${classicApplied}, labels=${labelsApplied}`,
      )
      return { matrixApplied, classicApplied, labelsApplied }
    },
  )

  // v7.9.53 — mDNS-Auto-Discovery für ATEM-Switcher.
  //
  // ATEMs broadcasten sich selbst als "_blackmagic._tcp.local"-Service.
  // Wir starten einen Bonjour-Browser für 3 s, sammeln alle "up"-Events
  // und liefern die Liste {name, ip, port} zurück. Renderer kann das
  // dann z.B. als Picker-UI anzeigen.
  //
  // Bewusst kein langlebiger Browser — Discovery ist ein User-getriggerter
  // One-Shot ("Suchen"-Button), damit wir nicht im Hintergrund einen
  // mDNS-Listener auf der CPU haben.
  ipcMain.handle(
    'atem:discover',
    async (
      _event,
      params?: { timeoutMs?: number },
    ): Promise<Array<{ name: string; ip: string; port: number; model?: string }>> => {
      const timeoutMs = Math.max(500, Math.min(15000, params?.timeoutMs ?? 3000))
      const bonjour = new Bonjour()
      const found = new Map<string, { name: string; ip: string; port: number; model?: string }>()
      const browser = bonjour.find({ type: 'blackmagic' })
      const onUp = (svc: Service) => {
        // ATEM antwortet typisch mit fqdn wie "<HostName>._blackmagic._tcp.local"
        // und addresses=[<IPv4>]. Wir bevorzugen referer.address (= UDP-Reply-
        // Quelle) weil das die garantiert erreichbare Adresse ist, fallen
        // sonst auf addresses[0] zurück.
        const ip = svc.referer?.address ?? svc.addresses?.[0]
        if (!ip) return
        const key = svc.fqdn || svc.name || ip
        if (found.has(key)) return
        found.set(key, {
          name: svc.name || svc.fqdn || ip,
          ip,
          port: svc.port ?? 9910,
          // TXT-Records: ATEM tagged z.B. "model=ATEM Mini Pro"
          model:
            (svc.txt && typeof svc.txt === 'object' && 'model' in (svc.txt as Record<string, unknown>)
              ? String((svc.txt as Record<string, unknown>).model)
              : undefined) ?? undefined,
        })
      }
      browser.on('up', onUp)
      await new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
      browser.stop()
      bonjour.destroy()
      const result = [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
      pushEvent(`Discovery scan: ${result.length} ATEM(s) gefunden`)
      return result
    },
  )
}
