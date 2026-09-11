import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import { CIRCUIT_KINDS, CIRCUIT_KIND_INFO, type CircuitKind } from '../../../types/circuit'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'

/**
 * Die Schaltbild-Angaben eines Geräts (Strom, 2026-09-08).
 *
 * WARUM ES DIESE SEKTION ÜBERHAUPT GIBT. Der Schaltbild-Rechner
 * (`lib/circuitSolver.ts`) beantwortet die Frage „welche Leuchte brennt bei
 * welcher Schalterstellung". Er braucht dafür zwei Angaben, die niemand
 * erraten kann und die diese Sektion aufnimmt:
 *
 *   1. WAS das Gerät im Stromkreis IST. Aus der Kategorie zu schliessen wäre
 *      ein Namensabgleich („Leuchte" → `lamp`), und er fiele in die
 *      gefährliche Richtung: eine „Wandleuchte" bekäme keinen Knoten, und der
 *      Rechner sagte „brennt nicht". Das sieht aus wie eine Antwort.
 *
 *   2. AN WELCHER KLEMME ein Anschluss hängt. Eine Wechselschaltung
 *      unterscheidet Klemme 1 von Klemme 2 — vertauscht man sie, brennt die
 *      Leuchte bei genau den umgekehrten Stellungen.
 *
 * WAS HIER NICHT STEHT: die Schalterstellung. Die ist Ausprobieren, nicht
 * Planen, und liegt im nicht persistierten `circuitStore` (umgelegt wird am
 * Canvas). Stünde sie hier, ginge jedes Umlegen durch Undo/Redo und in die
 * Projektdatei.
 */
export const CircuitSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const kind = equipment.circuitKind
  const info = kind ? CIRCUIT_KIND_INFO[kind] : undefined
  const summary = info ? info.label : t('circuit.none', 'none')

  const alleAnschluesse = [...equipment.inputs, ...equipment.outputs]

  const setzeKlemme = (portId: string, wert: number | undefined) => {
    updateEquipment(equipment.id, {
      inputs: equipment.inputs.map((p) =>
        p.id === portId ? { ...p, circuitTerminal: wert } : p,
      ),
      outputs: equipment.outputs.map((p) =>
        p.id === portId ? { ...p, circuitTerminal: wert } : p,
      ),
    })
  }

  return (
    <SortableSection id="circuit" title={t('circuit.title', 'Circuit (mains)')} subtitle={summary}>
      <label className="block text-cp-xs">
        <span className="mb-1 block text-cp-text-muted">{t('circuit.kind', 'Role in the circuit')}</span>
        <select
          className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
          value={kind ?? ''}
          onChange={(e) =>
            updateEquipment(equipment.id, {
              circuitKind: e.target.value ? (e.target.value as CircuitKind) : undefined,
            })
          }
        >
          <option value="">{t('circuit.none', 'none')}</option>
          {CIRCUIT_KINDS.map((k) => (
            <option key={k} value={k}>
              {CIRCUIT_KIND_INFO[k].label}
            </option>
          ))}
        </select>
      </label>

      {!kind && (
        <PanelHint
          className="mt-2 text-cp-xs text-cp-text-muted"
          text={t(
            'circuit.noneHint',
            'Without a role this device does not exist for the circuit — it is calculated neither as a luminaire nor as a junction. That is not the same as "off".',
          )}
        />
      )}

      {kind && info && info.klemmen.length > 0 && (
        <>
          <div className="mt-3 text-cp-xs text-cp-text-muted">
            {t('circuit.terminals', 'Terminals of this role')}: {info.klemmen.join(', ')}
          </div>
          {alleAnschluesse.length === 0 ? (
            <PanelHint
              className="mt-2 text-cp-xs text-cp-text-muted"
              text={t(
                'circuit.noPorts',
                'This device has no connectors. Without them no line can be attached, and the circuit stays empty at this point.',
              )}
            />
          ) : (
            <div className="mt-2 space-y-1">
              {alleAnschluesse.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-cp-xs">
                  <span className="min-w-0 flex-1 truncate text-cp-text-secondary">{p.name}</span>
                  <select
                    className="w-24 border border-cp-border bg-cp-surface-2 px-1 py-0.5 text-cp-text"
                    value={p.circuitTerminal ?? ''}
                    onChange={(e) =>
                      setzeKlemme(p.id, e.target.value === '' ? undefined : Number(e.target.value))
                    }
                  >
                    <option value="">{t('circuit.terminalDefault', 'Terminal 0')}</option>
                    {info.klemmen.map((n) => (
                      <option key={n} value={n}>
                        {t('circuit.terminalN', 'Terminal {n}').replace('{n}', String(n))}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <PanelHint
            className="mt-2 text-cp-xs text-cp-text-muted"
            text={t(
              'circuit.terminalHint',
              'The terminal belongs to the connector, not to its position in the list — reordering does not rewire the circuit.',
            )}
          />
        </>
      )}
    </SortableSection>
  )
}
