// ───────────────────────────────────────────────────────────────────────────
// Die Verdrahtungs-Vorschläge, sichtbar (#666).
//
// Der Rechner dahinter (`lib/circuitSuggest.ts`) und die Rückübersetzung in
// Geräte und Anschlüsse (`lib/circuitSuggestPlan.ts`) sind rein und geprüft.
// Diese Datei ist ihre Oberfläche — und sie ist der Ort, an dem die drei
// Zusagen jener Module beim Nutzer ankommen oder verloren gehen:
//
//   1. Der Vorschlag ist NACHGERECHNET. Deshalb steht seine Wahrheitstafel
//      daneben, aufklappbar, Stellung für Stellung. Wer die Ader einträgt,
//      kann vorher nachsehen, statt zu vertrauen.
//   2. Die ANNAHMEN stehen sichtbar oben und nicht im Kleingedruckten. „Alle
//      Einspeisungen führen Spannung" ist eine Voraussetzung der ganzen
//      Rechnung; wer sie nicht liest, hält das Ergebnis für eine Messung.
//   3. Was sich NICHT eintragen lässt, steht trotzdem da — mit dem Grund und
//      der fehlenden Klemme. Ein verschluckter Vorschlag liest sich wie
//      „alles in Ordnung".
//
// EINGETRAGEN WIRD NUR AUF KNOPFDRUCK, und immer der ganze Vorschlag. Ein
// halb eingetragener Zwei-Adern-Vorschlag wäre schlimmer als gar keiner: er
// sieht danach aus wie fertig.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useCircuitStore } from '../../store/circuitStore'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'
import { useTranslation } from '../../lib/i18n'
import { PanelHint } from '../shared/PanelHint'
import { planVorschlaege, type PlanVorschlag } from '../../lib/circuitSuggestPlan'
import type { TafelZeile } from '../../lib/circuitSuggest'

interface Props {
  open: boolean
  onClose: () => void
}

