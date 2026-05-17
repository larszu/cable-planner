/**
 * About dialog — surfaces the running app version + build info so the
 * user can tell their installed version apart from what's in a github
 * release. Triggered from the Help menu and from the version chip in
 * the StatusBar.
 *
 * v7.9.44 — Migrated to <ModalShell>.
 */

import { useUiStore } from '../../store/uiStore'
import { ModalShell } from '../shared/ModalShell'
import {
  APP_AUTHOR,
  APP_BUILD_DATE,
  APP_DESCRIPTION,
  APP_REPO_URL,
  APP_VERSION,
} from '../../lib/appInfo'

const buildDateLocal = (() => {
  try {
    return new Date(APP_BUILD_DATE).toLocaleString()
  } catch {
    return APP_BUILD_DATE
  }
})()

export const AboutDialog = () => {
  const open = useUiStore((s) => s.aboutDialog.open)
  const close = useUiStore((s) => s.closeAboutDialog)
  return (
    <ModalShell
      open={open}
      onClose={close}
      title="Über Cable Planner"
      titleIcon="ⓘ"
      maxWidth="md"
      draggableKey="cable-planner:modal-pos:about"
    >
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3 rounded border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-3xl">🔌</div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-100">Cable Planner</div>
            <div className="text-[11px] text-slate-400">{APP_DESCRIPTION}</div>
          </div>
          <div className="ml-auto shrink-0 rounded bg-emerald-700 px-2 py-1 font-mono text-xs text-white">
            v{APP_VERSION}
          </div>
        </div>

        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-slate-500">Version</dt>
          <dd className="font-mono text-slate-100">{APP_VERSION}</dd>
          <dt className="text-slate-500">Build</dt>
          <dd className="font-mono text-slate-100">{buildDateLocal}</dd>
          {APP_AUTHOR && (
            <>
              <dt className="text-slate-500">Autor</dt>
              <dd className="text-slate-100">{APP_AUTHOR}</dd>
            </>
          )}
          <dt className="text-slate-500">Repository</dt>
          <dd>
            <a
              href={APP_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 underline hover:text-sky-300"
            >
              {APP_REPO_URL.replace(/^https?:\/\//, '')}
            </a>
          </dd>
          <dt className="text-slate-500">Plattform</dt>
          <dd className="text-slate-100">
            Electron + React + ReactFlow + Vite + Tailwind
          </dd>
        </dl>

        <div className="rounded border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-400">
          Issues + Feature-Wünsche bitte direkt auf GitHub melden.
        </div>
      </div>
    </ModalShell>
  )
}
