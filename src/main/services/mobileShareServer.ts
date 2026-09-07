/**
 * Issue follow-up: phone-accessible mobile viewer while the desktop
 * app is running on a different machine.
 *
 * Spawns a tiny HTTP server on a free LAN port. Routes:
 *   GET /                 → 302 to /mobile.html
 *   GET /mobile.html      → the bundled mobile viewer HTML
 *   GET /assets/*         → the bundled JS/CSS assets next to mobile.html
 *   GET /project.json     → the current in-memory project (Cable-Planner JSON)
 *
 * Lifecycle:
 *   - start() picks a free port, opens the server, returns
 *     { port, urls } where `urls` is every LAN address that
 *     resolves to a non-internal IPv4 interface (so the user can
 *     pick the one their phone is on if the studio runs multiple
 *     subnets).
 *   - setProject() updates the JSON the server hands out. The
 *     renderer pushes the project here whenever it changes so the
 *     phone always sees the latest state on refresh.
 *   - stop() closes the server and clears the in-memory project.
 *
 * Security model (Stand: Token-Gate):
 *   - start() generiert ein zufälliges Hex-Token (state.token).
 *   - Das Token reist im QR/URL als ?t=<token> zum Mobile-Client und wird
 *     von dort bei JEDEM Request mitgeschickt (?t-Query ODER X-CP-Token-Header).
 *   - Daten-/Write-Routen (/project.json, /checks, /cables, /share-info.json)
 *     verlangen ein gültiges Token, sonst 401. Statische Shell-Assets
 *     (mobile.html, /assets/*) bleiben offen — sie enthalten keine Projektdaten.
 *   - CORS wird NICHT mehr per '*' vergeben: applyCors() reflektiert nur
 *     Origins aus privaten LAN-/Loopback-Ranges, sonst kein Grant.
 *   - Geräte-Passwörter o.ä. werden vor dem Ausliefern via stripSecrets()
 *     aus dem Projekt entfernt.
 *
 * Offen (bewusster Tradeoff): kein per-IP Rate-Limit auf Write-Routen, und
 * das Token-Modell schützt nicht gegen jemanden, der die URL inkl. Token
 * sieht (Schulter-Surfen am QR). Für kleine Studio-LANs ausreichend.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { relative as pathRelative, resolve as pathResolve, sep as pathSep } from 'node:path'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { stripSecrets } from '../util/stripSecrets.js'
import { shareAddresses, type WithheldAddress } from '../util/lanReach.js'
import { showIdOf, showMismatch } from '../util/shareShow.js'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const mimeFor = (filePath: string): string => {
  const dot = filePath.lastIndexOf('.')
  if (dot < 0) return 'application/octet-stream'
  return MIME_TYPES[filePath.slice(dot).toLowerCase()] ?? 'application/octet-stream'
}

const __filename = fileURLToPath(import.meta.url)

interface MobileShareState {
  server: Server | null
  port: number
  /** Per-session access token. Generated on start(), required on every
   *  data/write route (?t= query or X-CP-Token header). Empty when the
   *  server is stopped. */
  token: string
  /**
   * BEDARF 133 — ob Adressen ueber das LAN hinaus angeboten werden duerfen.
   *
   * Vorgabe `false`. Der Server bindet auf `0.0.0.0`, und bis 2026-09-07 wurde
   * JEDE nicht-interne IPv4 des Rechners als Freigabe-Adresse angeboten —
   * samt Token in der URL. Auf einem Hallen-WLAN ist das richtig; an einer
   * oeffentlich erreichbaren Adresse war es ein Bearer-Token im offenen Netz,
   * ohne dass es jemand entschieden haette. Es ergab sich aus der
   * Netzwerkkarte.
   *
   * Die Quelle (`cpvalente/ontime#1423`) verlangt Zugriffskontrolle genau
   * fuer Aufstellungen, die „globally available" sind. Also: der LAN-Weg
   * bleibt leicht, der Weg darueber hinaus verlangt eine ausdrueckliche
   * Entscheidung.
   */
  allowBeyondLan: boolean
  /**
   * BEDARF 127 — die Show, die gerade freigegeben ist.
   *
   * Steht neben dem Projekt und nicht in ihm, damit die Pruefung des
   * Rueckwegs nicht bei jedem Aufruf durch das ganze Projekt greifen muss.
   * Gesetzt wird sie an EINER Stelle, zusammen mit dem Projekt selbst.
   */
  showId: string | null
  project: unknown | null
  /** Cached JSON serialization of `project` with secrets stripped. Built
   *  once per setProject() so each /project.json poll doesn't re-stringify
   *  the whole (potentially multi-MB) project on the main thread. */
  serialized: string | null
  /**
   * BEDARF 39 — der Crew-Kalender als fertiger iCalendar-Text.
   *
   * ER WIRD IM RENDERER GEBAUT und hier nur gehalten. Die Rechnung dafuer
   * steht in `renderer/lib/crewCalendar.ts`; sie hier ein zweites Mal zu
   * schreiben waere dieselbe Doppelung, gegen die der Bedarf ueberhaupt
   * geschrieben ist — und `main` haette dann eine eigene Vorstellung davon,
   * was eine Schicht ist.
   */
  crewIcs: string | null
  /** Absolute path to dist/renderer (where mobile.html + assets live). */
  rendererDir: string
  /** When set (e.g. `npm run dev`), static-asset requests are proxied
   *  here instead of read from disk so the phone can also load the
   *  mobile viewer from a Vite-served HMR build. */
  devProxyUrl: string | undefined
  /** v7.9.3 — Callback der vom Renderer registriert wird, um auf
   *  Check-State-Updates vom Mobile-Viewer zu reagieren. Wird vom
   *  POST /checks-Handler aufgerufen sobald das Handy einen Port
   *  als gesteckt markiert. */
  onChecksUpdate: ((checks: { ports: Record<string, boolean>; cables: Record<string, boolean> }) => void) | null
  /** v7.9.54 — Callback für vom Mobile-Viewer hinzugefügte Kabel.
   *  Der User steht vor Ort am Gerät, merkt dass ein Patch fehlt und
   *  trägt das fehlende Kabel über die Dropdown-UI im Phone ein.
   *  Server reicht das hier rein, Renderer fügt es ins Projekt mit
   *  addedFromMobile=true ein. */
  onCableAdded:
    | ((cable: {
        fromEquipmentId: string
        fromPortId: string
        toEquipmentId: string
        toPortId: string
        name?: string
        type?: string
        length?: number
        color?: string
        notes?: string
      }) => void)
    | null
  /** Feld-Rückkanal: vom Mobile-Companion gemeldete, noch nicht angewandte
   *  Änderung (Längen-Korrektur, Problem-Meldung …). Renderer legt sie in
   *  die Review-Queue (project.pendingChanges); der Planer übernimmt/verwirft
   *  sie am Desktop. */
  onPendingChange:
    | ((change: {
        author?: string
        kind: string
        target?: { type: 'cable' | 'equipment'; id?: string; name?: string }
        summary: string
        patch?: Record<string, unknown>
      }) => void)
    | null
}

