import {
  applyHubBlock,
  atemKey,
  emptyHubLive,
  hubKey,
  splitBlocks,
  wunschLabel,
  type AtemLabel,
  type HubLive,
  type LabelFollowLink,
} from './core.js'

/**
 * Hält je Videohub EINE lesende Verbindung offen und schreibt die
 * ATEM-Labels nach, wenn sich Route oder Quellname ändern.
 *
 * WARUM EINE DAUERVERBINDUNG UND KEIN ABFRAGEN: der Hub meldet jede Änderung
 * von sich aus an alle verbundenen Clients — auch die, die am Hardware-Panel
 * oder aus einer anderen Software geschaltet wurden. Genau die sind der Grund
 * für die Funktion; ein Abfragen im Takt sähe sie zu spät oder gar nicht.
 *
 * WAS NIE GESENDET WIRD: ein Label, das schon so am Mischer steht, das der
 * Hub nicht kennt, oder an einen Eingang, den der Plan nicht nennt. Das
 * Folgen schreibt nur Namen — es schaltet nichts und ändert keine Route.
 */

export interface HubSocket {
  destroy(): void
}

export interface FollowerDeps {
  /** Öffnet eine TCP-Verbindung; die Rückrufe kommen vom Socket. */
  connect(
    host: string,
    port: number,
    on: { data(text: string): void; close(): void; error(err: Error): void },
  ): HubSocket
  setLabel(atemHost: string, atemInput: number, label: AtemLabel): Promise<void>
  onStatus(status: FollowStatus): void
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
}

export interface FollowStatus {
  running: boolean
  hubs: { key: string; connected: boolean }[]
  /** Die letzten Meldungen, neueste zuletzt. */
  log: string[]
}

interface HubConn {
  host: string
  port: number
  socket: HubSocket | null
  connected: boolean
  live: HubLive
  rest: string
  retry: unknown
}

const NEU_VERBINDEN_MS = 5000

export const createFollower = (deps: FollowerDeps) => {
  let links: LabelFollowLink[] = []
  let running = false
  const hubs = new Map<string, HubConn>()
  /** Was zuletzt gesendet oder am Mischer gesetzt wurde, je ATEM-Eingang. */
  const gesendet = new Map<string, string>()
  const log: string[] = []

  const status = (): FollowStatus => ({
    running,
    hubs: [...hubs.entries()].map(([key, h]) => ({ key, connected: h.connected })),
    log: log.slice(-30),
  })
  const melden = (zeile?: string) => {
    if (zeile) {
      log.push(`${new Date().toISOString().slice(11, 19)} ${zeile}`)
      if (log.length > 100) log.splice(0, log.length - 100)
    }
    deps.onStatus(status())
  }

  const abgleichen = async (key: string) => {
    const hub = hubs.get(key)
    if (!hub) return
    for (const link of links) {
      if (hubKey(link.hubHost, link.hubPort) !== key) continue
      const label = wunschLabel(link, hub.live)
      if (!label) continue
      const aKey = atemKey(link.atemHost, link.atemInput)
      const wert = `${label.long}\u0000${label.short}`
      if (gesendet.get(aKey) === wert) continue
      gesendet.set(aKey, wert)
      try {
        await deps.setLabel(link.atemHost, link.atemInput, label)
        melden(`ATEM ${link.atemHost} Eingang ${link.atemInput} = „${label.long}" (${label.short})`)
      } catch (e) {
        // Beim nächsten Anlass erneut versuchen, nicht in einer Schleife.
        gesendet.delete(aKey)
        melden(`ATEM ${link.atemHost} Eingang ${link.atemInput}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  const verbinden = (key: string) => {
    const hub = hubs.get(key)
    if (!hub || !running) return
    hub.retry = null
    hub.rest = ''
    hub.live = emptyHubLive()
    hub.socket = deps.connect(hub.host, hub.port, {
      data: (text) => {
        if (!hub.connected) {
          hub.connected = true
          melden(`Videohub ${key} verbunden`)
        }
        const { bloecke, rest } = splitBlocks(hub.rest + text)
        hub.rest = rest
        let geaendert = false
        for (const b of bloecke) geaendert = applyHubBlock(hub.live, b) || geaendert
        if (geaendert) void abgleichen(key)
      },
      error: (err) => melden(`Videohub ${key}: ${err.message}`),
      close: () => {
        const war = hub.connected
        hub.connected = false
        hub.socket = null
        if (!running || hubs.get(key) !== hub) return
        if (war) melden(`Videohub ${key} getrennt — neuer Versuch in ${NEU_VERBINDEN_MS / 1000} s`)
        else melden()
        hub.retry = deps.setTimer(() => verbinden(key), NEU_VERBINDEN_MS)
      },
    })
  }

  const trennen = (key: string) => {
    const hub = hubs.get(key)
    if (!hub) return
    hubs.delete(key)
    if (hub.retry) deps.clearTimer(hub.retry)
    hub.socket?.destroy()
  }

  /** Neue Links übernehmen: Hubs auf- und abbauen, dann abgleichen. */
  const setLinks = (neu: LabelFollowLink[]) => {
    links = neu
    if (!running) return
    const gewollt = new Set(neu.map((l) => hubKey(l.hubHost, l.hubPort)))
    for (const key of [...hubs.keys()]) if (!gewollt.has(key)) trennen(key)
    for (const l of neu) {
      const key = hubKey(l.hubHost, l.hubPort)
      if (hubs.has(key)) continue
      hubs.set(key, {
        host: l.hubHost, port: l.hubPort, socket: null, connected: false,
        live: emptyHubLive(), rest: '', retry: null,
      })
      verbinden(key)
    }
    for (const key of hubs.keys()) void abgleichen(key)
    melden()
  }

  return {
    start(neu: LabelFollowLink[]) {
      if (!running) {
        running = true
        gesendet.clear()
        melden(`Folgen gestartet (${neu.length} Verbindung(en))`)
      }
      setLinks(neu)
    },
    update(neu: LabelFollowLink[]) {
      setLinks(neu)
    },
    stop() {
      if (!running) return
      running = false
      for (const key of [...hubs.keys()]) trennen(key)
      melden('Folgen beendet')
    },
    status,
  }
}

export type Follower = ReturnType<typeof createFollower>
