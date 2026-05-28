// v7.9.3 — Annotations-Panel für Viewer-Modus (User-Request:
// "Vielleicht sogar so das man den plan als 'Viewer' datei exportiert
// dann können externe das in dem cable planner nativ sehen und notizen
// machen und kommentieren was geändert werden soll oder was
// physikalisch auf einem auftrag schon gebaut wurde, aber nicht den
// ursprünglichen plan verändern.")
//
// Sidebar mit Liste aller Anmerkungen, gruppiert nach Author und Status.
// Im Viewer-Modus zusätzlich ein "+ Anmerkung an diese Position"-Button.

import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { promptDialog } from '../../lib/promptDialog'
import { format, useTranslation } from '../../lib/i18n'
import { confirmDialog } from '../../lib/confirmDialog'
import type { ProjectAnnotation } from '../../types/project'

// v7.9.41 — Re-export für Backward-Kompatibilität. Source-of-Truth ist
// jetzt lib/dragDropMimes.ts (alle Canvas-Drag-MIMEs zentral).
import { MIME_ANNOTATION as ANNOTATION_DRAG_MIME } from '../../lib/dragDropMimes'
export { ANNOTATION_DRAG_MIME }

/** v7.9.5 — Liefert den effektiven Author-Namen für neue Annotations.
 *  Promptet den User wenn noch keiner gesetzt ist (kein 'Anonym'!).
 *  Returns null wenn der User den Prompt cancelt. */
export const ensureAnnotationAuthor = async (): Promise<string | null> => {
  const uiState = useUiStore.getState()
  const projState = useProjectStore.getState()
  const fromViewer = projState.project.viewerSession?.author?.trim()
  if (fromViewer) return fromViewer
  const fromStore = uiState.annotationAuthor?.trim()
  if (fromStore) return fromStore
  const name = (await promptDialog(
    'Bitte gib deinen Namen ein.\n\n' +
      'Er wird allen Anmerkungen angeheftet die du jetzt und in Zukunft erstellst.',
    '',
  ))?.trim()
  if (!name) return null
  uiState.setAnnotationAuthor(name)
  return name
}

const STATUS_LABEL: Record<ProjectAnnotation['status'], string> = {
  open: 'offen',
  built: 'gebaut',
  resolved: 'erledigt',
}

const STATUS_COLOR: Record<ProjectAnnotation['status'], string> = {
  open: '#f59e0b',
  built: '#10b981',
  resolved: '#64748b',
}

const ANCHOR_LABEL = (annotation: ProjectAnnotation, deviceNames: Map<string, string>, cableNames: Map<string, string>): string => {
  const a = annotation.anchor
  if (a.type === 'free') return `auf Canvas (${Math.round(a.x)}, ${Math.round(a.y)})`
  if (a.type === 'device') return `Gerät: ${deviceNames.get(a.deviceId) ?? a.deviceId}`
  if (a.type === 'port') return `Port: ${deviceNames.get(a.deviceId) ?? a.deviceId} · ${a.portId}`
  if (a.type === 'cable') return `Kabel: ${cableNames.get(a.cableId) ?? a.cableId}`
  return ''
}

const EMPTY_ANNOTATIONS: ProjectAnnotation[] = []