const state: MobileShareState = {
  server: null,
  port: 0,
  token: '',
  allowBeyondLan: false,
  showId: null,
  project: null,
  serialized: null,
  crewIcs: null,
  rendererDir: '',
  devProxyUrl: undefined,
  onChecksUpdate: null,
  onCableAdded: null,
  onPendingChange: null,
}

/** Loopback or RFC-1918 / link-local / unique-local address? Used to
 *  scope CORS to the LAN so an arbitrary public website can't read our
 *  responses cross-origin. */
const isPrivateHost = (host: string): boolean => {
  const h = host.replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (/^169\.254\./.test(h)) return true
  if (/^fe80:/i.test(h) || /^f[cd][0-9a-f]{2}:/i.test(h)) return true
  return false
}

/** Reflect the request Origin only when it is a private LAN/loopback
 *  origin. Public/unknown origins get no CORS grant. Replaces the old
 *  blanket `Access-Control-Allow-Origin: *`. */
const applyCors = (req: IncomingMessage, res: ServerResponse): void => {
  const origin = req.headers.origin
  if (origin) {
    try {
      if (isPrivateHost(new URL(origin).hostname)) {
        res.setHeader('Access-Control-Allow-Origin', origin)
      }
    } catch {
      /* malformed origin → no grant */
    }
  }
  res.setHeader('Vary', 'Origin')
}

