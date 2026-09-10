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
import {
  asBuiltSummary,
  asBuiltTable,
  fromCabling,
  fromNetworkReport,
  mergeEntries,
  unverifiedEntries,
} from '../../lib/asBuilt'
import { PanelHint } from '../shared/PanelHint'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'

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
  const cables = useProjectStore((s) => s.project.cables)
  const checkState = useProjectStore((s) => s.project.checkState)
  const projectName = useProjectStore((s) => s.project.metadata.name)

  const [scan, setScan] = useState<NetworkScan | null>(null)
  const [error, setError] = useState<string | null>(null)

  const report: ReconcileReport | null = useMemo(
    () => (scan ? reconcileNetwork(equipment, scan) : null),
    [equipment, scan],
  )

  // BEDARF 126 — das As-Built-Blatt.
  //
  //   > post HAS NO RECORD of which physical source was on which input.
  //
  // Der Abgleich oben zeigt die ABWEICHUNGEN; dieses Blatt zeigt den ganzen
  // Bestand, und zwar mit der Luecke darin: jedes Geraet, das der Scan NICHT
  // gesehen hat, steht als „nicht nachgesehen" darauf. Ohne diese Zeilen
  // fuehrte das Blatt nur die Geraete, an denen jemand war, und laese sich wie
  // eine vollstaendige Pruefung.
  const asBuilt = useMemo(() => {
    const geplant = unverifiedEntries(
      equipment
        .filter((e) => e.ipAddress)
        .map((e) => ({ subject: e.name, field: 'IP-Adresse', planned: e.ipAddress })),
      'network-scan',
    )
    // B-9 — die Verkabelung gehoert auf DASSELBE Blatt.
    //
    // Ein zweites „As-built (Kabel)"-Dokument waere genau die Vervielfachung,
    // gegen die dieses Modul gebaut ist: die Post haette dann zwei Blaetter
    // und muesste sie selbst zusammenlegen. `mergeEntries` haelt sie
    // auseinander, weil das FELD Teil des Schluessels ist — „IP-Adresse" und
    // „Verbindung gesteckt" kollidieren nicht.
    //
    // Der Zeitpunkt kommt aus `checkState.receivedAt` und nicht von hier: der
    // Dialog weiss nicht, wann jemand abgehakt hat, und darf es nicht raten.
    return mergeEntries(
      geplant,
      report ? fromNetworkReport(report) : [],
      fromCabling(cables, equipment, checkState),
    )
  }, [equipment, report, cables, checkState])

  const asBuiltStand = useMemo(() => asBuiltSummary(asBuilt), [asBuilt])

  // Phase 3 der UI-Pruefung: Escape, Fokus-Falle und Fokus-Rueckgabe aus dem
  // Haken. Vor dem bedingten Ausstieg, weil Haken nicht bedingt laufen.
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, () => setOpen(false))

  // B-44 — der Hintergrund schliesst, aus derselben Quelle wie ueberall.
  const backdrop = useBackdropClose(() => setOpen(false))

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
          'No readable device in that file. Expected an ARP/neighbour dump or a CSV with a name, IP or MAC column.',
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

  const exportAsBuilt = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'as-built', 'csv'),
      csvFromTable(asBuiltTable(asBuilt)),
      'text/csv',
    )
  }

  const verdictText = (v: ReconcileVerdict): string => {
    switch (v) {
      case 'match':
        return t('reconcile.v.match', 'matches')
      case 'address-mismatch':
        return t('reconcile.v.address', 'address differs')
      case 'name-mismatch':
        return t('reconcile.v.name', 'name differs')
      case 'renamed':
        return t('reconcile.v.renamed', 'renamed (collision form)')
      case 'missing':
        return t('reconcile.v.missing', 'not found')
      case 'unexpected':
        return t('reconcile.v.unexpected', 'not in the plan')
      case 'ambiguous':
        return t('reconcile.v.ambiguous', 'not unique \u2014 no match made')
    }
  }

  const tone = (v: ReconcileVerdict): string =>
    v === 'match' ? 'text-cp-text-muted' : v === 'renamed' ? 'text-cp-text-secondary' : 'text-amber-300/90'

  return (
    <div
      {...backdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-cp-border bg-cp-surface-1 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-cp-border px-4 py-2.5">
          <h2 id={titleId} className="text-cp-base font-semibold text-cp-text">
            {t('reconcile.title', 'Plan vs. found')}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('common.close', 'Close')}
            className="text-cp-text-muted hover:text-cp-text"
          >
            <Icon icon={X} size="sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <PanelHint
            className="mb-3 text-cp-sm leading-snug text-cp-text-secondary"
            text={t(
              'reconcile.intro',
              'What came off the truck, under which names and with which addresses \u2014 against what the plan says. The plan asks no device: you supply a file (ARP/neighbour output or CSV) and the reconciliation computes the delta.',
            )}
          />

          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 rounded border border-cp-border px-2.5 py-1 text-cp-sm text-cp-text-secondary hover:text-cp-text"
            >
              <Icon icon={FileUp} size="sm" /> {t('reconcile.load', 'Load file')}
            </button>
            {report && (
              <>
                <span className="text-cp-xs text-cp-text-muted">
                  {format(t('reconcile.taken', '{source} \u00b7 {when}'), {
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

          {/* BEDARF 126 — „wie geplant" gegen „wie gebaut", als EIN Blatt.
              Es steht auch OHNE Scan da: dann besteht es ganz aus „nicht
              nachgesehen", und genau das ist die ehrliche Auskunft. */}
          <div className="flex flex-wrap items-center gap-2 border-t border-cp-border-muted pt-2 text-cp-xs">
            <span className="text-cp-text-secondary">
              {t('asBuilt.title', 'As-built sheet (as planned / as built)')}
            </span>
            <span className="text-cp-text-muted">
              {format(
                t('asBuilt.count', '{verified} of {total} entries verified'),
                { verified: asBuiltStand.verified, total: asBuiltStand.total },
              )}
            </span>
            <button
              type="button"
              onClick={exportAsBuilt}
              disabled={asBuiltStand.total === 0}
              className="ml-auto inline-flex items-center gap-1 rounded border border-cp-border px-2 py-1 text-cp-text-secondary hover:text-cp-text disabled:opacity-40"
            >
              <Icon icon={Download} size="xs" />
              {t('asBuilt.export', 'As-built')}
            </button>
          </div>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded border border-amber-700/60 bg-amber-900/20 p-2 text-cp-xs text-amber-200">
              <Icon icon={AlertTriangle} size="xs" />
              <span>{error}</span>
            </div>
          )}

          {!report ? (
            <p className="py-6 text-center text-cp-sm text-cp-text-muted">
              {t('reconcile.empty', 'No file loaded yet.')}
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
                        {format(t('reconcile.foundAs', 'found as {name}'), { name: r.found })}
                      </span>
                    )}
                    {r.foundIp && r.foundIp !== r.plannedIp && (
                      <span className="font-mono text-amber-300/90">{r.foundIp}</span>
                    )}
                    {r.matchedBy && (
                      <span className="ml-auto text-cp-xs text-cp-text-faint">
                        {format(t('reconcile.matchedBy', 'via {basis}'), { basis: r.matchedBy.toUpperCase() })}
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
