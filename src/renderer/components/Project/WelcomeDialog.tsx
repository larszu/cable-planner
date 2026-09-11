import { useEffect, useState } from 'react'
import { FileText, FolderOpen, Clock } from 'lucide-react'
import { cablePlannerApi } from '../../lib/bridge'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { useTranslation } from '../../lib/i18n'

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
 *
 * v7.9.44 — Migrated to <ModalShell>.
 */
export const WelcomeDialog = ({ open, onNew, onOpen, onClose }: WelcomeDialogProps) => {
  const t = useTranslation()
  const [recents, setRecents] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    cablePlannerApi.project
      .getRecentProjects()
      .then((list) => setRecents(list ?? []))
      .catch(() => setRecents([]))
  }, [open])

  const fileNameOf = (full: string): string => {
    const parts = full.split(/[\\/]/)
    return parts[parts.length - 1] || full
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('project.welcome.title', 'Welcome to Cable Planner')}
      maxWidth="lg"
      zIndex={60}
      closeOnBackdrop={false}
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-cp-surface-2 px-3 py-1 text-cp-xs text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text-bright"
            title={t(
              'project.welcome.laterTitle',
              'Continue without choosing — remember to save manually.',
            )}
          >
            {t('project.welcome.later', 'Decide later')}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-cp-xs text-cp-text-muted">
        {t(
          'project.welcome.intro',
          'Create a new project or open an existing one so your work is saved reliably.',
        )}
      </p>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            onNew()
            onClose()
          }}
          className="flex w-full items-start gap-3 border border-cp-border bg-cp-surface-2 px-3 py-2.5 text-left hover:border-emerald-500 hover:bg-cp-surface-4"
        >
          <Icon icon={FileText} size="lg" className="mt-0.5 text-emerald-400" />
          <span className="flex-1">
            <span className="block text-cp-base font-semibold">
              {t('project.welcome.newTitle', 'New project')}
            </span>
            <span className="block text-cp-xs text-cp-text-muted">
              {t('project.welcome.newSubtitle', 'Start with project name, client and planner.')}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onOpen()
            onClose()
          }}
          className="flex w-full items-start gap-3 border border-cp-border bg-cp-surface-2 px-3 py-2.5 text-left hover:border-sky-500 hover:bg-cp-surface-4"
        >
          <Icon icon={FolderOpen} size="lg" className="mt-0.5 text-sky-400" />
          <span className="flex-1">
            <span className="block text-cp-base font-semibold">
              {t('project.welcome.openTitle', 'Open project…')}
            </span>
            <span className="block text-cp-xs text-cp-text-muted">
              {t('project.welcome.openSubtitle1', 'Load an existing')}{' '}
              <code className="bg-cp-surface-3 px-1">.cableplan</code>
              {t('project.welcome.openSubtitle2', ' file.')}
            </span>
          </span>
        </button>

        {recents.length > 0 && (
          <div className="pt-2">
            <div className="mb-1 text-cp-xs font-semibold uppercase tracking-wider text-cp-text-muted">
              {t('project.welcome.recents', 'Recently used')}
            </div>
            <div className="max-h-32 space-y-1 overflow-auto">
              {recents.slice(0, 6).map((path) => (
                <div
                  key={path}
                  className="flex items-center gap-2 border border-cp-border-muted bg-cp-surface-3/40 px-2 py-1 text-cp-xs text-cp-text-muted"
                  title={path}
                >
                  <Icon icon={Clock} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{fileNameOf(path)}</span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-cp-xs text-cp-text-muted">
              {t(
                'project.welcome.recentsHint',
                'Click "Open project…" and choose one of the files in the file picker.',
              )}
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  )
}
