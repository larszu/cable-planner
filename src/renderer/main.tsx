import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'reactflow/dist/style.css'
// Self-hosted Inter (UX audit #26): index.css references "Inter" as the UI
// font but it was never loaded → silent fallback to system-ui. Bundle the
// weights we actually use (regular/medium/semibold/bold) so it ships offline.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { cablePlannerApi } from './lib/bridge'
import { PopoutApp } from './components/Layout/PopoutApp'
import { initPanelPopoutSync, popoutPanel } from './lib/panelPopout'
import { initSettingsSync } from './lib/settingsSync'

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
// v7.8.3 — also include the full stack + window context in every report
// so we can chase intermittent crashes from a single user log file.
const buildContext = (): string => {
  const lines: string[] = []
  const ver = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown'
  lines.push(`App version: ${ver}`)
  lines.push(`Time: ${new Date().toISOString()}`)
  try {
    lines.push(`User-Agent: ${navigator.userAgent}`)
    lines.push(`Window: ${window.innerWidth}x${window.innerHeight}`)
  } catch {
    /* ignore */
  }
  return lines.join('\n')
}

window.addEventListener('error', (event) => {
  try {
    cablePlannerApi.logs.rendererError({
      message: event.message,
      stack: `${buildContext()}\n\n${event.error instanceof Error ? event.error.stack ?? '(no stack)' : '(no Error object)'}`,
      source: `window.error ${event.filename}:${event.lineno}:${event.colno}`,
    })
  } catch { /* ignore */ }
})

window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event.reason
    cablePlannerApi.logs.rendererError({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: `${buildContext()}\n\n${reason instanceof Error ? reason.stack ?? '(no stack)' : '(no Error object)'}`,
      source: 'unhandledrejection',
    })
  } catch { /* ignore */ }
})

// #386 — Mausrad ueber einem fokussierten <input type="number"> aendert in
// Chromium/Electron dessen Wert. Beim Scrollen durch die Eigenschaften-Panels
// (Dimensionen, Strom, Netzwerk, Ports) verstellt das ungewollt Zahlenfelder.
// Capture-Listener: liegt der Fokus auf dem Zahlenfeld unter dem Cursor,
// nehmen wir ihm den Fokus -> das Rad scrollt das Panel statt den Wert zu
// aendern. Tippen/Klicken bleibt unberuehrt.
document.addEventListener(
  'wheel',
  (e) => {
    const el = document.activeElement
    if (
      el instanceof HTMLInputElement &&
      el.type === 'number' &&
      (e.target === el || (e.target instanceof Node && el.contains(e.target)))
    ) {
      el.blur()
    }
  },
  { passive: true, capture: true },
)

// #427 — Cross-Fenster-Sync (Projekt + Auswahl) in JEDEM Fenster starten,
// damit ausgelagerte Panels live mit dem Hauptfenster zusammenarbeiten.
initPanelPopoutSync()
// #427 — Globale Einstellungen (Theme, Sprache, Farben, Routing …) fenster-
// übergreifend synchron halten, damit ein ausgelagertes Settings-Fenster
// sofort aufs Hauptfenster wirkt.
initSettingsSync()

// #427 — Ist dies ein ausgelagertes Panel-Fenster (?popout=…), nur das Panel
// rendern statt der vollen App.
const popout = popoutPanel()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{popout ? <PopoutApp panel={popout} /> : <App />}</ErrorBoundary>
  </StrictMode>,
)
