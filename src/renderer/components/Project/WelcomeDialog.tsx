import { useEffect, useState } from 'react'
import { cablePlannerApi } from '../../lib/bridge'

interface WelcomeDialogProps {
  open: boolean
  onNew: () => void
  onOpen: () => void
  onClose: () => void
}

/**
 * First-launch project chooser. Shown when the app starts with no autosaved
 * project state — forces the user to either create a new project (so it has
 * a name + metadata that gets saved into the project file) or open an
 * existing one. Without this prompt, users would otherwise paint a full plan
 * onto the default empty project and forget to "Speichern unter…", losing
 * everything if they cleared their browser/localStorage.
 */
export const WelcomeDialog = ({ open, onNew, onOpen, onClose }: WelcomeDialogProps) => {
  const [recents, setRecents] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    cablePlannerApi.project
      .getRecentProjects()
      .then((list) => setRecents(list ?? []))
      .catch(() => setRecents([]))
  }, [open])

  if (!open) return null

  const fileNameOf = (full: string): string => {
    const parts = full.split(/[\\/]/)
    return parts[parts.length - 1] || full
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
      onMouseDown={(event) => {
        // Block click-through-to-canvas; do NOT close on backdrop click —
        // the user must make an explicit choice on first launch.
        event.stopPropagation()
      }}
    >
      <div className="w-[520px] max-w-[95vw] rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        <header className="border-b border-slate-700 px-5 py-3">
          <h2 className="text-base font-semibold">Willkommen beim Cable Planner</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Lege ein neues Projekt an oder öffne ein bestehendes, damit deine Arbeit
            zuverlässig gespeichert wird.
          </p>
        </header>

        <div className="space-y-2 px-5 py-4">
          <button
            type="button"
            onClick={() => {
              onNew()
              onClose()
            }}
            className="flex w-full items-start gap-3 rounded border border-slate-700 bg-slate-800 px-3 py-2.5 text-left hover:border-emerald-500 hover:bg-slate-700"
          >
            <span className="text-xl">📄</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Neues Projekt</span>
              <span className="block text-[11px] text-slate-400">
                Mit Projektname, Auftraggeber und Planer starten.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpen()
              onClose()
            }}
            className="flex w-full items-start gap-3 rounded border border-slate-700 bg-slate-800 px-3 py-2.5 text-left hover:border-sky-500 hover:bg-slate-700"
          >
            <span className="text-xl">📂</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Projekt öffnen…</span>
              <span className="block text-[11px] text-slate-400">
                Eine vorhandene <code className="rounded bg-slate-950 px-1">.cableplan</code>-Datei laden.
              </span>
            </span>
          </button>

          {recents.length > 0 && (
            <div className="pt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Zuletzt verwendet
              </div>
              <div className="max-h-32 space-y-1 overflow-auto">
                {recents.slice(0, 6).map((path) => (
                  <div
                    key={path}
                    className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-400"
                    title={path}
                  >
                    <span>🕘</span>
                    <span className="min-w-0 flex-1 truncate">{fileNameOf(path)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Klick „Projekt öffnen…“ und wähle eine der Dateien im Datei-Dialog.
              </p>
            </div>
          )}
        </div>

        <footer className="flex justify-end border-t border-slate-700 px-5 py-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            title="Ohne Auswahl fortfahren — bitte denke daran, manuell zu speichern."
          >
            Später entscheiden
          </button>
        </footer>
      </div>
    </div>
  )
}