/** Require the per-session token on data/write routes. The token is
 *  handed to the phone via the QR/URL (`?t=…`) and echoed back as a
 *  query param or `X-CP-Token` header on every request. */
const authed = (req: IncomingMessage, url: URL): boolean => {
  if (!state.token) return false
  return req.headers['x-cp-token'] === state.token || url.searchParams.get('t') === state.token
}

const denyUnauthorized = (req: IncomingMessage, res: ServerResponse): void => {
  applyCors(req, res)
  res.statusCode = 401
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end('{"error":"unauthorized"}')
}

/** Lookup non-internal IPv4 addresses across all network interfaces. */
const collectLanAddresses = (): string[] => {
  const result: string[] = []
  const ifaces = networkInterfaces()
  for (const list of Object.values(ifaces)) {
    if (!list) continue
    for (const entry of list) {
      if (entry.family === 'IPv4' && !entry.internal) {
        result.push(entry.address)
      }
    }
  }
  // Always include localhost so the user can verify the server is
  // running even if the LAN listing is empty (no wifi etc.).
  return [...result, '127.0.0.1']
}

const sendFile = (res: ServerResponse, filePath: string) => {
  if (!existsSync(filePath)) {
    res.statusCode = 404
    res.end('Not Found')
    return
  }
  const body = readFileSync(filePath)
  res.statusCode = 200
  res.setHeader('Content-Type', mimeFor(filePath))
  res.setHeader('Cache-Control', 'no-cache')
  // Static shell (HTML/JS/CSS) is served same-origin to the phone, so no
  // CORS grant is needed. Lock the HTML down with a CSP so injected
  // content in a cached/old bundle can't exfiltrate to a third party.
  if (filePath.toLowerCase().endsWith('.html')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; " +
        "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    )
    res.setHeader('X-Content-Type-Options', 'nosniff')
  }
  res.end(body)
}

/** Proxy a static-asset request to the Vite dev server when running
 *  under `npm run dev`. Falls through to a 502 if Vite isn't up. */
const proxyToDev = async (
  res: ServerResponse,
  pathname: string,
  search: string,
): Promise<void> => {
  if (!state.devProxyUrl) {
    res.statusCode = 502
    res.end('Dev proxy URL not configured')
    return
  }
  try {
    const target = `${state.devProxyUrl.replace(/\/$/, '')}${pathname}${search}`
    const upstream = await fetch(target)
    res.statusCode = upstream.status
    upstream.headers.forEach((value, key) => {
      // Strip hop-by-hop headers + content-encoding (we re-emit raw).
      if (
        key.toLowerCase() === 'content-encoding' ||
        key.toLowerCase() === 'transfer-encoding' ||
        key.toLowerCase() === 'connection'
      )
        return
      res.setHeader(key, value)
    })
    // Dev-only Vite proxy: shell assets are same-origin to the phone, so
    // no cross-origin grant is emitted here either.
    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.end(buffer)
  } catch (err) {
    res.statusCode = 502
    res.end(`Dev proxy error: ${(err as Error).message}`)
  }
}

