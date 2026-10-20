// Free, no-API-key port suggestions. On the desktop: real search results
// (main process, `webSearchService`) and the text of the top result pages.
// Fallback / browser: Wikipedia REST summary + DuckDuckGo Instant Answer.
// The text is then scanned for connector keywords. Coverage is hit-and-miss but
// works for well-known broadcast/AV gear without any account or token.
import { ALL_CONNECTOR_TYPES, type ConnectorType } from '../types/equipment'
import type { PortGroupHint } from './portSuggestions'
import { cablePlannerApi, hasDesktopBridge } from './bridge'

// Nur Saetze, die von Anschluessen reden. Eine ganze Produktseite nennt
// „HDMI" auch im Menue und im Zubehoer; gezaehlt wird nur, wo daneben
// Eingang/Ausgang/Port steht.
const PORT_CONTEXT =
  /\b(inputs?|outputs?|ports?|connectors?|interfaces?|i\/o|loop|eing(a|ä)ng\w*|ausg(a|ä)ng\w*|anschl(u|ü)ss\w*|schnittstellen?)\b/i

const portSentences = (text: string): string =>
  text
    .split(/(?<=[.;!?])\s+|\s{2,}/)
    .filter((s) => s.length < 400 && PORT_CONTEXT.test(s))
    .join(' ')

// Abschnittstitel einer Datenblatt-Seite: „Inputs .", „Outputs:",
// „Eingänge". Steht einer davon vor einem Stecker, gibt ER die Richtung an —
// in Spezifikationstabellen steht „input" sonst nirgends neben dem Stecker.
const HEADING = /\b(inputs?|outputs?|eing(?:a|ä)ng\w*|ausg(?:a|ä)ng\w*)\s*[.:]/gi

/** Ab dem ersten Ein-/Ausgangs-Abschnitt (Datenblatt), sonst nur Port-Saetze. */
const specRegion = (text: string): string => {
  HEADING.lastIndex = 0
  const m = HEADING.exec(text)
  return m ? text.slice(m.index, m.index + 6000) : portSentences(text)
}

const directionAt = (text: string, idx: number): 'in' | 'out' | undefined => {
  let last: string | undefined
  HEADING.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = HEADING.exec(text)) && m.index < idx) {
    if (idx - m.index < 2500) last = m[1].toLowerCase()
  }
  if (!last) return undefined
  return /^(out|ausg)/.test(last) ? 'out' : 'in'
}

/** Echte Suchergebnisse ueber den Hauptprozess (am Desktop). */
const webSearch = async (query: string): Promise<{ inhalt: string; source: string }> => {
  if (!hasDesktopBridge) return { inhalt: '', source: '' }
  try {
    const { hits, pages } = await cablePlannerApi.webSearch.search(`${query} inputs outputs specifications`)
    const parts = [
      // Ein PDF ist das Datenblatt selbst: ganz lesen, die Anschluss-
      // Tabelle steht oft weit hinten (Rear Panel).
      ...pages.map((p) => ({ url: p.url, inhalt: /\.pdf($|\?)/i.test(p.url) ? p.text : specRegion(p.text) })),
      ...hits.map((h) => ({ url: h.url, inhalt: portSentences(h.snippet) })),
    ].filter((p) => p.inhalt)
    if (!parts.length) return { inhalt: '', source: '' }
    return { inhalt: parts.map((p) => p.inhalt).join('\n'), source: parts[0].url }
  } catch {
    return { inhalt: '', source: '' }
  }
}

