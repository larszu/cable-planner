import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import { cablePlannerApi } from '../../lib/bridge'
import { confirmDialog } from '../../lib/confirmDialog'
import {
  reviewSummary,
  type DocumentLogFile,
  type ReviewedEntry,
} from '../../lib/documentLog'
import {
  OHNE_EMPFAENGER,
  empfaengerStaende,
  type BlattStand,
} from '../../lib/recipientDigest'
import { planDiffSummary } from '../../lib/planDiff'

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
 *
 * BEDARF 11 — NACH EMPFAENGERN GETRENNT, seit 2026-09-09. Der Bedarf sagt
 * „different people end up on different versions"; eine Liste ueber alle
 * Blaetter beantwortet das nicht, weil sie die Trennung einebnet, um die es
 * geht. Die Ansicht fragt deshalb `empfaengerStaende` und zeigt je Empfaenger
 * seine eigenen Blaetter — und, wo der Plan von damals als Revision noch
 * existiert, WAS sich seither geaendert hat.
 *
 * Wo er nicht mehr existiert, steht das da und kein Vergleich. Ein Blatt mit
 * einem Vergleich gegen die falsche Fassung waere schlimmer als eines ohne:
 * es klaenge nach einer Auskunft.
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

  // EINE Rechnung. `empfaengerStaende` ruft `reviewLog` selbst; ein zweiter
  // Aufruf hier gaebe dieselbe Liste ein zweites Mal — und die zweite waere
  // die, die irgendwann anders sortiert oder anders gefiltert ist.
  const staende = log ? empfaengerStaende(log, project, filePath) : []
  const entries: ReviewedEntry[] = staende.flatMap((e) => e.blaetter.map((b) => b.entry))
  const otherProjects = log ? log.entries.length - entries.length : 0

  const onClear = async () => {
    if (
      !(await confirmDialog(t('doclog.clear.confirm', 'Clear the register?'), {
        body: t(
          'doclog.clear.body',
          'The list of documents handed out will be deleted — including other projects. The printouts themselves are not affected.',
        ),
        destructive: true,
      }))
    )
      return
    setLog((await cablePlannerApi.documentLog.clear()) as DocumentLogFile)
  }

  /**
   * BEDARF 11 — die Spalte, um die es geht. Drei Auskuenfte, und keine davon
   * darf wie eine der anderen aussehen:
   *
   *   * Der Vergleich gegen die Fassung, aus der das Blatt gedruckt wurde.
   *   * „ueberholt, aber die Fassung von damals ist nicht mehr da" — das ist
   *     heilbar (Revision festschreiben) und wird deshalb so gesagt.
   *   * „der Stand dieses Dokuments ist gar nicht reproduzierbar" — das ist
   *     nicht heilbar, und wer es mit dem Fall darueber verwechselt, sucht
   *     nach einer Revision, die nichts aendern wuerde.
   */
  const seitdem = (b: BlattStand) => {
    if (b.diff) {
      return (
        <span>
          {planDiffSummary(b.diff)}
          {b.revisionLabel && (
            <span className="text-cp-text-muted">
              {' '}
              ({t('doclog.since.rev', 'against')} {b.revisionLabel})
            </span>
          )}
        </span>
      )
    }
    if (b.ohneVergleich === 'keine-passende-revision') {
      return (
        <span className="text-cp-text-muted">
          {t(
            'doclog.since.noRevision',
            'The version of that time was never committed - only that the sheet is superseded.',
          )}
        </span>
      )
    }
    if (b.ohneVergleich === 'stand-nicht-reproduzierbar') {
      return (
        <span className="text-cp-text-muted">
          {t(
            'doclog.since.notReproducible',
            "This document's stand cannot be recomputed from the plan alone.",
          )}
        </span>
      )
    }
    return <span className="text-cp-text-muted">—</span>
  }

  const fmt = (iso: string): string => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('doclog.title', 'Documents handed out')}
      maxWidth="4xl"
      draggableKey="cable-planner:modal-pos:document-log"
      footer={
        <div className="flex items-center justify-between gap-3 text-cp-xs">
          <span className="text-cp-text-muted">
            {t(
              'doclog.footer',
              'The register lives next to the app, not in the project — it records what was handed out on this machine and does not travel with the plan.',
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
              className="flex items-center gap-1 bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5 disabled:opacity-50"
            >
              <Icon icon={RefreshCw} size="sm" />
              {t('common.refresh', 'Refresh')}
            </button>
            <button
              type="button"
              onClick={() => void onClear()}
              className="flex items-center gap-1 bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              <Icon icon={Trash2} size="sm" />
              {t('doclog.clear', 'Clear register')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 text-cp-sm">
        <div className="border border-cp-border-muted bg-cp-surface-2 p-2 text-cp-xs">
          {reviewSummary(entries)}
          {entries.length > 0 && (
            <span className="text-cp-text-muted">
              {' '}
              · {entries.length} {t('doclog.entries', 'entries for this project')}
            </span>
          )}
        </div>

        {entries.length === 0 && (
          <p className="text-cp-xs text-cp-text-muted">
            {t(
              'doclog.empty',
              'Nothing has been handed out for this project yet — or the exports came from another machine.',
            )}
          </p>
        )}

        {staende.map((empfaenger) => (
          <section key={empfaenger.recipient || '__ohne'} className="space-y-1">
            <h4 className="flex flex-wrap items-baseline gap-2 text-cp-xs">
              <span className="font-medium text-cp-text">
                {empfaenger.recipient === OHNE_EMPFAENGER
                  ? t('doclog.noRecipient', 'Recipient not named')
                  : empfaenger.recipient}
              </span>
              <span className="text-cp-text-muted">
                {empfaenger.blaetter.length} ·{' '}
                {empfaenger.superseded > 0
                  ? `${empfaenger.superseded} ${t('doclog.stale', 'superseded')}`
                  : t('doclog.allCurrent', 'all current')}
                {empfaenger.superseded > 0 &&
                  ` · ${empfaenger.mitVergleich} ${t('doclog.withDiff', 'with a comparison')}`}
              </span>
            </h4>
            <table className="block overflow-x-auto w-full text-cp-xs">
              <thead className="text-cp-text-secondary">
                <tr>
                  <th className="px-2 py-1 text-left">{t('doclog.col.doc', 'Document')}</th>
                  <th className="px-2 py-1 text-left">{t('doclog.col.when', 'Handed out')}</th>
                  <th className="px-2 py-1 text-left">{t('doclog.col.stand', 'Revision on the sheet')}</th>
                  <th className="px-2 py-1 text-left">{t('doclog.col.status', 'Still valid?')}</th>
                  <th className="px-2 py-1 text-left">
                    {t('doclog.col.since', 'What changed since')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {empfaenger.blaetter.map((b, i) => (
                  <tr
                    key={`${b.entry.docId}-${b.entry.emittedAt}-${i}`}
                    className="border-t border-cp-border-muted"
                  >
                    <td className="px-2 py-1">{b.entry.label}</td>
                    <td className="px-2 py-1 text-cp-text-secondary">{fmt(b.entry.emittedAt)}</td>
                    <td className="px-2 py-1 font-mono">
                      #{b.entry.stand}
                      {b.entry.status === 'superseded' && b.entry.standNow && (
                        <span className="text-cp-text-muted"> {'->'} #{b.entry.standNow}</span>
                      )}
                    </td>
                    <td className={`px-2 py-1 ${STATUS_STYLE[b.entry.status]}`}>
                      {b.entry.status === 'superseded'
                        ? t('doclog.superseded', 'superseded — hand out again')
                        : b.entry.status === 'unknown'
                          ? t('doclog.unknown', 'cannot tell')
                          : t('doclog.current', 'current')}
                    </td>
                    <td className="px-2 py-1">{seitdem(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {/* Die beiden Dinge, die ein Register verschweigen könnte — und dann
            vollständig aussähe. */}
        {log && log.dropped > 0 && (
          <p className="flex items-start gap-2 border border-cp-warn/40 bg-cp-surface-2 p-2 text-cp-xs text-cp-warn">
            <Icon icon={AlertTriangle} size="sm" />
            {t('doclog.dropped', 'Older entries have fallen out of the register:')}{' '}
            {log.dropped}
          </p>
        )}
        {otherProjects > 0 && (
          <p className="text-cp-xs text-cp-text-muted">
            {t('doclog.otherProjects', 'Further entries belong to other projects:')}{' '}
            {otherProjects}
          </p>
        )}
      </div>
    </ModalShell>
  )
}
