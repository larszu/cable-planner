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
 * Security note: server is bound to 0.0.0.0 (LAN). No write
 * endpoints. If a token gate is needed later we'd add a random
 * token to the URL and require it in `/project.json`. For a small
 * studio LAN the absence of write endpoints is the right tradeoff
 * between zero-config and security.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'

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
  project: unknown | null
  /** Absolute path to dist/renderer (where mobile.html + assets live). */
  rendererDir: string
  /** When set (e.g. `npm run dev`), static-asset requests are proxied
   *  here instead of read from disk so the phone can also load the
   *  mobile viewer from a Vite-served HMR build. */
  devProxyUrl: string | undefined
}

const state: MobileShareState = {
  server: null,
  port: 0,
  project: null,
  rendererDir: '',
  devProxyUrl: undefined,
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
  // Allow access from the phone over the LAN. Same-origin already
  // satisfies the browser since mobile.html and /project.json are
  // both served from this server; the CORS header is defensive in
  // case the user opens an old cached mobile bundle from elsewhere.
  res.setHeader('Access-Control-Allow-Origin', '*')
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
    res.setHeader('Access-Control-Allow-Origin', '*')
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

  // Project JSON endpoint
  if (pathname === '/project.json') {
    res.statusCode = state.project ? 200 : 503
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(state.project ? JSON.stringify(state.project) : '{}')
    return
  }

  // Health/info endpoint — useful for the renderer to verify
  // the server is alive without round-tripping the whole project.
  if (pathname === '/share-info.json') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
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
  // renderer dir and reject anything that escapes it.
  const normalized = pathname.replace(/^\/+/, '')
  const safePath = pathResolve(state.rendererDir, normalized)
  if (!safePath.startsWith(state.rendererDir)) {
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
}

export const startMobileShareServer = async (
  rendererDir: string,
  devProxyUrl?: string,
): Promise<MobileShareInfo> => {
  if (state.server) {
    return {
      port: state.port,
      urls: collectLanAddresses().map((ip) => `http://${ip}:${state.port}/mobile.html`),
      hasProject: state.project !== null,
    }
  }
  state.rendererDir = pathResolve(rendererDir)
  state.devProxyUrl = devProxyUrl
  const server = createServer(handleRequest)
  const port = await findFreePort(server)
  state.server = server
  state.port = port
  return {
    port,
    urls: collectLanAddresses().map((ip) => `http://${ip}:${port}/mobile.html`),
    hasProject: state.project !== null,
  }
}

export const stopMobileShareServer = (): void => {
  if (!state.server) return
  state.server.close()
  state.server = null
  state.port = 0
  state.project = null
  state.devProxyUrl = undefined
}

export const setMobileShareProject = (project: unknown): void => {
  state.project = project
}

export const getMobileShareStatus = (): MobileShareInfo & { running: boolean } => ({
  running: state.server !== null,
  port: state.port,
  urls: state.server
    ? collectLanAddresses().map((ip) => `http://${ip}:${state.port}/mobile.html`)
    : [],
  hasProject: state.project !== null,
})

void __filename // keep ESM file-url alive
