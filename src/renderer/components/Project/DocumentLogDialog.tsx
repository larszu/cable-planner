import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import { cablePlannerApi } from '../../lib/bridge'
import { confirmDialog } from '../../lib/confirmDialog'
import {
  reviewLog,
  reviewSummary,
  type DocumentLogFile,
  type ReviewedEntry,
} from '../../lib/documentLog'

/**
 * Roadmap-Initiative 5 — die Vorwaerts-Frage, endlich mit beiden Haelften.
 *
 * `changeImpact` konnte zwei *gegebene* Plan-Staende vergleichen. Was fehlte,
 * war das Gedaechtnis: welche Blaetter habe ich ueberhaupt ausgeteilt? Das
 * Register liefert es, und `documentRegistry` rechnet aus, welchen Stand
 * dasselbe Dokument heute haette. Zusammen ergibt das die Antwort, um die es
 * die ganze Zeit ging: *„welches der ausgedruckten Blaetter ist jetzt hin?"*
 *
 * DREI ZUSTAENDE, NICHT ZWEI. „ueberholt" und „aktuell" reichen nicht — ein
 * Eintrag, dessen Stand nicht reproduzierbar ist (die Kabel-Stueckliste haengt
 * am Reserve-Aufschlag), ist weder das eine noch das andere. Ihn als „aktuell"
 * zu fuehren waere eine Freigabe, die niemand gegeben hat; das ist dieselbe
 * Regel wie in `changeImpact`.
 */
export interface DocumentLogDialogProps {
  open: boolean
  onClose: () => void
}

const STATUS_STYLE: Record<ReviewedEntry['status'], string> = {
  superseded: 'text-cp-danger',
  unknown: 'text-cp-warn',
  current: 'text-cp-text-muted',
}

export const DocumentLogDialog = ({ open, onClose }: DocumentLogDialogProps) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const filePath = useProjectStore((s) => s.filePath)
  const [log, setLog] = useState<DocumentLogFile | null>(null)
  const [busy, setBusy] = useState(false)

  // `setBusy` steht bewusst NICHT hier drin: der Effekt unten ruft `load`
  // direkt, und ein synchrones setState im Effekt loest Kaskaden-Renders aus
  // (eslint react-hooks/set-state-in-effect). Der Knopf setzt es selbst.
  const load = async () => {
    try {
      setLog((await cablePlannerApi.documentLog.read()) as DocumentLogFile)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (open) void load()
  }, [open])

  const entries = log ? reviewLog(log, project, filePath) : []
  const otherProjects = log ? log.entries.length - entries.length : 0

  const onClear = async () => {
    if (
      !(await confirmDialog(t('doclog.clear.confirm', 'Register leeren?'), {
        body: t(
          'doclog.clear.body',
          'Die Liste der ausgegebenen Dokumente wird gelöscht — auch die anderer Projekte. Die Ausdrucke selbst sind davon nicht betroffen.',
        ),
        destructive: true,
      }))
    )
      return
    setLog((await cablePlannerApi.documentLog.clear()) as DocumentLogFile)
  }

  const fmt = (iso: string): string => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('doclog.title', 'Ausgegebene Dokumente')}
      maxWidth="4xl"
      draggableKey="cable-planner:modal-pos:document-log"
      footer={
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-cp-text-muted">
            {t(
              'doclog.footer',
              'Das Register liegt neben der App, nicht im Projekt — es hält fest, was auf diesem Rechner ausgegeben wurde, und reist nicht mit dem Plan mit.',
            )}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBusy(true)
                void load()
              }}
              disabled={busy}
              className="flex items-center gap-1 rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5 disabled:opacity-50"
            >
              <Icon icon={RefreshCw} size="sm" />
              {t('common.refresh', 'Aktualisieren')}
            </button>
            <button
              type="button"
              onClick={() => void onClear()}
              className="flex items-center gap-1 rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              <Icon icon={Trash2} size="sm" />
              {t('doclog.clear', 'Register leeren')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('common.close', 'Schließen')}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 text-cp-sm">
        <div className="rounded border border-cp-border-muted bg-cp-surface-2 p-2 text-cp-xs">
          {reviewSummary(entries)}
          {entries.length > 0 && (
            <span className="text-cp-text-muted">
              {' '}
              · {entries.length} {t('doclog.entries', 'Einträge zu diesem Projekt')}
            </span>
          )}
        </div>

        {entries.length === 0 && (
          <p className="text-cp-xs text-cp-text-muted">
            {t(
              'doclog.empty',
              'Für dieses Projekt wurde noch nichts ausgegeben — oder die Ausgaben stammen von einem anderen Rechner.',
            )}
          </p>
        )}

        {entries.length > 0 && (
          <table className="w-full text-cp-xs">
            <thead className="text-cp-text-secondary">
              <tr>
                <th className="px-2 py-1 text-left">{t('doclog.col.doc', 'Dokument')}</th>
                <th className="px-2 py-1 text-left">{t('doclog.col.when', 'Ausgegeben')}</th>
                <th className="px-2 py-1 text-left">{t('doclog.col.stand', 'Stand auf dem Blatt')}</th>
                <th className="px-2 py-1 text-left">{t('doclog.col.status', 'Gilt noch?')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.docId}-${e.emittedAt}-${i}`} className="border-t border-cp-border-muted">
                  <td className="px-2 py-1">{e.label}</td>
                  <td className="px-2 py-1 text-cp-text-secondary">{fmt(e.emittedAt)}</td>
                  <td className="px-2 py-1 font-mono">
                    #{e.stand}
                    {e.status === 'superseded' && e.standNow && (
                      <span className="text-cp-text-muted"> {'->'} #{e.standNow}</span>
                    )}
                  </td>
                  <td className={`px-2 py-1 ${STATUS_STYLE[e.status]}`}>
                    {e.status === 'superseded'
                      ? t('doclog.superseded', 'überholt — neu ausgeben')
                      : e.status === 'unknown'
                        ? t('doclog.unknown', 'nicht beurteilbar')
                        : t('doclog.current', 'aktuell')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Die beiden Dinge, die ein Register verschweigen könnte — und dann
            vollständig aussähe. */}
        {log && log.dropped > 0 && (
          <p className="flex items-start gap-2 rounded border border-cp-warn/40 bg-cp-surface-2 p-2 text-cp-xs text-cp-warn">
            <Icon icon={AlertTriangle} size="sm" />
            {t('doclog.dropped', 'Ältere Einträge sind aus dem Register gefallen:')}{' '}
            {log.dropped}
          </p>
        )}
        {otherProjects > 0 && (
          <p className="text-cp-xs text-cp-text-muted">
            {t('doclog.otherProjects', 'Weitere Einträge gehören zu anderen Projekten:')}{' '}
            {otherProjects}
          </p>
        )}
      </div>
    </ModalShell>
  )
}
