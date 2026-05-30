import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ClipboardCopy, RotateCcw, Trash2 } from 'lucide-react'
import { cablePlannerApi } from './lib/bridge'
import { confirmDialog } from './lib/confirmDialog'
import { translate } from './lib/i18n'
import { Icon } from './components/shared/Icon'
import { useUiStore } from './store/uiStore'

interface State {
  error: Error | null
  errorInfo: ErrorInfo | null
  autoRecovered: boolean
  /** Did the auto-recovery actually save the project? Shown to the user
   *  so they know their work is safe. */
  projectBackedUp: boolean
}

interface Props {
  children: ReactNode
}

/** Boot-loop tracker — persists across the auto-reload. */
import { STORAGE_KEYS } from './lib/storageKeys'

const BOOT_ERROR_KEY = STORAGE_KEYS.bootErrorTs
const RECOVERY_WINDOW_MS = 10_000

/** v7.8.3 — keys whose values are USER DATA and must NEVER be wiped
 *  automatically. Wiping these previously caused the user to lose their
 *  in-progress canvas without any chance to save. The auto-recovery now
 *  only resets UI state (panel positions, theme, hotkeys) — anything
 *  carrying actual content is preserved. */
const PROTECTED_KEY_PATTERNS: RegExp[] = [
  /^cable-planner:projectAutosave$/,
  /^cable-planner:customLibrary$/,
  /^cable-planner:knownCategories$/,
  /^cable-planner:groupPresets$/,
  /^cable-planner:rack-builder:draft/,
  /^cable-planner:cachedRentmanTemplates$/,
  /^cable-planner-mobile:/,
  /^cable-planner:projectBackup:/,
]

const isProtectedKey = (k: string): boolean =>
  PROTECTED_KEY_PATTERNS.some((re) => re.test(k))

/** Snapshot every cable-planner key (with size) for the crash log so we
 *  can see what state the renderer was in when it died. Truncates values
 *  larger than 200 chars to keep the log readable. */
const snapshotLocalStorage = (): string => {
  const lines: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('cable-planner')) continue
      const v = localStorage.getItem(k) ?? ''
      const size = v.length
      const preview =
        v.length > 200 ? `${v.slice(0, 200)}… (${size} bytes total)` : v
      lines.push(`  ${k} (${size}b): ${preview}`)
    }
  } catch (e) {
    lines.push(`  [snapshot failed: ${e instanceof Error ? e.message : String(e)}]`)
  }
  return lines.length > 0 ? lines.join('\n') : '  (no cable-planner keys)'
}

/** Copy projectAutosave to a timestamped backup slot before any wipe so
 *  the user can recover their work even if the auto-recovery decides
 *  the autosave itself was the trigger. Returns true if a backup was
 *  written. Backups never expire automatically — better to leak a few
 *  KB of localStorage than to lose hours of work. */
const backupProjectAutosave = (): boolean => {
  try {
    const auto = localStorage.getItem('cable-planner:projectAutosave')
    if (!auto) return false
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    localStorage.setItem(`cable-planner:projectBackup:${ts}`, auto)
    return true
  } catch {
    return false
  }
}

/** Wipe ONLY non-protected entries. */
const wipeNonProtectedState = () => {
  try {
    const drop: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('cable-planner') && !isProtectedKey(k)) drop.push(k)
    }
    for (const k of drop) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

/** Total nuclear wipe — only used by the manual button on the error
 *  screen, after explicit user confirmation. Backs up the project
 *  first so even the manual reset preserves their data. */
const wipeEverything = () => {
  backupProjectAutosave()
  try {
    const drop: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      // Keep backup keys so user can restore later via the picker.
      if (k && k.startsWith('cable-planner') && !/^cable-planner:projectBackup:/.test(k)) {
        drop.push(k)
      }
    }
    for (const k of drop) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
}

/** Render-loop errors (React #185 / #310 / "Maximum update depth")
 *  cause a deep stack of re-renders that crashes before the
 *  componentDidCatch handler can mark a second-crash timestamp. */