const wikiSummary = async (query: string): Promise<string> => {
  // Try the page directly first; fall back to opensearch+REST.
  const tryFetch = async (title: string) => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) return ''
      const json = (await res.json()) as { extract?: string }
      return json.extract ?? ''
    } catch {
      return ''
    }
  }
  const direct = await tryFetch(query)
  if (direct) return direct
  // OpenSearch fallback to find the closest page title.
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&origin=*&limit=1&search=${encodeURIComponent(query)}`
  try {
    const res = await fetch(searchUrl)
    if (!res.ok) return ''
    const arr = (await res.json()) as unknown[]
    const titles = Array.isArray(arr) && Array.isArray(arr[1]) ? (arr[1] as string[]) : []
    if (titles[0]) return await tryFetch(titles[0])
  } catch {
    /* ignore */
  }
  return ''
}

const ddgInstant = async (query: string): Promise<string> => {
  // DuckDuckGo Instant Answer — no key, but rate-limited and often empty.
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=cable-planner`
  try {
    const res = await fetch(url)
    if (!res.ok) return ''
    const json = (await res.json()) as { AbstractText?: string; Abstract?: string; Definition?: string }
    return json.AbstractText || json.Abstract || json.Definition || ''
  } catch {
    return ''
  }
}

// Connector keyword → (connectorType, default direction guess, default standard)
interface KW {
  re: RegExp
  connector: ConnectorType
  direction?: 'in' | 'out'
  label: string
}
const KEYWORDS: KW[] = [
  { re: /\b(12g[- ]?sdi|12g sdi|sdi 12g)\b/gi, connector: 'BNC', label: '12G-SDI' },
  { re: /\b(6g[- ]?sdi)\b/gi, connector: 'BNC', label: '6G-SDI' },
  { re: /\b(3g[- ]?sdi)\b/gi, connector: 'BNC', label: '3G-SDI' },
  { re: /\b(hd[- ]?sdi|sdi)\b/gi, connector: 'BNC', label: 'SDI' },
  { re: /\bbnc\b/gi, connector: 'BNC', label: 'BNC' },
  { re: /\bhdmi\b/gi, connector: 'HDMI', label: 'HDMI' },
  { re: /\b(displayport|dp)\b/gi, connector: 'DisplayPort', label: 'DisplayPort' },
  { re: /\b(xlr)\b/gi, connector: 'XLR', label: 'XLR' },
  { re: /\b(rj[- ]?45|ethernet|gigabit|1\s*gbe|10\s*gbe|2\.5\s*gbe)\b/gi, connector: 'Ethernet/RJ45', label: 'Ethernet' },
  { re: /\bsfp\+?\b/gi, connector: 'SFP+', label: 'SFP+' },
  { re: /\b(fiber|fibre|optical)\b/gi, connector: 'Fiber', label: 'Fiber' },
  { re: /\busb\b/gi, connector: 'USB', label: 'USB' },
  { re: /\bpowercon\b/gi, connector: 'PowerCON', label: 'PowerCON', direction: 'in' },
  { re: /\b(iec\s*c\d{1,2}|iec connector|iec inlet|iec 230)\b/gi, connector: 'IEC 230V', label: 'IEC', direction: 'in' },
  { re: /\b(schuko|cee\s*7\/4)\b/gi, connector: 'Schuko 230V', label: 'Schuko', direction: 'in' },
  { re: /\bdin\b/gi, connector: 'DIN', label: 'DIN' },
]