const handleRequest = (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url) {
    res.statusCode = 400
    res.end()
    return
  }
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
  const pathname = url.pathname

  // Project JSON endpoint (token-gated, secrets stripped, cached serialize).
  if (pathname === '/project.json') {
    if (!authed(req, url)) return denyUnauthorized(req, res)
    res.statusCode = state.serialized ? 200 : 503
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    applyCors(req, res)
    res.end(state.serialized ?? '{}')
    return
  }

  /**
   * BEDARF 39 — der abonnierbare Crew-Kalender.
   *
   * Ein FEED und kein Download: „Serve a subscribable webcal:// feed from the
   * local project file rather than an .ics download." Eine heruntergeladene
   * Datei veraltet in dem Moment, in dem sich der Plan aendert — genau der
   * Zustand, den der Bedarf beklagt.
   *
   * Dieselbe Token-Pruefung wie `/project.json`: wer den Plan nicht sehen
   * darf, darf auch nicht wissen, wer wann wo arbeitet. `no-store` steht
   * bewusst NICHT hier — ein Kalender-Abo darf zwischenspeichern, und der
   * `REFRESH-INTERVAL` im Dokument sagt ihm, wie lange.
   */
  if (pathname === '/crew.ics') {
    if (!authed(req, url)) return denyUnauthorized(req, res)
    res.statusCode = state.crewIcs ? 200 : 503
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    // Ein Dateiname fuer die Leser, die doch speichern statt zu abonnieren.
    res.setHeader('Content-Disposition', 'inline; filename="crew.ics"')
    applyCors(req, res)
    res.end(state.crewIcs ?? '')
    return
  }

  /**
   * BEDARF 127 — gehoert dieser Rueckweg zur freigegebenen Show?
   *
   * DIE ENGSTELLE fuer alle drei Schreibwege (`/checks`, `/cables`,
   * `/pending-changes`). Sie fragen hier und vergleichen nicht selbst: drei
   * eigene Vergleiche waeren drei Gelegenheiten, einen zu vergessen — und
   * vergessen wuerde man den seltensten, also den, bei dem es am laengsten
   * niemandem auffaellt.
   *
   * 409 und nicht 400: der Aufruf ist nicht falsch gebaut, er kommt in eine
   * Lage, die sich seit dem Laden der Seite geaendert hat. Der Grund geht
   * mit — eine abgewiesene Rueckmeldung ohne Erklaerung sieht am Handy aus
   * wie ein Netzfehler, und dann drueckt der Field-Tech noch dreimal.
   */
  const showOk = (parsed: Record<string, unknown>): boolean => {
    const sent = typeof parsed.projectId === 'string' && parsed.projectId.trim().length > 0
      ? parsed.projectId
      : null
    const pruefung = showMismatch(state.showId, sent)
    if (pruefung.ok) return true
    res.statusCode = 409
    applyCors(req, res)
    res.end(JSON.stringify({
      error: pruefung.rejection,
      reason: pruefung.reason,
      servedShow: pruefung.served,
    }))
    return false
  }

  // v7.9.3 — POST /checks: das Mobile-View schickt nach jedem Toggle
  // einen vollständigen CheckState. Wir leiten ihn via Callback an
  // den Renderer weiter, der dann project.checkState updated → das
  // Canvas zeigt die Häkchen sofort live an.
  if (pathname === '/checks' && req.method === 'POST') {
    if (!authed(req, url)) return denyUnauthorized(req, res)
    let body = ''
    let aborted = false
    req.on('data', (chunk) => {
      if (aborted) return
      body += chunk
      // Verhindere DoS durch riesige Bodies — 1 MB reicht für tausende Ports.
      if (body.length > 1_000_000) {
        aborted = true
        res.statusCode = 413
        res.end('Payload too large')
        req.destroy()
      }
    })
    req.on('end', () => {
      if (aborted) return
      try {
        const parsed = JSON.parse(body) as {
          projectId?: string
          ports?: Record<string, boolean>
          cables?: Record<string, boolean>
        }
        if (!showOk(parsed)) return
        const checks = {
          ports: parsed.ports && typeof parsed.ports === 'object' ? parsed.ports : {},
          cables: parsed.cables && typeof parsed.cables === 'object' ? parsed.cables : {},
        }
        state.onChecksUpdate?.(checks)
        res.statusCode = 200
        applyCors(req, res)
        res.end('{"ok":true}')
      } catch {
        res.statusCode = 400
        applyCors(req, res)
        res.end('{"error":"invalid json"}')
      }
    })
    return
  }
  // CORS preflight for POST /checks
  if (pathname === '/checks' && req.method === 'OPTIONS') {
    res.statusCode = 204
    applyCors(req, res)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CP-Token')
    res.end()
    return
  }

  // v7.9.54 — POST /cables: das Mobile-View schickt nach Hinzufügen eines
  // neuen Kabels via Dropdown-UI eine Cable-Spec. Wir validieren minimal
  // (alle 4 IDs vorhanden) und leiten an den Renderer-Callback weiter.
  if (pathname === '/cables' && req.method === 'POST') {
    if (!authed(req, url)) return denyUnauthorized(req, res)
    let body = ''
    let aborted = false
    req.on('data', (chunk) => {
      if (aborted) return
      body += chunk
      if (body.length > 100_000) {
        aborted = true
        res.statusCode = 413
        res.end('Payload too large')
        req.destroy()
      }
    })
    req.on('end', () => {
      if (aborted) return
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>
        if (!showOk(parsed)) return
        const fromEquipmentId = String(parsed.fromEquipmentId ?? '').trim()
        const fromPortId = String(parsed.fromPortId ?? '').trim()
        const toEquipmentId = String(parsed.toEquipmentId ?? '').trim()
        const toPortId = String(parsed.toPortId ?? '').trim()
        if (!fromEquipmentId || !fromPortId || !toEquipmentId || !toPortId) {
          res.statusCode = 400
          applyCors(req, res)
          res.end('{"error":"missing endpoint ids"}')
          return
        }
        const cable = {
          fromEquipmentId,
          fromPortId,
          toEquipmentId,
          toPortId,
          name: typeof parsed.name === 'string' ? parsed.name : undefined,
          type: typeof parsed.type === 'string' ? parsed.type : undefined,
          length: typeof parsed.length === 'number' ? parsed.length : undefined,
          color: typeof parsed.color === 'string' ? parsed.color : undefined,
          notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
        }
        state.onCableAdded?.(cable)
        res.statusCode = 200
        applyCors(req, res)
        res.end('{"ok":true}')
      } catch {
        res.statusCode = 400
        applyCors(req, res)
        res.end('{"error":"invalid json"}')
      }
    })
    return
  }
  if (pathname === '/cables' && req.method === 'OPTIONS') {
    res.statusCode = 204
    applyCors(req, res)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CP-Token')
    res.end()
    return
  }

  // Feld-Rückkanal — POST /pending-changes: der Mobile-Companion meldet eine
  // Korrektur/ein Problem. Minimal validiert (summary + kind), Rest reicht der
  // Renderer-Callback in die Review-Queue.
  if (pathname === '/pending-changes' && req.method === 'POST') {
    if (!authed(req, url)) return denyUnauthorized(req, res)
    let body = ''
    let aborted = false
    req.on('data', (chunk) => {
      if (aborted) return
      body += chunk
      if (body.length > 200_000) {
        aborted = true
        res.statusCode = 413
        res.end('Payload too large')
        req.destroy()
      }
    })
    req.on('end', () => {
      if (aborted) return
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>
        if (!showOk(parsed)) return
        const summary = String(parsed.summary ?? '').trim()
        const kind = String(parsed.kind ?? '').trim()
        if (!summary || !kind) {
          res.statusCode = 400
          applyCors(req, res)
          res.end('{"error":"missing summary or kind"}')
          return
        }
        const rawTarget = parsed.target as Record<string, unknown> | undefined
        const target =
          rawTarget && (rawTarget.type === 'cable' || rawTarget.type === 'equipment')
            ? {
                type: rawTarget.type as 'cable' | 'equipment',
                id: typeof rawTarget.id === 'string' ? rawTarget.id : undefined,
                name: typeof rawTarget.name === 'string' ? rawTarget.name : undefined,
              }
            : undefined
        state.onPendingChange?.({
          author: typeof parsed.author === 'string' ? parsed.author : undefined,
          kind,
          summary,
          target,
          patch:
            parsed.patch && typeof parsed.patch === 'object'
              ? (parsed.patch as Record<string, unknown>)
              : undefined,
        })
        res.statusCode = 200
        applyCors(req, res)
        res.end('{"ok":true}')
      } catch {
        res.statusCode = 400
        applyCors(req, res)
        res.end('{"error":"invalid json"}')
      }
    })
    return
  }
  if (pathname === '/pending-changes' && req.method === 'OPTIONS') {
    res.statusCode = 204
    applyCors(req, res)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CP-Token')
    res.end()
    return
  }

  // Health/info endpoint — useful for the renderer to verify
  // the server is alive without round-tripping the whole project.
  if (pathname === '/share-info.json') {
    if (!authed(req, url)) return denyUnauthorized(req, res)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    applyCors(req, res)
    res.end(
      JSON.stringify({
        ok: true,
        hasProject: state.project !== null,
        port: state.port,
        mode: state.devProxyUrl ? 'dev-proxy' : 'static',
      }),
    )
    return
  }

  // Favicon: silently 204 rather than 404 so browsers don't spam logs.
  if (pathname === '/favicon.ico') {
    res.statusCode = 204
    res.end()
    return
  }

  // Static file routing
  if (pathname === '/' || pathname === '/mobile') {
    res.statusCode = 302
    res.setHeader('Location', '/mobile.html')
    res.end()
    return
  }

  // Dev mode: proxy to Vite (files don't exist on disk yet).
  if (state.devProxyUrl) {
    void proxyToDev(res, pathname, url.search)
    return
  }

  // Guard against directory traversal — resolve paths against the
  // renderer dir and reject anything that escapes it. Use path.relative
  // instead of a string `startsWith` (which is bypassable by a sibling
  // dir sharing the prefix, e.g. `<dir>-secrets/`).
  const normalized = pathname.replace(/^\/+/, '')
  const safePath = pathResolve(state.rendererDir, normalized)
  const rel = pathRelative(state.rendererDir, safePath)
  if (rel === '' || rel.startsWith('..') || rel.split(pathSep)[0] === '..') {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }
  sendFile(res, safePath)
}

