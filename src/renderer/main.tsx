import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'reactflow/dist/style.css'
import './index.css'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { cablePlannerApi } from './lib/bridge'

// v7.8.2 — Emergency escape hatch: launch with ?reset (or hash #reset)
// to wipe all cable-planner localStorage entries before any module
// imports get to read them. Useful when a previous boot left the store
// in a state that re-triggers the crash on every startup. The user
// reaches this by editing the Electron URL in DevTools, or by
// launching the desktop shell with `--reset` (main process appends the
// query param to the renderer URL when that flag is passed).
try {
  const url = new URL(window.location.href)
  if (url.searchParams.has('reset') || window.location.hash === '#reset') {
    const drop: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('cable-planner')) drop.push(k)
    }
    for (const k of drop) localStorage.removeItem(k)
    // Strip the marker so a subsequent reload doesn't keep wiping.
    url.searchParams.delete('reset')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash.replace(/#reset$/, '')}`)
  }
} catch {
  /* localStorage may be unavailable — just continue */
}

// Report uncaught renderer errors to the main process so they land in
// `%APPDATA%\cable-planner\renderer-error.log` even when DevTools is closed.
window.addEventListener('error', (event) => {
  try {
    cablePlannerApi.logs.rendererError({
      message: event.message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      source: `window.error ${event.filename}:${event.lineno}:${event.colno}`,
    })
  } catch { /* ignore */ }
})

window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event.reason
    cablePlannerApi.logs.rendererError({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      source: 'unhandledrejection',
    })
  } catch { /* ignore */ }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