// Detect counts like "4 SDI inputs", "2× HDMI", "12 BNC connectors"
const COUNT_NEAR = (text: string, idx: number): number | undefined => {
  const before = text.slice(Math.max(0, idx - 30), idx)
  const m = before.match(/(\d{1,3})\s*[×x]?\s*$/)
  if (m) {
    const n = Number(m[1])
    if (n >= 1 && n <= 64) return n
  }
  return undefined
}
// Datenblatt-Tabellen: „12G-SDI INPUT 4", „LINE IN 2 3.5 mm …". Die Zahl
// steht HINTER dem Stecker, getrennt hoechstens durch IN/OUT/LOOP.
// Versionsnummern („HDMI 2.0") fallen durch das `(?![.\d])`.
const COUNT_AFTER = (text: string, end: number): number | undefined => {
  const after = text.slice(end, end + 30)
  const m = after.match(/^[\s&/-]*(?:(?:input|output|in|out|loop)s?[\s&/-]*)*(\d{1,2})(?![.\d])(?:\s*(?:groups?|x|×))?(?!\s*(?:mm|hz|bit|g\b|k\b|p\b))/i)
  if (!m) return undefined
  const n = Number(m[1])
  return n >= 1 && n <= 64 ? n : undefined
}
// Das NAECHSTE Richtungswort gewinnt. Vorher gewann „output" immer, sobald es
// irgendwo im Fenster stand — in einer Datenblatt-Tabelle steht die
// Ausgangszeile aber direkt unter der Eingangszeile.
const DIRECTION_NEAR = (text: string, idx: number): 'in' | 'out' | undefined => {
  const from = Math.max(0, idx - 30)
  const window = text.slice(from, Math.min(text.length, idx + 60)).toLowerCase()
  const re = /\b(outputs?|out|send|inputs?|in|return|loop)\b/g
  let best: { dist: number; dir: 'in' | 'out' } | undefined
  let m: RegExpExecArray | null
  while ((m = re.exec(window))) {
    const dist = Math.abs(from + m.index - idx)
    const dir = /^(out|send)/.test(m[1]) ? 'out' : 'in'
    if (!best || dist < best.dist) best = { dist, dir }
  }
  return best?.dir
}

/**
 * Stecker-Stichworte im Text zaehlen. Die Richtung kommt aus dem letzten
 * Abschnittstitel (Inputs/Outputs), sonst aus den Woertern daneben.
 */
export const scanConnectors = (snippet: string): PortGroupHint[] => {
  // For each connector keyword, count distinct mentions (capped) in the
  // snippet. Group by direction when the surrounding text hints at it.
  const buckets = new Map<string, PortGroupHint>()
  for (const kw of KEYWORDS) {
    let m: RegExpExecArray | null
    kw.re.lastIndex = 0
    while ((m = kw.re.exec(snippet))) {
      const dir = kw.direction ?? directionAt(snippet, m.index) ?? DIRECTION_NEAR(snippet, m.index) ?? 'in'
      const count = COUNT_NEAR(snippet, m.index) ?? COUNT_AFTER(snippet, m.index + m[0].length) ?? 1
      // Ein Schluessel je Stecker und Richtung: „12G-SDI", „SDI" und „BNC"
      // im selben Datenblatt sind dieselben Buchsen, nicht drei Gruppen. Das
      // Etikett bleibt das des ersten (spezifischsten) Stichworts.
      const key = `${kw.connector}|${dir}`
      const existing = buckets.get(key)
      if (existing) {
        existing.count = Math.max(existing.count, count)
      } else {
        buckets.set(key, {
          direction: dir,
          count,
          connectorType: kw.connector,
          label: kw.label,
        })
      }
    }
  }

  // Validate connector type is in the allowed enum (defensive).
  const valid = ALL_CONNECTOR_TYPES as readonly ConnectorType[]
  const hints = Array.from(buckets.values()).filter((h) => valid.includes(h.connectorType))
  return hints
}

export const suggestFromWeb = async (
  deviceName: string,
  category: string,
): Promise<{ hints: PortGroupHint[]; source: string; snippet: string }> => {
  const query = `${deviceName} ${category}`.trim()
  const web = await webSearch(deviceName)
  const [wiki, ddg] = web.inhalt
    ? ['', '']
    : await Promise.all([wikiSummary(deviceName), ddgInstant(query)])
  const snippet = (web.inhalt || `${wiki}\n${ddg}`).trim()
  if (!snippet) return { hints: [], source: 'web', snippet: '' }

  const hints = scanConnectors(snippet)
  return {
    hints,
    source: web.source || (wiki ? 'wikipedia' : 'duckduckgo'),
    snippet: snippet.slice(0, 400),
  }
}