/** Pick a free port in the 39520..39620 range by trying sequential
 *  bindings. Using a deterministic-ish range makes manual debugging
 *  easier (`curl localhost:39520`) without conflicting with common
 *  dev-server ports (3000/5173/8080). */
const findFreePort = (server: Server): Promise<number> =>
  new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      if (port > 39620) {
        reject(new Error('No free port in 39520..39620 range'))
        return
      }
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Server emits 'error' once per failed listen; rebind next.
          server.close(() => tryPort(port + 1))
        } else {
          reject(err)
        }
      })
      server.listen(port, '0.0.0.0', () => {
        server.removeAllListeners('error')
        resolve(port)
      })
    }
    tryPort(39520)
  })

export interface MobileShareInfo {
  port: number
  urls: string[]
  hasProject: boolean
  /**
   * BEDARF 133 — Adressen, unter denen der Rechner erreichbar ist und die
   * NICHT angeboten werden, mit Grund.
   *
   * Der Dialog zeigt sie. Eine zurueckgehaltene Adresse, die niemand nennt,
   * ist fuer den Nutzer dasselbe wie eine, die es nicht gibt — und dann
   * sucht er den Fehler in der Netzwerktechnik.
   */
  withheld: WithheldAddress[]
}

/** Build the phone-facing viewer URLs, embedding the session token so the
 *  QR/links carry it transparently. */
