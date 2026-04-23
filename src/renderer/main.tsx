import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'reactflow/dist/style.css'
import './index.css'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { cablePlannerApi } from './lib/bridge'

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
