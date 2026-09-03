import { useState } from 'react'
import { useTranslation } from './i18n'
import {
  MODAL_BACKDROP,
  MODAL_BUTTON_SECONDARY,
  MODAL_CARD,
  backdropMouseDown,
  modalButtonPrimary,
  mountModal,
  useModalKeyboard,
} from './modalRoot'

/**
 * ADR-005 — was mit einem `.avplan`-Slot geschieht, den diese App nicht kennt.
 *
 * Bis hierher galt das schlechteste der drei Verhalten: die Datei wurde
 * angenommen und der fremde Slot weggeworfen. Weder bewahrt noch verweigert
 * noch gemeldet — alle drei Auswege aus Regel 3 verfehlt.
 *
 * Jetzt: laden, fragen, und den Slot belegen lassen. Die drei Antworten sind
 * nicht gleichwertig und sollen es auch nicht sein —
 *
 *   - `keep` ist die Vorauswahl und die einzige, die nichts entscheidet: der
 *     Slot wandert unveraendert ins Projektfile und steht beim naechsten
 *     Export wieder in der Datei.
 *   - `assign` ist die eigentliche Belegung: der fremde Inhalt wird als eine
 *     der bekannten Domaenen uebernommen. Das ist eine Behauptung des
 *     NUTZERS ueber fremde Daten, keine der App — deshalb nur auf
 *     ausdrueckliche Wahl und nur in einen Slot, der leer ist.
 *   - `discard` wirft weg, aber sichtbar. Der Unterschied zum alten Verhalten
 *     ist nicht das Ergebnis, sondern dass jemand es wollte.
 */
export type UnknownSlotAction =
  | { kind: 'keep' }
  | { kind: 'assign'; target: string }
  | { kind: 'discard' }

export type UnknownSlotDecisions = Record<string, UnknownSlotAction>

export function unknownDomainsDialog(
  slots: string[],
  /** Bekannte Slots, die in dieser Datei leer sind — nur die sind belegbar. */
  freeTargets: string[],
): Promise<UnknownSlotDecisions | null> {
  return mountModal<UnknownSlotDecisions | null>((done) => (
    <UnknownDomainsDialog slots={slots} freeTargets={freeTargets} onDone={done} />
  ))
}

interface Props {
  slots: string[]
  freeTargets: string[]
  onDone: (value: UnknownSlotDecisions | null) => void
}

const UnknownDomainsDialog = ({ slots, freeTargets, onDone }: Props) => {
  const t = useTranslation()
  const [decisions, setDecisions] = useState<UnknownSlotDecisions>(() =>
    Object.fromEntries(slots.map((slot) => [slot, { kind: 'keep' } as UnknownSlotAction])),
  )

  // Abbrechen heisst hier NICHT „verwerfen": wer den Dialog wegklickt, hat
  // nichts entschieden, und die vorsichtige Lesart davon ist „alles behalten".
  const cancel = () => onDone(null)
  useModalKeyboard(cancel, () => onDone(decisions))

  const set = (slot: string, action: UnknownSlotAction) =>
    setDecisions((prev) => ({ ...prev, [slot]: action }))

  return (
    <div style={MODAL_BACKDROP} onMouseDown={backdropMouseDown(cancel)}>
      <div style={{ ...MODAL_CARD, maxWidth: 560 }} role="dialog" aria-modal="true">
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
          {t('avplan.unknown.title', 'Diese Datei enthält unbekannte Bereiche')}
        </div>
        <div style={{ marginBottom: 12, fontSize: 13, color: '#cbd5e1' }}>
          {t(
            'avplan.unknown.body',
            'Die Datei bringt Bereiche mit, die diese App nicht kennt — vermutlich aus einer neueren Fassung oder einem anderen Gewerk. Sie werden standardmäßig unverändert mitgeführt und stehen beim nächsten Export wieder in der Datei.',
          )}
        </div>

        <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          {slots.map((slot) => {
            const decision = decisions[slot]
            return (
              <div
                key={slot}
                style={{
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: 10,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{slot}</div>
                <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="radio"
                    name={`slot-${slot}`}
                    checked={decision.kind === 'keep'}
                    onChange={() => set(slot, { kind: 'keep' })}
                  />
                  {t('avplan.unknown.keep', 'Mitführen (unverändert, bleibt beim Export erhalten)')}
                </label>

                {freeTargets.length > 0 && (
                  <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="radio"
                      name={`slot-${slot}`}
                      checked={decision.kind === 'assign'}
                      onChange={() => set(slot, { kind: 'assign', target: freeTargets[0] })}
                    />
                    {t('avplan.unknown.assign', 'Übernehmen als')}
                    <select
                      disabled={decision.kind !== 'assign'}
                      value={decision.kind === 'assign' ? decision.target : freeTargets[0]}
                      onChange={(e) => set(slot, { kind: 'assign', target: e.target.value })}
                      style={{ fontSize: 12, background: '#1e293b', color: '#e2e8f0' }}
                    >
                      {freeTargets.map((target) => (
                        <option key={target} value={target}>
                          {target}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="radio"
                    name={`slot-${slot}`}
                    checked={decision.kind === 'discard'}
                    onChange={() => set(slot, { kind: 'discard' })}
                  />
                  {t('avplan.unknown.discard', 'Verwerfen')}
                </label>
              </div>
            )
          })}
        </div>

        {freeTargets.length === 0 && (
          <div style={{ marginBottom: 12, fontSize: 12, color: '#94a3b8' }}>
            {t(
              'avplan.unknown.noTargets',
              'Kein bekannter Bereich ist frei — Übernehmen steht deshalb nicht zur Wahl.',
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={cancel} style={MODAL_BUTTON_SECONDARY}>
            {t('avplan.unknown.keepAll', 'Alle mitführen')}
          </button>
          <button
            type="button"
            onClick={() => onDone(decisions)}
            style={modalButtonPrimary('#10b981')}
          >
            {t('common.ok', 'OK')}
          </button>
        </div>
      </div>
    </div>
  )
}
