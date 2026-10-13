/**
 * ATEM-Eingangslabel folgt der Videohub-Route — die reine Logik.
 *
 * Ein Videohub-Ausgang speist einen ATEM-Eingang (das sagt der Plan, nicht
 * ein Name). Wird am Hub umgeschaltet, soll der ATEM-Eingang den Namen der
 * Quelle tragen, die jetzt auf dem Ausgang liegt — so wie der Hub sie selbst
 * nennt (INPUT LABELS). Der Name kommt vom GERÄT und nicht aus dem Plan: der
 * Hub ist es, der umgeschaltet wurde, und nur er weiss, was jetzt anliegt.
 *
 * Kein Socket, keine Uhr, keine Bibliothek — die Verdrahtung steht in
 * `follower.ts`.
 */

/** Eine Verbindung Hub-Ausgang -> ATEM-Eingang, aus dem Plan abgeleitet. */
export interface LabelFollowLink {
  hubHost: string
  hubPort: number
  /** 0-basiert, wie im Videohub-Protokoll. */
  hubOutput: number
  atemHost: string
  /** Die Quellen-Nummer des ATEM-Eingangs (1 = Eingang 1). */
  atemInput: number
}

/** Was das Folgen vom Hub wissen muss. */
export interface HubLive {
  inputLabels: Record<number, string>
  routing: Record<number, number>
}

export const emptyHubLive = (): HubLive => ({ inputLabels: {}, routing: {} })

export interface AtemLabel {
  long: string
  short: string
}

const UMLAUTE: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss',
}

/**
 * Nur druckbares ASCII. Der ATEM speichert die Namen als Bytes
 * (`labelTargets.ts`: asciiOnly) — ein „ü" käme als zwei kaputte Zeichen an.
 */
export const atemAscii = (raw: string): string =>
  raw
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUTE[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Der 4-Zeichen-Kurzname, der Multiviewer-Fenster beschriftet.
 *
 * Eine Endnummer bleibt immer erhalten: aus „Cam 1" und „Cam 2" darf nicht
 * zweimal „CAM" werden — genau die Fenster, die man unterscheiden muss.
 */
export const atemShortName = (long: string): string => {
  const woerter = long.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
  if (woerter.length === 0) return ''
  const letztes = woerter[woerter.length - 1]
  if (/^\d+$/.test(letztes) && woerter.length > 1) {
    const nummer = letztes.slice(-3)
    const vorne = woerter.slice(0, -1).join('')
    return (vorne.slice(0, 4 - nummer.length) + nummer).slice(0, 4)
  }
  const endziffer = /^([A-Z]+)(\d+)$/.exec(letztes)
  if (woerter.length === 1 && endziffer) {
    const nummer = endziffer[2].slice(-3)
    return (endziffer[1].slice(0, 4 - nummer.length) + nummer).slice(0, 4)
  }
  if (woerter.length === 1) return letztes.slice(0, 4)
  if (woerter.length >= 3) return woerter.map((w) => w[0]).join('').slice(0, 4)
  return (woerter[0].slice(0, 2) + woerter[1].slice(0, 2)).slice(0, 4)
}

/** Lang- und Kurzname nach den ATEM-Grenzen (20 / 4 Byte). */
export const atemLabel = (raw: string): AtemLabel | null => {
  const long = atemAscii(raw).slice(0, 20).trim()
  if (!long) return null
  return { long, short: atemShortName(long) }
}

/**
 * Was ein ATEM-Eingang jetzt heissen soll — oder null, wenn der Hub es (noch)
 * nicht sagt. Kein Kreuzpunkt oder kein Label heisst: nichts senden. Ein
 * Platzhalter wie „Input 5" würde den Namen überschreiben, den jemand am
 * Mischer von Hand vergeben hat, für eine Auskunft, die es nicht gibt.
 */
export const wunschLabel = (link: LabelFollowLink, hub: HubLive): AtemLabel | null => {
  const input = hub.routing[link.hubOutput]
  if (typeof input !== 'number') return null
  const label = hub.inputLabels[input]
  return typeof label === 'string' ? atemLabel(label) : null
}

export const hubKey = (host: string, port: number): string => `${host}:${port}`
export const atemKey = (host: string, input: number): string => `${host}#${input}`

/**
 * Ein Block des Videohub-Protokolls in den Zustand übernehmen.
 *
 * Der Hub schickt beim Verbinden alles und danach nur, was sich ändert —
 * dieselben Kopfzeilen mit den geänderten Zeilen. Deshalb wird gemischt und
 * nicht ersetzt. Gibt zurück, ob sich für das Folgen etwas geändert hat.
 */
export const applyHubBlock = (hub: HubLive, block: string): boolean => {
  const zeilen = block.split(/\r?\n/).filter((l) => l.length > 0)
  if (zeilen.length === 0) return false
  const kopf = zeilen[0].replace(/:\s*$/, '').trim().toUpperCase()
  const ziel =
    kopf === 'INPUT LABELS' ? 'labels' : kopf === 'VIDEO OUTPUT ROUTING' ? 'routing' : null
  if (!ziel) return false
  let geaendert = false
  for (const zeile of zeilen.slice(1)) {
    const m = /^(\d+)\s(.*)$/.exec(zeile)
    if (!m) continue
    const idx = Number(m[1])
    if (ziel === 'labels') {
      if (hub.inputLabels[idx] !== m[2]) {
        hub.inputLabels[idx] = m[2]
        geaendert = true
      }
    } else {
      const input = Number(m[2].trim())
      if (!Number.isInteger(input) || input < 0) continue
      if (hub.routing[idx] !== input) {
        hub.routing[idx] = input
        geaendert = true
      }
    }
  }
  return geaendert
}

/**
 * Zerlegt einen TCP-Strom in vollständige Blöcke (durch Leerzeile getrennt).
 * Der Rest bleibt stehen, bis die nächste Lieferung ihn abschliesst — ein
 * halber Routing-Block würde sonst als ganzer gelesen.
 */
export const splitBlocks = (puffer: string): { bloecke: string[]; rest: string } => {
  const teile = puffer.split(/\r?\n\r?\n/)
  const rest = teile.pop() ?? ''
  return { bloecke: teile.filter((t) => t.trim().length > 0), rest }
}

/**
 * Normalisiert die Links aus dem Renderer. Was nicht passt, fällt raus —
 * ein geratener Eingang bekäme einen fremden Namen.
 */
export const normaliseLinks = (raw: unknown): LabelFollowLink[] => {
  if (!Array.isArray(raw)) return []
  const out: LabelFollowLink[] = []
  const hostOk = (h: unknown): h is string => typeof h === 'string' && /^[\w.\-:]+$/.test(h)
  const intOk = (n: unknown, min: number, max: number): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const l = r as Record<string, unknown>
    if (!hostOk(l.hubHost) || !hostOk(l.atemHost)) continue
    if (!intOk(l.hubPort, 1, 65535) || !intOk(l.hubOutput, 0, 1023) || !intOk(l.atemInput, 1, 65535)) continue
    out.push({
      hubHost: l.hubHost,
      hubPort: l.hubPort,
      hubOutput: l.hubOutput,
      atemHost: l.atemHost,
      atemInput: l.atemInput,
    })
  }
  return out
}
