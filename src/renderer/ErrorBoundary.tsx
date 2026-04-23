import { Component, type ErrorInfo, type ReactNode } from 'react'
import { cablePlannerApi } from './lib/bridge'

interface State {
  error: Error | null
}

interface Props {
  children: ReactNode
}

/**
 * Catches any uncaught render-time errors (including React #185 / #300) so
 * the user sees a readable message instead of a black screen, and reports
 * details to the main process for `renderer-error.log`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
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
  }

  render() {
    if (this.state.error) {
      const err = this.state.error
      return (
        <div style={{
          padding: 24,
          color: '#e2e8f0',
          background: '#0f172a',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
          overflow: 'auto',
        }}>
          <h1 style={{ color: '#fca5a5', marginBottom: 12 }}>Cable Planner – Fehler beim Start</h1>
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
