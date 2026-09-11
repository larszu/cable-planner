// #412 — Revisionen/Snapshots-Verwaltung.
//
// Schreibt benannte Plan-Stände fest (Label, Notiz, As-Built-Flag) und stellt
// einen früheren Stand wieder her. Adressiert Revision- UND As-Built-Wünsche:
// der Field-Tech kann „As-Built" festschreiben, der Planer später vergleichen.

import { useState } from 'react'
import { History, RotateCcw, Trash2, Camera } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { confirmDialog } from '../../lib/confirmDialog'
import { useTranslation } from '../../lib/i18n'

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export const RevisionsDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.revisions.open)
  const close = useUiStore((s) => s.closeRevisions)
  // WICHTIG: `?? []` MUSS ausserhalb des Selectors stehen. Ein Selector der
  // `s.project.revisions ?? []` zurueckgibt liefert bei fehlendem Feld bei
  // JEDEM Render ein neues leeres Array → zustand v5 (useSyncExternalStore)
  // sieht den Snapshot als geaendert → "Maximum update depth exceeded".
  const revisions = useProjectStore((s) => s.project.revisions) ?? []
  const commitRevision = useProjectStore((s) => s.commitRevision)
  const restoreRevision = useProjectStore((s) => s.restoreRevision)
  const deleteRevision = useProjectStore((s) => s.deleteRevision)

  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const [asBuilt, setAsBuilt] = useState(false)

  if (!open) return null

  const commit = () => {
    commitRevision(label, note, asBuilt)
    setLabel('')
    setNote('')
    setAsBuilt(false)
  }

  const restore = async (id: string, revLabel: string) => {
    const ok = await confirmDialog(
      t('revisions.restoreConfirm', 'Restore this state?'),
      {
        body: t(
          'revisions.restoreBody',
          'The current plan will be replaced by revision "{label}". The revision history is kept.',
        ).replace('{label}', revLabel),
        okLabel: t('revisions.restore', 'Restore'),
      },
    )
    if (ok) restoreRevision(id)
  }

  const remove = async (id: string, revLabel: string) => {
    const ok = await confirmDialog(
      t('revisions.deleteConfirm', 'Delete revision?'),
      {
        body: t('revisions.deleteBody', 'Revision "{label}" will be removed permanently.').replace(
          '{label}',
          revLabel,
        ),
        okLabel: t('revisions.delete', 'Delete'),
        destructive: true,
      },
    )
    if (ok) deleteRevision(id)
  }

  // Neueste zuerst.
  const sorted = [...revisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('revisions.title', 'Revisions & snapshots')}
      titleIcon={<Icon icon={History} size="sm" />}
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:revisions"
    >
      <div className="flex flex-col gap-3">
        {/* Festschreiben */}
        <div className="border border-cp-border bg-cp-surface-1/40 p-2">
          <div className="mb-1.5 text-cp-xs font-semibold text-cp-text-secondary">
            {t('revisions.commitTitle', 'Commit current state')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('revisions.labelPlaceholder', 'Label (e.g. "A", "Rev 2")')}
              className="w-32 border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('revisions.notePlaceholder', 'Note: what changed?')}
              className="flex-1 border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
            />
            <label className="flex items-center gap-1 text-cp-xs text-cp-text-secondary">
              <input
                type="checkbox"
                checked={asBuilt}
                onChange={(e) => setAsBuilt(e.target.checked)}
              />
              {t('revisions.asBuilt', 'As-built')}
            </label>
            <button
              type="button"
              onClick={commit}
              className="inline-flex items-center gap-1 bg-emerald-700 px-3 py-1 text-cp-xs hover:bg-emerald-600"
            >
              <Icon icon={Camera} size="xs" />
              {t('revisions.commit', 'Commit')}
            </button>
          </div>
        </div>

        {/* Liste */}
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-cp-xs text-cp-text-faint">
            {t('revisions.empty', 'No revisions committed yet.')}
          </p>
        ) : (
          <ul className="divide-y divide-cp-surface-2/60">
            {sorted.map((rev) => (
              <li key={rev.id} className="flex items-center gap-2 py-1.5 text-cp-xs">
                <span
                  className={` px-1.5 py-0.5 font-bold ${
                    rev.asBuilt ? 'bg-amber-600 text-amber-50' : 'bg-cp-surface-4 text-cp-text-bright'
                  }`}
                >
                  {rev.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-cp-text-secondary">{rev.note || '—'}</span>
                  <span className="ml-2 text-cp-text-faint">{fmtDate(rev.createdAt)}</span>
                  {rev.asBuilt && (
                    <span className="ml-1 text-amber-400">· {t('revisions.asBuiltTag', 'As-built')}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => void restore(rev.id, rev.label)}
                  title={t('revisions.restore', 'Restore')}
                  className="inline-flex items-center gap-1 bg-sky-700 px-2 py-1 hover:bg-sky-600"
                >
                  <Icon icon={RotateCcw} size="xs" />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(rev.id, rev.label)}
                  title={t('revisions.delete', 'Delete')}
                  className="inline-flex items-center gap-1 bg-red-900/60 px-2 py-1 hover:bg-red-800"
                >
                  <Icon icon={Trash2} size="xs" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-cp-xs text-cp-text-muted">
          {t(
            'revisions.footerHint',
            'A revision stores a full snapshot of the plan. Restoring keeps the history.',
          )}
        </p>
      </div>
    </ModalShell>
  )
}
