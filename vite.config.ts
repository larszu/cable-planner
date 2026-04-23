import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
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
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
})