const buildUrls = (port: number): string[] => {
  const q = state.token ? `?t=${state.token}` : ''
  return shareAddresses(collectLanAddresses(), { allowBeyondLan: state.allowBeyondLan }).offered
    .map((ip) => `http://${ip}:${port}/mobile.html${q}`)
}

/**
 * BEDARF 133 — was NICHT angeboten wird, und warum.
 *
 * Aus DERSELBEN Einordnung wie die angebotenen Adressen (`shareAddresses`):
 * zwei Rechnungen koennten sich widersprechen, und dann stuende eine Adresse
 * oben als angeboten und unten als zurueckgehalten.
 */
const buildWithheld = (): WithheldAddress[] =>
  shareAddresses(collectLanAddresses(), { allowBeyondLan: state.allowBeyondLan }).withheld

export const startMobileShareServer = async (
  rendererDir: string,
  devProxyUrl?: string,
): Promise<MobileShareInfo> => {
  if (state.server) {
    return {
      port: state.port,
      urls: buildUrls(state.port),
      hasProject: state.project !== null,
      withheld: buildWithheld(),
    }
  }
  state.rendererDir = pathResolve(rendererDir)
  state.devProxyUrl = devProxyUrl
  // Fresh per-session token gates all data/write routes.
  state.token = randomBytes(16).toString('hex')
  const server = createServer(handleRequest)
  const port = await findFreePort(server)
  state.server = server
  state.port = port
  return {
    port,
    urls: buildUrls(port),
    hasProject: state.project !== null,
    withheld: buildWithheld(),
  }
}

