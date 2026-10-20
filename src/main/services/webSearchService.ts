// Websuche fuer „Ports aus dem Namen raten" (2026-10-20).
//
// Vorher fragte der Renderer nur die Kurztexte von Wikipedia und DuckDuckGo
// Instant Answer. Die kennen Pixelhue, Kiloview & Co. nicht und nennen bei
// bekannten Geraeten selten Anschluesse — der Knopf fand praktisch nie etwas.
//
// Hier laufen echte Suchergebnisse: die HTML-Ergebnisseite von DuckDuckGo
// (keine Schluessel, aber auch keine offizielle Schnittstelle — aendert DDG
// das Markup, liefert `searchWeb` leere Ergebnisse statt eines Fehlers) plus
// der Text der ersten Treffer-Seiten. Im Hauptprozess, weil beide Abrufe aus
// dem Fenster an CORS scheitern.

export interface WebSearchHit {
  title: string
  url: string
  snippet: string
}

export interface WebSearchResult {
  hits: WebSearchHit[]
  /** Klartext der ersten Treffer-Seiten, je Seite gekappt. */
  pages: { url: string; text: string }[]
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const TIMEOUT_MS = 8000
const PAGE_LIMIT = 3
const PAGE_TEXT_MAX = 20000

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))

const stripTags = (html: string): string => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

const getText = async (url: string): Promise<string> => {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en,de;q=0.8' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  })
  if (!res.ok) return ''
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('html')) return ''
  return res.text()
}

/** DDG-Weiterleitung `//duckduckgo.com/l/?uddg=<ziel>` auf das Ziel aufloesen. */
const resolveDdgLink = (href: string): string => {
  const m = href.match(/[?&]uddg=([^&]+)/)
  const url = m ? decodeURIComponent(m[1]) : href.startsWith('//') ? `https:${href}` : href
  return /^https?:\/\//.test(url) ? url : ''
}

export const parseDdgHtml = (html: string): WebSearchHit[] => {
  const hits: WebSearchHit[] = []
  const blocks = html.split(/class="result__body"|class="result results_links/).slice(1)
  for (const block of blocks) {
    const a = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!a) continue
    const url = resolveDdgLink(decodeEntities(a[1]))
    if (!url || /duckduckgo\.com\/y\.js/.test(url)) continue // Anzeigen
    const sn = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
    hits.push({ title: stripTags(a[2]), url, snippet: sn ? stripTags(sn[1]) : '' })
  }
  return hits
}

export const htmlToText = (html: string): string =>
  stripTags(
    html
      .replace(/<(script|style|noscript|svg|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|li|tr|td|th|div|h\d|br)>/gi, '. '),
  ).slice(0, PAGE_TEXT_MAX)

export const searchWeb = async (query: string): Promise<WebSearchResult> => {
  const q = query.trim()
  if (!q) return { hits: [], pages: [] }
  let hits: WebSearchHit[]
  try {
    hits = parseDdgHtml(await getText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`))
  } catch {
    return { hits: [], pages: [] }
  }
  const targets = hits.filter((h) => !/\.pdf($|\?)/i.test(h.url)).slice(0, PAGE_LIMIT)
  const pages = await Promise.all(
    targets.map(async (h) => {
      try {
        return { url: h.url, text: htmlToText(await getText(h.url)) }
      } catch {
        return { url: h.url, text: '' }
      }
    }),
  )
  return { hits, pages: pages.filter((p) => p.text) }
}
