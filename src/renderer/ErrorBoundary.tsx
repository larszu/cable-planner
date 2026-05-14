import { Component, type ErrorInfo, type ReactNode } from 'react'
import { cablePlannerApi } from './lib/bridge'

interface State {
  error: Error | null
  autoRecovered: boolean
}

interface Props {
  children: ReactNode
}

/** Boot-loop tracker — persists across the auto-reload. If the same
 *  ErrorBoundary fires twice within RECOVERY_WINDOW ms, we wipe the
 *  cable-planner localStorage entries (which is the most common
 *  trigger for a render-loop on mount: a corrupt autosaved project or
 *  ui-store schema mismatch). The user no longer has to click the
 *  "reset" button — the app self-recovers and reloads. */
const BOOT_ERROR_KEY = 'cable-planner:boot-error-ts'
const RECOVERY_WINDOW_MS = 10_000

const wipeLocalState = () => {
  try {
    const drop: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('cable-planner:')) drop.push(k)
    }
    for (const k of drop) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

/**
 * Catches any uncaught render-time errors (including React #185 / #300) so
 * the user sees a readable message instead of a black screen, and reports
 * details to the main process for `renderer-error.log`.
 *
 * Auto-recovery: when the boundary catches an error and one was already
 * caught in the last 10 s (tracked in `cable-planner:boot-error-ts`),
 * we wipe the cable-planner localStorage entries and reload. This breaks
 * the boot loop that a corrupt autosave / ui-store can cause. The user
 * still sees the error screen on the SINGLE crash so we don't silently
 * eat reports.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, autoRecovered: false }

  static getDerivedStateFromError(error: Error): State {
    return { error, autoRecovered: false }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      cablePlannerApi.logs.rendererError({
        message: error.message,
        stack: `${error.stack ?? ''}\n--- componentStack ---\n${info.componentStack ?? ''}`,
        source: 'ErrorBoundary',
      })
    } catch {
      /* ignore */
    }
    // Boot-loop detection.
    try {
      const now = Date.now()
      const previousStr = localStorage.getItem(BOOT_ERROR_KEY)
      const previous = previousStr ? parseInt(previousStr, 10) : 0
      if (previous && now - previous < RECOVERY_WINDOW_MS) {
        // Second crash in the recovery window — wipe and reload.
        wipeLocalState()
        localStorage.removeItem(BOOT_ERROR_KEY)
        this.setState({ autoRecovered: true })
        window.setTimeout(() => location.reload(), 200)
        return
      }
      localStorage.setItem(BOOT_ERROR_KEY, String(now))
    } catch {
      /* ignore */
    }
  }

  render() {
    if (this.state.error) {
      const err = this.state.error
      return (
        <div style={{
          padding: 24,
          color: 'var(--cp-text, #e2e8f0)',
          background: 'var(--cp-bg, #0f172a)',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
          overflow: 'auto',
        }}>
          <h1 style={{ color: '#fca5a5', marginBottom: 12 }}>Cable Planner – Fehler beim Start</h1>
          {this.state.autoRecovered && (
            <div style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 6,
              background: '#0f3a30',
              border: '1px solid #047857',
              color: '#a7f3d0',
            }}>
              ⚙ Boot-Loop erkannt — lokale Cable-Planner-Daten wurden automatisch
              zurückgesetzt. Die App lädt gleich neu.
            </div>
          )}
          <p style={{ marginBottom: 8 }}>
            Ein unerwarteter Fehler ist aufgetreten. Details wurden in
            <code style={{ margin: '0 4px' }}>%APPDATA%\cable-planner\renderer-error.log</code>
            gespeichert.
          </p>
          <pre style={{
            background: '#1e293b',
            padding: 12,
            borderRadius: 6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 12,
          }}>
            {err.name}: {err.message}
            {'\n\n'}
            {err.stack}
          </pre>
          <button
            onClick={() => {
              try {
                localStorage.clear()
              } catch { /* ignore */ }
              location.reload()
            }}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Lokale Daten zurücksetzen und neu laden
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
