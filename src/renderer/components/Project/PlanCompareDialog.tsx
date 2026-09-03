import { useState } from 'react'
import { AlertTriangle, FileDown, FolderOpen, GitCompare } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import { cablePlannerApi } from '../../lib/bridge'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { planDiff, planDiffCsv, planDiffSummary, type PlanDiff } from '../../lib/planDiff'
import { changeImpact, changeImpactSummary, type ChangeImpact } from '../../lib/changeImpact'
import { planFingerprint } from '../../lib/documentStamp'
import type { CablePlannerProject } from '../../types/project'

// Roadmap-Initiative 5 — hier laufen beide Ableitungen zusammen.
//
// `planDiff` sagt WAS anders ist, `changeImpact` sagt WELCHE BLAETTER damit
// ueberholt sind. Beides nebeneinander, weil die eine Antwort ohne die andere
// unvollstaendig ist: „14 Aenderungen" sagt nicht, ob jemand nochmal drucken
// muss, und „Pull-Liste ueberholt" sagt nicht, warum.
//
// DER GELADENE STAND IST DER ALTE. Die Richtung ist nicht beliebig: der
// Nutzer haelt seinen Plan und bekommt eine fremde Datei. Gefragt ist „was
// hat sich seit der anderen Datei geaendert", also `planDiff(fremd, meiner)`.
// Steht es andersherum, drehen sich Zu- und Abgang um — deshalb steht die
// Richtung auch im Dialog und nicht nur im Kommentar.

export interface PlanCompareDialogProps {
  open: boolean
  onClose: () => void
}

type Loaded = {
  filePath: string
  project: CablePlannerProject
}

/** Plausibilitaet statt Vertrauen: eine fremde Datei ist erst mal nur JSON. */
const looksLikeProject = (data: unknown): data is CablePlannerProject => {
  if (typeof data !== 'object' || data === null) return false
  const p = data as Record<string, unknown>
  return Array.isArray(p.equipment) && Array.isArray(p.cables) && typeof p.metadata === 'object'
}

const VERDICT_STYLE: Record<string, string> = {
  invalidated: 'text-cp-danger',
  unknown: 'text-cp-warn',
  unaffected: 'text-cp-text-muted',
}

const CLASS_STYLE: Record<string, string> = {
  substantive: 'text-cp-text',
  sensitive: 'text-cp-warn',
  cosmetic: 'text-cp-text-muted',
  bookkeeping: 'text-cp-text-muted',
  identity: 'text-cp-text-muted',
}

