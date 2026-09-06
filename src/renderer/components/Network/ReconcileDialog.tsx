import { useMemo, useState } from 'react'
import { FileUp, Download, X, AlertTriangle } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation, format } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { pickTextFile } from '../../lib/pickFile'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { csvFromTable } from '../../lib/documentStamp'
import {
  parseArpTable,
  parseScanCsv,
  reconcileNetwork,
  reconcileTable,
  type NetworkScan,
  type ReconcileReport,
  type ReconcileVerdict,
} from '../../lib/networkReconcile'

// ─────────────────────────────────────────────────────────────────────────────
// Plan gegen Vorgefundenes (Bedarf 21).
//
// EIN MENSCH LEGT EINE DATEI AB, und dieser Dialog rechnet die Abweichung aus.
// Kein Knopf „jetzt scannen": der Bedarf schreibt „Deliberate, timestamped,
// user-initiated — never a live feed", und die Dossiers sagen, warum das nicht
// Bequemlichkeit ist (Dantes API ist lizenz-gebunden, die offene Alternative
// erklaert sich selbst fuer untauglich, die offene ST-2110-Analyse ist
// eingestellt).
//
// Der Zeitpunkt kommt aus DIESEM Dialog und nicht aus dem Rechenmodul: derselbe
// Datei-Inhalt muss zweimal dasselbe Ergebnis geben, sonst ist der Bericht
// nicht nachvollziehbar.
// ─────────────────────────────────────────────────────────────────────────────

export const ReconcileDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.reconcileOpen)
  const setOpen = useUiStore((s) => s.setReconcileOpen)
  const equipment = useProjectStore((s) => s.project.equipment)
  const projectName = useProjectStore((s) => s.project.metadata.name)

  const [scan, setScan] = useState<NetworkScan | null>(null)
  const [error, setError] = useState<string | null>(null)

  const report: ReconcileReport | null = useMemo(
    () => (scan ? reconcileNetwork(equipment, scan) : null),
    [equipment, scan],
  )

  if (!open) return null

  const load = async () => {
    setError(null)
    const picked = await pickTextFile('.txt,.csv,text/plain,text/csv')
    if (!picked) return
    // Die Form wird am INHALT erkannt und nicht an der Endung: eine
    // ARP-Ausgabe, die jemand als .csv gespeichert hat, ist immer noch eine
    // ARP-Ausgabe.
    const looksCsv = /[;,]/.test(picked.content.split('\n')[0] ?? '') && !/\bat\b|lladdr/.test(picked.content)
    const entries = looksCsv ? parseScanCsv(picked.content) : parseArpTable(picked.content)
    if (entries.length === 0) {
      setError(
        t(
          'reconcile.error.empty',
          'In der Datei stand kein Gerät, das sich lesen lässt. Erwartet: eine ARP-/Neighbour-Ausgabe oder eine CSV mit einer Spalte Name, IP oder MAC.',
        ),
      )
      setScan(null)
      return
    }
    setScan({ takenAt: new Date().toISOString(), source: picked.name, entries })
  }

  const exportCsv = () => {
    if (!report) return
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'abgleich', 'csv'),
      csvFromTable(reconcileTable(report)),
      'text/csv',
    )
  }

  const verdictText = (v: ReconcileVerdict): string => {
    switch (v) {
      case 'match':
        return t('reconcile.v.match', 'stimmt')
      case 'address-mismatch':
        return t('reconcile.v.address', 'Adresse weicht ab')
      case 'name-mismatch':
        return t('reconcile.v.name', 'Name weicht ab')
      case 'renamed':
        return t('reconcile.v.renamed', 'umbenannt (Kollisionsform)')
      case 'missing':
        return t('reconcile.v.missing', 'nicht gefunden')
      case 'unexpected':
        return t('reconcile.v.unexpected', 'nicht im Plan')
      case 'ambiguous':
        return t('reconcile.v.ambiguous', 'nicht eindeutig — keine Zuordnung')
    }
  }

  const tone = (v: ReconcileVerdict): string =>
    v === 'match' ? 'text-cp-text-muted' : v === 'renamed' ? 'text-cp-text-secondary' : 'text-amber-300/90'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-cp-border bg-cp-surface-1 shadow-xl">
        <div className="flex items-center justify-between border-b border-cp-border px-4 py-2.5">
          <h2 className="text-cp-base font-semibold text-cp-text">
            {t('reconcile.title', 'Plan gegen Vorgefundenes')}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('common.close', 'Schließen')}
            className="text-cp-text-muted hover:text-cp-text"
          >
            <Icon icon={X} size="sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-cp-sm leading-snug text-cp-text-secondary">
            {t(
              'reconcile.intro',
              'Was vom LKW kam, unter welchen Namen und mit welchen Adressen — gegen das, was der Plan sagt. Der Plan fragt kein Gerät: du legst eine Datei ab (ARP-/Neighbour-Ausgabe oder CSV), und der Abgleich rechnet die Abweichung aus.',
            )}
          </p>

          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 rounded border border-cp-border px-2.5 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
            >
              <Icon icon={FileUp} size="sm" /> {t('reconcile.load', 'Datei einlesen')}
            </button>
            {report && (
              <>
                <span className="text-cp-xs text-cp-text-muted">
                  {format(t('reconcile.taken', '{source} · {when}'), {
                    source: report.source,
                    when: new Date(report.takenAt).toLocaleString(),
                  })}
                </span>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="ml-auto inline-flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
                >
                  <Icon icon={Download} size="sm" /> CSV
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded border border-amber-700/60 bg-amber-900/20 p-2 text-cp-xs text-amber-200">
              <Icon icon={AlertTriangle} size="xs" />
              <span>{error}</span>
            </div>
          )}

          {!report ? (
            <p className="py-6 text-center text-cp-sm text-cp-text-muted">
              {t('reconcile.empty', 'Noch keine Datei eingelesen.')}
            </p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-3 text-cp-xs text-cp-text-muted">
                {(
                  ['match', 'renamed', 'address-mismatch', 'name-mismatch', 'missing', 'unexpected', 'ambiguous'] as const
                ).map((v) =>
                  report.counts[v] > 0 ? (
                    <span key={v}>
                      {report.counts[v]} × {verdictText(v)}
                    </span>
                  ) : null,
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {report.rows.map((r, i) => (
                  <li
                    key={`${r.verdict}-${r.planned ?? ''}-${r.found ?? ''}-${i}`}
                    className="flex flex-wrap items-center gap-2 rounded border border-cp-border-muted bg-cp-surface-2 px-2 py-1 text-cp-xs"
                  >
                    <span className={`w-44 shrink-0 ${tone(r.verdict)}`}>{verdictText(r.verdict)}</span>
                    <span className="text-cp-text">{r.planned ?? '—'}</span>
                    {r.plannedIp && <span className="font-mono text-cp-text-muted">{r.plannedIp}</span>}
                    {r.found && r.found !== r.planned && (
                      <span className="text-cp-text-secondary">
                        {format(t('reconcile.foundAs', 'gefunden als {name}'), { name: r.found })}
                      </span>
                    )}
                    {r.foundIp && r.foundIp !== r.plannedIp && (
                      <span className="font-mono text-amber-300/90">{r.foundIp}</span>
                    )}
                    {r.matchedBy && (
                      <span className="ml-auto text-[10px] text-cp-text-faint">
                        {format(t('reconcile.matchedBy', 'über {basis}'), { basis: r.matchedBy.toUpperCase() })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