const Tafel = ({ zeilen }: { zeilen: readonly TafelZeile[] }) => {
  const schalter = Object.keys(zeilen[0]?.stellungen ?? {})
  if (schalter.length === 0) return null
  return (
    <div className="mt-1 overflow-x-auto">
      <table className="text-cp-xs tabular-nums">
        <thead>
          <tr className="text-cp-text-muted">
            {schalter.map((id) => (
              <th key={id} className="px-2 py-0.5 text-left font-normal">
                {id}
              </th>
            ))}
            <th className="px-2 py-0.5 text-left font-normal">Leuchte</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z, i) => (
            <tr key={i} className="border-t border-cp-border-muted">
              {schalter.map((id) => (
                <td key={id} className="px-2 py-0.5">
                  {z.stellungen[id]}
                </td>
              ))}
              <td className={`px-2 py-0.5 ${z.an ? 'text-cp-accent' : 'text-cp-text-muted'}`}>
                {z.an ? 'an' : 'aus'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CircuitSuggestDialog({ open, onClose }: Props) {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const addCablesBulk = useProjectStore((s) => s.addCablesBulk)
  const sim = useCircuitStore((s) => s.sim)
  const [offen, setOffen] = useState<number | null>(null)
  const [meldung, setMeldung] = useState<string>('')

  const { panelRef, titleId, dialogProps } = useDialogA11y(open, onClose)
  const backdrop = useBackdropClose(onClose)

  // Gerechnet wird nur, solange der Dialog offen ist. Die Suche probiert
  // Kombinationen durch; sie bei jedem Zeichenlauf des Canvas mitlaufen zu
  // lassen waere ein Preis fuer eine Auskunft, die niemand sehen will.
  const ergebnis = useMemo(
    () => (open ? planVorschlaege(project, sim) : null),
    [open, project, sim],
  )

  if (!open || !ergebnis) return null

  const eintragen = (v: PlanVorschlag) => {
    const stat = addCablesBulk(
      v.kanten.map((k) => ({
        name: t('canvas.circuit.suggest.cableName', 'Wire (suggested)'),
        type: k.steckertyp,
        length: 0,
        color: '#94a3b8',
        notes: t(
          'canvas.circuit.suggest.cableNote',
          'Added from a computed wiring suggestion.',
        ),
        fromEquipmentId: k.fromEquipmentId,
        fromPortId: k.fromPortId,
        toEquipmentId: k.toEquipmentId,
        toPortId: k.toPortId,
      })),
    )
    setMeldung(
      stat.skipped === 0
        ? t('canvas.circuit.suggest.done', '{n} wire(s) added.').replace(
            '{n}',
            String(stat.created),
          )
        : `${stat.created} eingetragen, ${stat.skipped} übersprungen: ${stat.skippedReasons.join(' ')}`,
    )
  }

  const { befunde, vorschlaege, annahmen, vollstaendig, grund } = ergebnis

  return (
    <div
      {...backdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="flex max-h-[85vh] w-full max-w-[720px] flex-col border border-cp-border bg-cp-surface-1 text-cp-text"
      >
        <header className="flex items-center justify-between border-b border-cp-border px-4 py-2">
          <h2 id={titleId} className="text-cp-lg font-semibold">
            {t('canvas.circuit.suggest.title', 'Wiring suggestions')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="av-focus bg-cp-surface-3 px-3 py-1 text-cp-xs hover:bg-cp-surface-2"
          >
            {t('common.close', 'Close')}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 text-cp-sm">
          <PanelHint
            text={t(
              'canvas.circuit.suggest.lead',
              'COMPUTED, not measured. Every suggestion has been tried out: it is listed only because the circuit does what it should in every switch position with it. The table beside it shows that.',
            )}
          />

          {annahmen.length > 0 && (
            <ul className="mb-3 list-disc pl-5 text-[12px] text-cp-text-muted">
              {annahmen.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}

          {befunde.length === 0 && vorschlaege.length === 0 && (
            <p className="text-cp-text-secondary">
              {t('canvas.circuit.suggest.nothing', 'Nothing to report.')}
            </p>
          )}

          {befunde.length > 0 && (
            <ul className="mb-4 space-y-1">
              {befunde.map((b, i) => (
                <li key={i} className="border border-cp-warn/40 bg-cp-surface-2 px-3 py-2">
                  <span className="text-cp-warn">{b.art}</span>
                  <span className="text-cp-text-secondary"> — {b.text}</span>
                </li>
              ))}
            </ul>
          )}

          {!vollstaendig && grund && (
            <p className="mb-4 border border-cp-border bg-cp-surface-2 px-3 py-2 text-[12px] text-cp-text-secondary">
              {t('canvas.circuit.suggest.capped', 'The search was limited: ')}
              {grund}
            </p>
          )}

          {vorschlaege.map((v, i) => (
            <div key={i} className="mb-2 border border-cp-border px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{v.text}</span>
                {v.hindernis === undefined ? (
                  <button
                    type="button"
                    onClick={() => eintragen(v)}
                    className="av-focus bg-cp-accent px-3 py-1 text-cp-xs text-cp-bg"
                  >
                    {t('canvas.circuit.suggest.apply', 'Add wire')}
                  </button>
                ) : (
                  <span className="text-cp-xs text-cp-warn">
                    {t('canvas.circuit.suggest.blocked', 'cannot be added')}
                  </span>
                )}
              </div>
              {v.hindernis && (
                <p className="mt-1 text-[12px] text-cp-text-secondary">{v.hindernis}</p>
              )}
              <button
                type="button"
                onClick={() => setOffen(offen === i ? null : i)}
                className="av-focus mt-1 text-cp-xs text-cp-text-muted underline"
              >
                {offen === i
                  ? t('canvas.circuit.suggest.hideTable', 'Hide truth table')
                  : t('canvas.circuit.suggest.showTable', 'Show truth table')}
              </button>
              {offen === i && <Tafel zeilen={v.wahrheitstafel} />}
            </div>
          ))}

          {meldung && <p className="mt-3 text-[12px] text-cp-accent">{meldung}</p>}
        </div>
      </div>
    </div>
  )
}
