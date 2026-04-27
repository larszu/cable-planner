// Free, no-API-key port suggestions. Combines Wikipedia REST summary +
// DuckDuckGo Instant Answer to harvest a snippet about the device, then
// scans the snippet for connector keywords. Coverage is hit-and-miss but
// works for well-known broadcast/AV gear without any account or token.
import { ALL_CONNECTOR_TYPES, type ConnectorType } from '../types/equipment'
import type { PortGroupHint } from './portSuggestions'

const wikiSummary = async (query: string): Promise<string> => {
  // Try the page directly first; fall back to opensearch+REST.
  const tryFetch = async (title: string) => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return ''
    const json = (await res.json()) as { extract?: string }
    return json.extract ?? ''
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
const COUNT_NEAR = (text: string, idx: number): number => {
  const before = text.slice(Math.max(0, idx - 30), idx)
  const m = before.match(/(\d{1,3})\s*[×x]?\s*$/)
  if (m) {
    const n = Number(m[1])
    if (n >= 1 && n <= 64) return n
  }
  return 1
}
const DIRECTION_NEAR = (text: string, idx: number): 'in' | 'out' | undefined => {
  const window = text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + 60)).toLowerCase()
  if (/\b(output|out|send|return out)/.test(window)) return 'out'
  if (/\b(input|in|return|loop in)/.test(window)) return 'in'
  return undefined
}

export const suggestFromWeb = async (
  deviceName: string,
  category: string,
): Promise<{ hints: PortGroupHint[]; source: string; snippet: string }> => {
  const query = `${deviceName} ${category}`.trim()
  const [wiki, ddg] = await Promise.all([wikiSummary(deviceName), ddgInstant(query)])
  const snippet = `${wiki}\n${ddg}`.trim()
  if (!snippet) return { hints: [], source: 'web', snippet: '' }

  // For each connector keyword, count distinct mentions (capped) in the
  // snippet. Group by direction when the surrounding text hints at it.
  const buckets = new Map<string, PortGroupHint>()
  for (const kw of KEYWORDS) {
    let m: RegExpExecArray | null
    kw.re.lastIndex = 0
    while ((m = kw.re.exec(snippet))) {
      const dir = kw.direction ?? DIRECTION_NEAR(snippet, m.index) ?? 'in'
      const count = COUNT_NEAR(snippet, m.index)
      const key = `${kw.connector}|${dir}|${kw.label}`
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
  return { hints, source: wiki ? 'wikipedia' : 'duckduckgo', snippet: snippet.slice(0, 400) }
}