export const AnnotationsPanel = ({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) => {
  const t = useTranslation()
  // v7.9.3-fix — `?? []` INSIDE der Selector-Funktion erzeugte ein
  // neues Array bei jedem getSnapshot(); useSyncExternalStore sah
  // jedes Mal "change" und triggerte Render-Loop (React-Error #185,
  // gleiche Bug-Klasse wie v7.8.2 hoveredEndpointPortIds). Fix: das
  // ?? im Component-Scope, mit stabilem Modul-Konstanten-Fallback.
  const annotations = useProjectStore((s) => s.project.annotations) ?? EMPTY_ANNOTATIONS
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const updateAnnotation = useProjectStore((s) => s.updateAnnotation)
  const removeAnnotation = useProjectStore((s) => s.removeAnnotation)
  const addAnnotation = useProjectStore((s) => s.addAnnotation)
  const projectMode = useProjectStore((s) => s.project.mode ?? 'editing')
  const viewerSession = useProjectStore((s) => s.project.viewerSession)
  // v7.9.5 — Persistierter Author-Name für Annotations im
  // editing/finalized Modus (im viewer-Modus dominiert viewerSession).
  const annotationAuthorPref = useUiStore((s) => s.annotationAuthor)
  const [statusFilter, setStatusFilter] = useState<ProjectAnnotation['status'] | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')
  const [creating, setCreating] = useState(false)

  const deviceNames = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of equipment) m.set(e.id, e.name)
    return m
  }, [equipment])
  const cableNames = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of cables) m.set(c.id, c.name || c.type)
    return m
  }, [cables])

  const visible = useMemo(
    () => annotations.filter((a) => statusFilter === 'all' || a.status === statusFilter),
    [annotations, statusFilter],
  )

  const grouped = useMemo(() => {
    const m = new Map<string, ProjectAnnotation[]>()
    for (const a of visible) {
      const list = m.get(a.author) ?? []
      list.push(a)
      m.set(a.author, list)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [visible])

  if (!open) return null

  // v7.9.5 — KEIN Anonym-Fallback mehr. Falls beides leer ist (kein
  // Viewer-Session + kein gespeicherter Name) zeigt das Eingabefeld
  // einen entsprechenden Placeholder; das Submit ruft ensureAnnotation-
  // Author() das den User dann promptet.
  const currentAuthor =
    viewerSession?.author?.trim() || annotationAuthorPref?.trim() || ''
  const canCreateFree =
    (projectMode === 'viewer' || projectMode === 'finalized' || projectMode === 'editing') && creating

  return (
    <div className="fixed right-0 top-0 z-40 flex h-screen w-96 max-w-[95vw] flex-col border-l border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold">💬 Anmerkungen ({annotations.length})</h3>
          {viewerSession && (
            <span className="text-[10px] text-slate-500">{format(t('annotations.reviewer', 'Reviewer: {name}'), { name: viewerSession.author })}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
        >
          {t('common.close', 'Schließen')}
        </button>
      </header>

      <div className="border-b border-slate-800 bg-slate-950/40 px-3 py-2">
        <div className="mb-2 flex gap-1">
          {(['all', 'open', 'built', 'resolved'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded px-2 py-0.5 text-[10px] ${
                statusFilter === s
                  ? 'bg-sky-700 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s === 'all'
                ? t('annotations.status.all', 'alle')
                : t(`annotations.status.${s}`, STATUS_LABEL[s])}
            </button>
          ))}
        </div>
        {canCreateFree ? (
          <div className="space-y-1">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              autoFocus
              rows={3}
              placeholder={
                currentAuthor
                  ? format(t('annotations.placeholderAs', 'Anmerkung als {name}…'), { name: currentAuthor })
                  : t('annotations.placeholderEmpty', 'Anmerkung… (Name wird einmalig abgefragt)')
              }
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={async () => {
                  const text = draftText.trim()
                  if (!text) return
                  // v7.9.5 — KEIN Anonym mehr. Prompt wenn nötig.
                  const finalAuthor = await ensureAnnotationAuthor()
                  if (!finalAuthor) return
                  addAnnotation({
                    id: uuidv4(),
                    author: finalAuthor,
                    createdAt: new Date().toISOString(),
                    text,
                    status: 'open',
                    anchor: { type: 'free', x: 0, y: 0 },
                  })
                  setDraftText('')
                  setCreating(false)
                }}
                className="flex-1 rounded bg-emerald-600 px-2 py-1 text-xs hover:bg-emerald-500"
              >
                {t('annotations.add', 'Hinzufügen')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftText('')
                  setCreating(false)
                }}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                {t('annotations.cancel', 'Abbruch')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full rounded bg-sky-700 px-2 py-1 text-xs text-white hover:bg-sky-600"
          >
            + Neue Anmerkung
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {grouped.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            Noch keine Anmerkungen. Klicke "+ Neue Anmerkung" oder mache einen
            Rechtsklick auf ein Gerät / Kabel.
          </p>
        ) : (
          grouped.map(([authorName, items]) => (
            <div key={authorName} className="mb-3">
              <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {authorName} ({items.length})
              </h4>
              <ul className="space-y-1">
                {items.map((a) => {
                  const isEditing = editingId === a.id
                  return (
                    <li
                      key={a.id}
                      // v7.9.5 — Annotation per Drag&Drop aufs Canvas
                      // verschiebbar. CanvasArea#onDrop liest die ID
                      // und ruft updateAnnotation mit neuem anchor.
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(ANNOTATION_DRAG_MIME, a.id)
                        e.dataTransfer.effectAllowed = 'move'
                        // v7.9.16 — Custom Drag-Image: ein kleiner Kreis
                        // in Status-Farbe, mittig am Cursor. Vorher
                        // benutzte der Browser das ganze Listen-Item als
                        // Ghost — riesig und versetzt zum Cursor, daher
                        // wirkte der Drop "random". Mit setDragImage
                        // sieht der User exakt wo die Annotation landet.
                        try {
                          const preview = document.createElement('div')
                          preview.style.cssText = [
                            'position:absolute',
                            'top:-1000px',
                            'left:-1000px',
                            'width:22px',
                            'height:22px',
                            'border-radius:50%',
                            `background:${STATUS_COLOR[a.status]}`,
                            'border:2px solid #0f172a',
                            'box-shadow:0 2px 4px rgba(0,0,0,0.4)',
                            'pointer-events:none',
                          ].join(';')
                          document.body.appendChild(preview)
                          e.dataTransfer.setDragImage(preview, 11, 11)
                          // Aufräumen nachdem das Bild gerendert ist.
                          setTimeout(() => {
                            try { document.body.removeChild(preview) } catch { /* ignore */ }
                          }, 0)
                        } catch {
                          /* setDragImage nicht supported — egal, Drop funktioniert trotzdem */
                        }
                      }}
                      className="cursor-grab rounded border border-slate-700 bg-slate-950/40 p-2 text-xs active:cursor-grabbing"
                      title={t('annotations.dragTitle', 'Ziehen, um diese Anmerkung auf dem Canvas zu platzieren oder einem Gerät zuzuweisen')}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span
                          className="rounded px-1 py-0.5 text-[9px] font-semibold"
                          style={{ background: STATUS_COLOR[a.status], color: '#0f172a' }}
                        >
                          {t(`annotations.status.${a.status}`, STATUS_LABEL[a.status])}
                        </span>
                        <span className="truncate text-[10px] text-slate-500" title={a.createdAt}>
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {isEditing ? (
                        <textarea
                          value={a.text}
                          onChange={(e) => updateAnnotation(a.id, { text: e.target.value })}
                          rows={3}
                          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                          onBlur={() => setEditingId(null)}
                          autoFocus
                        />
                      ) : (
                        <p
                          className="cursor-text whitespace-pre-wrap break-words"
                          onClick={() => setEditingId(a.id)}
                          title={t('annotations.clickToEdit', 'Klicken zum Bearbeiten')}
                        >
                          {a.text}
                        </p>
                      )}
                      <div className="mt-1 text-[10px] text-slate-500">
                        {ANCHOR_LABEL(a, deviceNames, cableNames)}
                      </div>
                      <div className="mt-1 flex gap-1">
                        <select
                          value={a.status}
                          onChange={(e) =>
                            updateAnnotation(a.id, {
                              status: e.target.value as ProjectAnnotation['status'],
                            })
                          }
                          className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px]"
                        >
                          <option value="open">{t('annotations.status.open', 'offen')}</option>
                          <option value="built">{t('annotations.status.built', 'gebaut')}</option>
                          <option value="resolved">{t('annotations.status.resolved', 'erledigt')}</option>
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await confirmDialog(t('annotations.deleteConfirm', 'Anmerkung löschen?'), {
                              okLabel: t('common.delete', 'Löschen'),
                              destructive: true,
                            })) removeAnnotation(a.id)
                          }}
                          className="rounded bg-red-900/60 px-1 py-0.5 text-[10px] text-red-200 hover:bg-red-800"
                          title={t('annotations.delete', 'Anmerkung löschen')}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
