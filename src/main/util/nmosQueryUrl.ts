// #1240 Stufe 6 — Adresse einer IS-04-Query-API pruefen und vereinheitlichen.
//
// Erlaubt ist nur http(s), ohne Zugangsdaten in der Adresse und ohne Abfrage
// oder Anker. Angegeben werden darf der Server (`http://registry:8235`) oder
// die API selbst (`…/x-nmos/query/v1.3`, auch mit Schraegstrich am Ende);
// heraus kommt immer die API-Basis. Die Pruefung liegt in main, nie im
// Renderer (gleiche Regel wie bei Pfaden).

const API = /\/x-nmos\/query\/(v1\.[0-3])\/?$/

export const NMOS_QUERY_RESOURCES = ['nodes', 'devices', 'senders', 'receivers', 'flows'] as const

export const normalizeQueryApiUrl = (raw: string): string => {
  const text = (raw ?? '').trim()
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new Error('Not a valid URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https are allowed.')
  if (url.username || url.password) throw new Error('Credentials in the URL are not allowed.')
  if (url.search || url.hash) throw new Error('Query and fragment are not allowed.')
  const path = url.pathname.replace(/\/+$/, '')
  const m = API.exec(path)
  if (m) return `${url.origin}${path.slice(0, m.index)}/x-nmos/query/${m[1]}`
  if (path && path !== '') {
    if (path.includes('/x-nmos/')) throw new Error('Expected …/x-nmos/query/v1.x.')
    return `${url.origin}${path}/x-nmos/query/v1.3`
  }
  return `${url.origin}/x-nmos/query/v1.3`
}

/** Naechste Seite aus dem `Link`-Kopf der Query API (RFC 8288, rel="next"). */
export const nextPageUrl = (link: string | null, base: string): string | null => {
  if (!link) return null
  for (const part of link.split(',')) {
    const m = /<([^>]+)>\s*;\s*rel="?next"?/.exec(part)
    if (m) {
      const next = new URL(m[1], base)
      return next.origin === new URL(base).origin ? next.toString() : null
    }
  }
  return null
}
