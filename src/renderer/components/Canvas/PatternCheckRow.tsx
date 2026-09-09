import { useState } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { usePatternStore } from '../../store/patternStore'
import { useBefund } from '../../hooks/usePattern'
import { useTranslation } from '../../lib/i18n'
import type { PatternObservation } from '../../types/patternCheck'

/**
 * Die Rückmeldung vom Rundgang, direkt am Ankunftsort (B-42, Inkrement 2).
 *
 * WARUM AM KNOTEN UND NICHT IN EINEM DIALOG. Wer prüft, steht vor dem
 * Monitor und hat den Plan daneben. Ein Dialog, in dem er den Ankunftsort
 * erst suchen müsste, ist genau die Reibung, wegen der Prüfungen nicht
 * eingetragen werden — und eine nicht eingetragene Prüfung ist keine.
 *
 * DER GESEHENE NAME IST EIN EIGENES FELD, kein Freitext-Vermerk. „Falsches
 * Bild" sagt: irgendetwas stimmt nicht. „Es steht KAMERA 3 drauf" sagt WAS
 * nicht stimmt, und `patternDiagnose` macht daraus „diese beiden Ausgänge
 * sind vertauscht". Deshalb fragt der Knopf danach, statt es freizustellen.
 *
 * KEIN `window.prompt`. Dieselbe Entscheidung wie bei E-15: eine Frage, die
 * den Rest der App anhält und deren Abbrechen mehrdeutig ist, gehört hier
 * nicht hin. Das Feld erscheint an Ort und Stelle, und Abbrechen heisst
 * abbrechen.
 */
export function PatternCheckRow({ equipmentId }: { equipmentId: string }) {
  const t = useTranslation()
  const befund = useBefund(equipmentId)
  const quelleId = usePatternStore((s) => s.quelleId)
  const recordPatternCheck = useProjectStore((s) => s.recordPatternCheck)
  const [nameOffen, setNameOffen] = useState(false)
  const [name, setName] = useState('')

  if (!befund || !quelleId) return null

  const melde = (gesehen: PatternObservation, gesehenerName?: string) => {
    recordPatternCheck({
      at: new Date().toISOString(),
      quelleId,
      equipmentId,
      gesehen,
      ...(gesehenerName ? { gesehenerName } : {}),
    })
    setNameOffen(false)
    setName('')
  }

  const farbe =
    befund.art === 'stimmt'
      ? '#22c55e'
      : befund.art === 'noch-offen'
        ? '#94a3b8'
        : befund.art === 'vertauscht'
          ? '#f97316'
          : '#ef4444'

  const knopf: React.CSSProperties = {
    fontSize: 9,
    lineHeight: '14px',
    padding: '0 4px',
    borderRadius: 3,
    border: '1px solid currentColor',
    background: 'transparent',
    cursor: 'pointer',
    opacity: 0.9,
  }

  return (
    <div className="nodrag" style={{ marginTop: 3 }}>
      <div style={{ fontSize: 9, lineHeight: '12px', color: farbe }}>{befund.text}</div>
      <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
        <button type="button" style={knopf} onClick={() => melde('stimmt')}>
          {t('canvas.pattern.check.ok', 'correct')}
        </button>
        <button type="button" style={knopf} onClick={() => setNameOffen((v) => !v)}>
          {t('canvas.pattern.check.wrong', 'different image…')}
        </button>
        <button type="button" style={knopf} onClick={() => melde('kein-bild')}>
          {t('canvas.pattern.check.none', 'no image')}
        </button>
        <button type="button" style={knopf} onClick={() => melde('kein-monitor')}>
          {t('canvas.pattern.check.noMonitor', 'no monitor')}
        </button>
      </div>
      {nameOffen && (
        <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) melde('falsches-bild', name.trim())
              if (e.key === 'Escape') setNameOffen(false)
            }}
            placeholder={t('canvas.pattern.check.seenPlaceholder', 'Which name is on it?')}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 9,
              lineHeight: '14px',
              padding: '0 3px',
              borderRadius: 3,
              border: '1px solid currentColor',
              background: 'transparent',
              color: 'inherit',
            }}
          />
          <button
            type="button"
            style={knopf}
            disabled={!name.trim()}
            onClick={() => melde('falsches-bild', name.trim())}
          >
            {t('canvas.pattern.check.save', 'record')}
          </button>
        </div>
      )}
    </div>
  )
}
