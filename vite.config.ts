import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// Read version from package.json at build time so the renderer can show
// it in the About dialog + StatusBar without an IPC round-trip. Build
// timestamp is also injected — handy for QA when comparing build hashes.
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as {
  version: string
  description?: string
  author?: { name?: string; email?: string } | string
}

// Prefer git tag over package.json for the runtime version. CI release
// flow taggt vor jedem Build (z.B. v8.0.10), und der User erwartet
// dass die Hilfe-Menue-Version dem Tag entspricht. Fallback auf
// package.json wenn git nicht verfuegbar ist (z.B. tarball-Build).
const resolveAppVersion = (): string => {
  try {
    // `git describe --tags --abbrev=0` → letzter erreichbarer Tag wie "v8.0.10".
    // Wenn HEAD genau auf dem Tag sitzt: nackter Tagname.
    // Wenn HEAD ein paar Commits hinter dem Tag ist: pre-release-Suffix
    // (z.B. "v8.0.10-3-gabcdef") damit man auf einen Blick sieht dass
    // der Build *vor* dem Tag ist und nicht der Release selbst.
    const exact = execSync('git describe --tags --exact-match HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
    if (exact) return exact.replace(/^v/, '')
  } catch {
    /* HEAD ist kein exakter Tag — versuche nearest + suffix */
  }
  try {
    const described = execSync('git describe --tags --always --dirty', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
    if (described) return described.replace(/^v/, '')
  } catch {
    /* kein git verfuegbar — Fallback auf package.json */
  }
  return pkg.version
}

const appVersion = resolveAppVersion()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_DESCRIPTION__: JSON.stringify(pkg.description ?? ''),
    __APP_AUTHOR__: JSON.stringify(
      typeof pkg.author === 'string' ? pkg.author : pkg.author?.name ?? '',
    ),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    // Remove crossorigin attribute so file:// loading works in packaged Electron
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html: string) {
        return html.replace(/ crossorigin/g, '')
      },
    },
  ],
  root: '.',
  // Use relative asset paths so file:// loading from Electron works.
  base: './',
  server: {
    proxy: {
      '/api/rentman': {
        target: 'https://api.rentman.net',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/rentman/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Re-forward Authorization cleanly: take the incoming header value,
            // strip all control/whitespace characters and re-set it. This avoids
            // any duplicate/miscased header mess that can confuse AWS API Gateway.
            const raw = req.headers['authorization']
            const value = Array.isArray(raw) ? raw[0] : raw
            if (value) {
              // eslint-disable-next-line no-control-regex
              const clean = value.replace(/[\u0000-\u001f\u007f-\u00a0\ufeff]/g, '').trim()
              proxyReq.removeHeader('authorization')
              proxyReq.setHeader('Authorization', clean)
            }
            // Prevent any cookies / extra auth from being forwarded.
            proxyReq.removeHeader('cookie')
            // Force standard headers only.
            proxyReq.setHeader('Accept', 'application/json')
            proxyReq.setHeader('User-Agent', 'cable-planner/0.1 (+vite-dev-proxy)')
          })
          proxy.on('proxyRes', (proxyRes) => {
            // Strip any CORS that would confuse the SPA (we're same-origin via proxy).
            delete proxyRes.headers['access-control-allow-origin']
          })
          proxy.on('error', (err, _req, res) => {
            console.error('[rentman-proxy] error:', err.message)
            if (res && 'writeHead' in res) {
              try {
                res.writeHead(502, { 'content-type': 'application/json' })
                res.end(JSON.stringify({ message: `Proxy error: ${err.message}` }))
              } catch {
                /* ignore */
              }
            }
          })
        },
      },
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Desktop renderer (loaded by Electron from index.html).
        main: resolve(__dirname, 'index.html'),
        // Issue #73: read-only mobile viewer. Loads a project JSON
        // and lets the field tech tick off ports they've already
        // plugged. Ship together with the desktop build so users
        // can open dist/renderer/mobile.html in any browser.
        mobile: resolve(__dirname, 'mobile.html'),
        // #143: zero-install read-only web viewer for external reviewers.
        // Renders the plan from a loaded .cpviewer/.json standalone in any
        // browser — no Electron, no editor surfaces.
        viewer: resolve(__dirname, 'viewer.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
})