export const PlanCompareDialog = ({ open, onClose }: PlanCompareDialogProps) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const [other, setOther] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pickFile = async () => {
    setBusy(true)
    setError(null)
    try {
      const picked = await cablePlannerApi.project.openForCompare()
      if (!picked) return
      if (!looksLikeProject(picked.data)) {
        setOther(null)
        setError(
          t(
            'compare.error.notAPlan',
            'Diese Datei enthält keinen lesbaren Plan (Geräte- und Kabel-Liste fehlen).',
          ),
        )
        return
      }
      setOther({ filePath: picked.filePath, project: picked.data })
    } finally {
      setBusy(false)
    }
  }

  // Reihenfolge: die geladene Datei ist der frühere Stand, der offene Plan der
  // spätere. Siehe Kopf-Kommentar.
  const diff: PlanDiff | null = other ? planDiff(other.project, project) : null
  const impact: ChangeImpact | null = other ? changeImpact(other.project, project) : null

  const exportCsv = () => {
    if (!other) return
    const csv = planDiffCsv(other.project, project)
    downloadBlob(
      buildExportFilenameWithSuffix(project.metadata.name || 'projekt', 'plan-vergleich', 'csv'),
      csv,
      'text/csv;charset=utf-8',
    )
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('compare.title', 'Plan-Stände vergleichen')}
      maxWidth="4xl"
      draggableKey="cable-planner:modal-pos:plan-compare"
      footer={
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="text-cp-text-muted">
            {t(
              'compare.footer',
              'Der geöffnete Plan gilt als der neuere Stand. Nichts wird geladen oder überschrieben.',
            )}
          </span>
          <div className="flex gap-2">
            {diff && (
              <button
                type="button"
                onClick={exportCsv}
                className="flex items-center gap-1 rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
              >
                <Icon icon={FileDown} size="sm" />
                {t('compare.exportCsv', 'Als CSV exportieren')}
              </button>
            )}
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
      <div className="space-y-4 text-cp-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void pickFile()}
            className="flex items-center gap-2 rounded bg-cp-accent px-3 py-1.5 text-cp-xs text-white disabled:opacity-50"
          >
            <Icon icon={FolderOpen} size="sm" />
            {t('compare.pick', 'Vergleichs-Datei wählen…')}
          </button>
          {other && (
            <span className="truncate text-cp-xs text-cp-text-secondary" title={other.filePath}>
              {other.filePath}
            </span>
          )}
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded border border-cp-danger/40 bg-cp-surface-2 p-2 text-cp-xs text-cp-danger">
            <Icon icon={AlertTriangle} size="sm" />
            {error}
          </p>
        )}

        {!other && !error && (
          <p className="text-cp-xs text-cp-text-muted">
            {t(
              'compare.hint',
              'Wähle eine zweite Projektdatei — etwa den Stand, den ein Kollege zurückgeschickt hat. Sie wird nur gelesen und nicht geöffnet.',
            )}
          </p>
        )}

        {diff && impact && other && (
          <>
            <div className="grid gap-2 rounded border border-cp-border-muted bg-cp-surface-2 p-3 text-cp-xs sm:grid-cols-2">
              <div>
                <div className="text-cp-text-muted">
                  {t('compare.standBefore', 'Stand der gewählten Datei')}
                </div>
                <div className="font-mono">#{planFingerprint(other.project)}</div>
              </div>
              <div>
                <div className="text-cp-text-muted">
                  {t('compare.standAfter', 'Stand des geöffneten Plans')}
                </div>
                <div className="font-mono">#{planFingerprint(project)}</div>
              </div>
              <div className="sm:col-span-2">
                <span className="flex items-center gap-2">
                  <Icon icon={GitCompare} size="sm" />
                  {planDiffSummary(diff)}
                  <span className="text-cp-text-muted">·</span>
                  {changeImpactSummary(impact)}
                </span>
              </div>
            </div>

            {/* Erst die Blätter — das ist die Frage, die Arbeit auslöst. */}
            <section>
              <h3 className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">
                {t('compare.documents', 'Dokumente')}
              </h3>
              <ul className="space-y-0.5 text-cp-xs">
                {impact.documents.map((d) => (
                  <li key={d.docId} className="flex items-baseline gap-2">
                    <span className={`w-28 shrink-0 ${VERDICT_STYLE[d.verdict]}`}>
                      {d.verdict === 'invalidated'
                        ? t('compare.verdict.invalidated', 'überholt')
                        : d.verdict === 'unknown'
                          ? t('compare.verdict.unknown', 'nicht beurteilbar')
                          : t('compare.verdict.unaffected', 'unverändert')}
                    </span>
                    <span>{d.label}</span>
                    {d.reason && <span className="text-cp-text-muted">— {d.reason}</span>}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">
                {t('compare.changes', 'Unterschiede')}
              </h3>
              {diff.entities.length === 0 ? (
                <p className="text-cp-xs text-cp-text-muted">
                  {t('compare.noEntities', 'Keine Unterschiede an Geräten oder Kabeln.')}
                </p>
              ) : (
                <ul className="space-y-1 text-cp-xs">
                  {diff.entities.map((e) => (
                    <li key={`${e.kind}-${e.id}`}>
                      <span className="font-medium">
                        {e.change === 'removed'
                          ? t('compare.change.removed', 'entfällt')
                          : e.change === 'added'
                            ? t('compare.change.added', 'neu')
                            : t('compare.change.modified', 'geändert')}
                        {': '}
                        {e.label}
                      </span>
                      {e.fields.length > 0 && (
                        <ul className="ml-4 mt-0.5 space-y-0.5">
                          {e.fields.map((f) => (
                            <li key={f.field} className={CLASS_STYLE[f.klass]}>
                              {f.field}
                              {f.klass === 'sensitive' ? (
                                <>
                                  {' — '}
                                  {t(
                                    'compare.sensitiveChanged',
                                    'geändert (Zugangsdaten werden nicht angezeigt)',
                                  )}
                                </>
                              ) : f.before === undefined ? (
                                <>
                                  {' — '}
                                  {t('compare.unclassifiedChanged', 'geändert (unbekanntes Feld)')}
                                </>
                              ) : (
                                <>
                                  : {f.before} {'->'} {f.after}
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Die drei unangenehmen Listen. Sie stehen hier, weil ein
                Vergleich, der sie weglässt, wie eine Freigabe aussieht. */}
            {diff.sections.length > 0 && (
              <section>
                <h3 className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">
                  {t('compare.sections', 'Weitere Projekt-Bereiche (nicht aufgeschlüsselt)')}
                </h3>
                <ul className="space-y-0.5 text-cp-xs text-cp-text-secondary">
                  {diff.sections.map((s) => (
                    <li key={s.section}>
                      {s.section}: {s.detail}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {diff.recreationHints.length > 0 && (
              <p className="rounded border border-cp-border-muted bg-cp-surface-2 p-2 text-cp-xs text-cp-text-secondary">
                {t(
                  'compare.recreationHint',
                  'Gleicher Name in Ab- und Zugang — vermutlich neu angelegt statt geändert. Dieser Vergleich kann das nicht unterscheiden:',
                )}{' '}
                {diff.recreationHints.join(', ')}
              </p>
            )}

            {diff.unclassified.length > 0 && (
              <p className="flex items-start gap-2 rounded border border-cp-warn/40 bg-cp-surface-2 p-2 text-cp-xs text-cp-warn">
                <Icon icon={AlertTriangle} size="sm" />
                {t(
                  'compare.unclassified',
                  'Felder ohne Klassifizierung — als Änderung gemeldet, aber ohne Werte:',
                )}{' '}
                {diff.unclassified.join(', ')}
              </p>
            )}
          </>
        )}
      </div>
    </ModalShell>
  )
}