/**
 * BEDARF 133 — Adressen ueber das LAN hinaus freigeben oder wieder sperren.
 *
 * Eine ausdrueckliche Entscheidung des Nutzers, und sie gilt nur fuer diese
 * Sitzung: `stopMobileShareServer` setzt sie zurueck. Wer den Rechner morgen
 * woanders aufstellt, faengt wieder beim LAN an — eine Freigabe, die eine
 * Ortsaenderung ueberlebt, ist keine Entscheidung ueber DIESES Netz.
 */
export const setMobileShareAllowBeyondLan = (allow: boolean): MobileShareInfo => {
  state.allowBeyondLan = allow
  return {
    port: state.port,
    urls: buildUrls(state.port),
    hasProject: state.project !== null,
    withheld: buildWithheld(),
  }
}

export const stopMobileShareServer = (): void => {
  if (!state.server) return
  state.server.close()
  state.server = null
  state.port = 0
  state.token = ''
  // Die Freigabe gilt fuer DIESES Netz und diese Sitzung. Wer den Rechner
  // morgen woanders aufstellt, faengt wieder beim LAN an.
  state.allowBeyondLan = false
  state.project = null
  state.serialized = null
  state.showId = null
  state.devProxyUrl = undefined
}

export const setMobileShareProject = (project: unknown): void => {
  state.project = project
  // Bedarf 127 — die Show wandert MIT dem Projekt. Wer sie hier nicht
  // nachzieht, laesst die Freigabe auf die alte Show zeigen und nimmt
  // Rueckwege an, die in die neue gehoeren.
  state.showId = showIdOf(project)
  // Strip secrets and pre-serialize once; /project.json serves the cached
  // string so polling phones don't re-stringify the project each request.
  try {
    state.serialized = project !== null && project !== undefined
      ? JSON.stringify(stripSecrets(project))
      : null
  } catch {
    state.serialized = null
  }
}

/**
 * BEDARF 39 — den fertigen Kalendertext hinterlegen.
 *
 * `null` heisst „es gibt keinen", und der Feed antwortet dann mit 503 statt
 * mit einem leeren Kalender: ein leerer Kalender liest sich als „diese Person
 * hat frei", und das ist die eine Auskunft, die dieser Bedarf nie geben darf.
 */
export const setMobileShareCrewCalendar = (ics: string | null): void => {
  state.crewIcs = typeof ics === 'string' && ics.trim() ? ics : null
}

/** v7.9.3 — Registrierung des Callbacks, der vom IPC-Handler im
 *  Main-Prozess aufgerufen wird sobald das Mobile-View POST /checks
 *  geschickt hat. Der Renderer macht daraus dann ein Store-Update. */
export const setMobileShareChecksHandler = (
  handler: ((checks: { ports: Record<string, boolean>; cables: Record<string, boolean> }) => void) | null,
): void => {
  state.onChecksUpdate = handler
}

/** v7.9.54 — Registrierung des Callbacks für vom Mobile-Viewer
 *  hinzugefügte Kabel (POST /cables). */
export const setMobileShareCableAddedHandler = (
  handler:
    | ((cable: {
        fromEquipmentId: string
        fromPortId: string
        toEquipmentId: string
        toPortId: string
        name?: string
        type?: string
        length?: number
        color?: string
        notes?: string
      }) => void)
    | null,
): void => {
  state.onCableAdded = handler
}

/** Feld-Rückkanal — Registrierung des Callbacks für POST /pending-changes. */
export const setMobileSharePendingChangeHandler = (
  handler:
    | ((change: {
        author?: string
        kind: string
        target?: { type: 'cable' | 'equipment'; id?: string; name?: string }
        summary: string
        patch?: Record<string, unknown>
      }) => void)
    | null,
): void => {
  state.onPendingChange = handler
}

export const getMobileShareStatus = (): MobileShareInfo & { running: boolean } => ({
  running: state.server !== null,
  port: state.port,
  urls: state.server ? buildUrls(state.port) : [],
  hasProject: state.project !== null,
  withheld: state.server ? buildWithheld() : [],
})

void __filename // keep ESM file-url alive