const isRenderLoopError = (error: Error): boolean => {
  const msg = `${error.name ?? ''} ${error.message ?? ''}`
  return (
    /Minified React error #1?(85|85;|85 )/.test(msg) ||
    /Minified React error #310/.test(msg) ||
    /Maximum update depth exceeded/i.test(msg)
  )
}

/**
 * Catches any uncaught render-time errors so the user sees a readable
 * message instead of a black screen, and reports details to the main
 * process for `renderer-error.log`.
 *
 * v7.8.3 changes vs v7.8.1:
 *   - Auto-recovery NEVER touches user data. Only UI state (panel
 *     positions, theme, hotkeys, etc.) is reset. The autosaved
 *     project, custom library, group presets, rack drafts, mobile
 *     check-list progress and Rentman cache are preserved.
 *   - The autosaved project is also COPIED to a timestamped backup
 *     slot (`cable-planner:projectBackup:<ISO>`) before any wipe so
 *     the user can roll back even if a follow-up bug corrupts it.
 *   - Detailed crash diagnostics are written to renderer-error.log:
 *     full stack + componentStack + appVersion + userAgent + a
 *     snapshot of every cable-planner localStorage key with size +
 *     truncated value preview. Makes it possible to chase the React
 *     #185 root cause from a single user report.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    errorInfo: null,
    autoRecovered: false,
    projectBackedUp: false,
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null, autoRecovered: false, projectBackedUp: false }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Build a rich diagnostic blob first — same content goes to the
    // main-process log and to React state so the error screen can
    // surface it for the user to copy-paste back to us.
    const diagnostic = this.buildDiagnostic(error, info)

    // Always log to renderer-error.log via the bridge. Wrapped in a
    // try because the bridge IPC might fail when the renderer is
    // mid-crash.
    try {
      cablePlannerApi.logs.rendererError({
        message: error.message,
        stack: diagnostic,
        source: 'ErrorBoundary',
      })
    } catch {
      /* ignore */
    }

    // Console too — DevTools users see the full picture even if the
    // bridge call dropped.
    try {
      console.error('[Cable Planner ErrorBoundary]', error, info, '\nDIAGNOSTIC:\n', diagnostic)
    } catch {
      /* ignore */
    }

    this.setState({ errorInfo: info })

    // Render-loop short-circuit: backup, wipe NON-PROTECTED state,
    // reload. User data (project autosave, library, etc.) survives.
    if (isRenderLoopError(error)) {
      const projectBackedUp = backupProjectAutosave()
      try {
        wipeNonProtectedState()
        localStorage.removeItem(BOOT_ERROR_KEY)
      } catch {
        /* ignore */
      }
      this.setState({ autoRecovered: true, projectBackedUp })
      // Longer delay so the user can READ the recovery banner before
      // the page reloads.
      window.setTimeout(() => location.reload(), 2500)
      return
    }

    // Generic two-strike boot-loop fallback (other render errors).
    try {
      const now = Date.now()
      const previousStr = localStorage.getItem(BOOT_ERROR_KEY)
      const previous = previousStr ? parseInt(previousStr, 10) : 0
      if (previous && now - previous < RECOVERY_WINDOW_MS) {
        const projectBackedUp = backupProjectAutosave()
        wipeNonProtectedState()
        localStorage.removeItem(BOOT_ERROR_KEY)
        this.setState({ autoRecovered: true, projectBackedUp })
        window.setTimeout(() => location.reload(), 2500)
        return
      }
      localStorage.setItem(BOOT_ERROR_KEY, String(now))
    } catch {
      /* ignore */
    }
  }

  /** Compose the full crash diagnostic. Goes into both the renderer
   *  log and the on-screen <pre> so the user can copy-paste it back. */
  private buildDiagnostic(error: Error, info: ErrorInfo): string {
    const parts: string[] = []
    const appVersion =
      typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown'
    parts.push(`App version: ${appVersion}`)
    parts.push(`Time: ${new Date().toISOString()}`)
    try {
      parts.push(`User-Agent: ${navigator.userAgent}`)
    } catch {
      /* ignore */
    }
    try {
      parts.push(`Window: ${window.innerWidth}x${window.innerHeight}`)
    } catch {
      /* ignore */
    }
    parts.push('')
    parts.push(`Error: ${error.name}: ${error.message}`)
    parts.push('')
    parts.push('Stack:')
    parts.push(error.stack ?? '(no stack)')
    parts.push('')
    parts.push('Component stack:')
    parts.push(info.componentStack ?? '(no component stack)')
    parts.push('')
    parts.push('localStorage snapshot (cable-planner keys only):')
    parts.push(snapshotLocalStorage())
    return parts.join('\n')
  }

  render() {
    if (this.state.error) {
      const err = this.state.error
      const diagnostic = this.state.errorInfo
        ? this.buildDiagnostic(err, this.state.errorInfo)
        : `${err.name}: ${err.message}\n\n${err.stack ?? ''}`
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
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Boot-Loop erkannt — UI-Einstellungen wurden automatisch zurückgesetzt.
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                ✅ <strong>Deine Projekt-Daten sind sicher</strong>: das Autosave,
                die lokale Library, gespeicherte Gruppen und Rack-Entwürfe wurden
                NICHT gelöscht.
                {this.state.projectBackedUp && (
                  <> Zusätzlich wurde eine Sicherheitskopie des Autosaves angelegt
                  (<code>cable-planner:projectBackup:&lt;Zeit&gt;</code> in localStorage).</>
                )}
                <br />
                Die App lädt in 2 s neu — du landest direkt wieder in deinem Projekt.
              </div>
            </div>
          )}
          <p style={{ marginBottom: 8 }}>
            Ein unerwarteter Fehler ist aufgetreten. Details wurden in
            <code style={{ margin: '0 4px' }}>%APPDATA%\cable-planner\renderer-error.log</code>
            gespeichert.
          </p>
          <p style={{ marginBottom: 8, fontSize: 13, color: '#94a3b8' }}>
            Bitte den vollständigen Text unten kopieren und an den Entwickler
            weitergeben — das hilft, den Bug endgültig zu finden.
          </p>
          <pre style={{
            background: '#1e293b',
            padding: 12,
            borderRadius: 6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 11,
            maxHeight: '50vh',
            overflow: 'auto',
          }}>
            {diagnostic}
          </pre>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                try {
                  void navigator.clipboard.writeText(diagnostic)
                } catch { /* ignore */ }
              }}
              style={{
                padding: '8px 16px',
                background: '#0284c7',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon icon={ClipboardCopy} size="sm" /> Diagnose kopieren
            </button>
            <button
              type="button"
              onClick={() => location.reload()}
              style={{
                padding: '8px 16px',
                background: '#475569',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon icon={RotateCcw} size="sm" /> Nur neu laden (nichts löschen)
            </button>
            <button
              type="button"
              onClick={async () => {
                const lang = useUiStore.getState().language
                if (
                  !(await confirmDialog(translate(lang, 'errorBoundary.resetTitle', 'Lokale Daten zurücksetzen?'), {
                    body: translate(
                      lang,
                      'errorBoundary.resetBody',
                      'Eine Sicherheitskopie deines Projekts wird vorher angelegt (cable-planner:projectBackup:<Zeit> in localStorage).\n\nSoll wirklich zurückgesetzt und neu geladen werden?',
                    ),
                    okLabel: translate(lang, 'common.reset', 'Zurücksetzen'),
                    destructive: true,
                  }))
                ) {
                  return
                }
                wipeEverything()
                location.reload()
              }}
              style={{
                padding: '8px 16px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon icon={Trash2} size="sm" /> Lokale Daten zurücksetzen (mit Backup)
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
