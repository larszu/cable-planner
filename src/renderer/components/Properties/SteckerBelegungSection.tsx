/**
 * #1179 — Belegung je Kabel: Ader → Pin mit Signalname, Pinbild und
 * Konfektionsblatt zum Drucken.
 *
 * Eine Zeile anklicken markiert ihren Pin im Bild; einen Pin anklicken
 * markiert seine Zeile. Zugeklappt, solange keine Belegung gesetzt ist.
 */
import { useState } from 'react'
import { Printer, Trash2 } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { format, useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import {
  belegungAusVorlage,
  konfektionsblattHtml,
  pinbild,
  vorlageById,
  vorlagenFuer,
  weichtAb,
} from '../../lib/steckerBelegung'
import { steckerById } from '../../lib/steckerKatalog'
import { printHtmlDocument } from '../../lib/printHtml'
import type { Cable } from '../../types/cable'
import type { BelegungsZeile } from '../../types/stecker'

interface Props {
  cable: Cable
  connectorType?: string
  von: string
  nach: string
}

export const SteckerBelegungSection = ({ cable, connectorType, von, nach }: Props) => {
  const t = useTranslation()
  const updateCable = useProjectStore((s) => s.updateCable)
  const [markiert, setMarkiert] = useState<number | null>(null)
  const belegung = cable.belegung
  const zeilen = belegung?.zeilen ?? []
  const vorlage = vorlageById(belegung?.vorlageId)
  // Polzahl aus dem Stecker an Ende A, wenn gewaehlt — sonst alle Vorlagen des Steckertyps.
  const polzahl = steckerById(cable.steckerVon?.steckerId)?.polzahl
  const vorlagen = vorlagenFuer(connectorType, polzahl)
  const auswahl = vorlagen.length > 0 ? vorlagen : vorlagenFuer(undefined, polzahl)

  const setzeZeilen = (next: BelegungsZeile[]) =>
    updateCable(cable.id, {
      belegung: next.length > 0 ? { ...(belegung?.vorlageId ? { vorlageId: belegung.vorlageId } : {}), zeilen: next } : undefined,
    })
  const aendere = (i: number, feld: keyof BelegungsZeile, wert: string) =>
    setzeZeilen(zeilen.map((z, j) => (j === i ? { ...z, [feld]: wert || undefined, pin: feld === 'pin' ? wert : z.pin } : z)))

  const pins = pinbild(zeilen.map((z) => z.pin), vorlage?.anordnung ?? 'kreis')
  const groesse = 100
  const r = Math.min(8, 30 / Math.max(1, pins.length) + 3)

  return (
    <details className="border border-cp-border bg-cp-surface-3/40" open={zeilen.length > 0}>
      <summary className="cursor-pointer select-none px-2 py-1.5 text-cp-xs font-semibold text-cp-text-muted hover:bg-cp-surface-2/40">
        {t('belegung.section', 'Pinout')}
      </summary>
      <div className="space-y-2 border-t border-cp-border p-2">
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('belegung.template', 'Standard pinout')}</span>
          <select
            value={belegung?.vorlageId ?? ''}
            onChange={(e) => {
              const v = vorlageById(e.target.value)
              updateCable(cable.id, { belegung: v ? { vorlageId: v.id, zeilen: belegungAusVorlage(v) } : belegung && { zeilen: belegung.zeilen } })
            }}
            className="w-full border border-cp-border bg-cp-surface-1 p-1.5"
          >
            <option value="">{t('belegung.custom', '— own pinout —')}</option>
            {auswahl.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        {vorlage && (
          <p className="text-cp-text-faint" title={vorlage.quelle}>
            {weichtAb(cable)
              ? format(t('belegung.fromTemplateModified', 'From {name}, modified for this cable.'), { name: vorlage.name })
              : format(t('belegung.sourceLine', 'Source: {source}'), { source: vorlage.quelle })}
          </p>
        )}
        {pins.length > 0 && (
          <svg
            viewBox={`0 0 ${groesse} ${groesse}`}
            className="mx-auto block h-24 w-24 text-cp-text-secondary"
            role="img"
            aria-label={t('belegung.picture', 'Pin picture')}
          >
            <rect x={1} y={1} width={groesse - 2} height={groesse - 2} fill="none" stroke="currentColor" strokeWidth={1} />
            {pins.map((p, i) => (
              <g key={`${p.nr}-${i}`} onClick={() => setMarkiert(i)} className="cursor-pointer">
                <circle
                  cx={p.x * groesse}
                  cy={p.y * groesse}
                  r={r}
                  fill={markiert === i ? 'currentColor' : 'transparent'}
                  stroke="currentColor"
                  className={markiert === i ? 'text-cp-accent' : undefined}
                />
                <text x={p.x * groesse} y={p.y * groesse + r * 2.3} fontSize={r * 1.2} textAnchor="middle" fill="currentColor">
                  {p.nr}
                </text>
              </g>
            ))}
          </svg>
        )}
        {pins.length > 0 && (
          <p className="text-center text-cp-text-faint">
            {vorlage?.anordnung === 'reihe'
              ? t('belegung.sheet.row', 'Contacts 1 to n side by side.')
              : t('belegung.sheet.schematic', 'Schematic: number of pins and numbering. The real position is in the connector datasheet.')}
          </p>
        )}
        {zeilen.length > 0 && (
          <table className="block w-full overflow-x-auto">
            <thead className="text-cp-text-secondary">
              <tr>
                <th className="text-left">{t('belegung.col.pinA', 'Pin A')}</th>
                <th className="text-left">{t('belegung.col.pinB', 'Pin B')}</th>
                <th className="text-left">{t('belegung.col.wire', 'Wire')}</th>
                <th className="text-left">{t('belegung.col.signal', 'Signal')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z, i) => (
                <tr
                  key={i}
                  onClick={() => setMarkiert(i)}
                  className={markiert === i ? 'bg-cp-accent-soft' : undefined}
                >
                  <td><input value={z.pin} onChange={(e) => aendere(i, 'pin', e.target.value)} className="w-10 border border-cp-border bg-cp-surface-1 px-1" /></td>
                  <td><input value={z.pinB ?? ''} placeholder={z.pin} onChange={(e) => aendere(i, 'pinB', e.target.value)} className="w-10 border border-cp-border bg-cp-surface-1 px-1" /></td>
                  <td><input value={z.ader ?? ''} onChange={(e) => aendere(i, 'ader', e.target.value)} className="w-full border border-cp-border bg-cp-surface-1 px-1" /></td>
                  <td><input value={z.signal ?? ''} onChange={(e) => aendere(i, 'signal', e.target.value)} className="w-full border border-cp-border bg-cp-surface-1 px-1" /></td>
                  <td>
                    <button
                      type="button"
                      title={t('belegung.removeRow', 'Remove row')}
                      onClick={(e) => {
                        e.stopPropagation()
                        setMarkiert(null)
                        setzeZeilen(zeilen.filter((_, j) => j !== i))
                      }}
                      className="p-0.5 text-cp-text-muted hover:text-cp-danger"
                    >
                      <Icon icon={Trash2} size="xs" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setzeZeilen([...zeilen, { pin: String(zeilen.length + 1) }])}
            className="border border-cp-border bg-cp-surface-2 px-2 py-1 hover:bg-cp-surface-3"
          >
            {t('belegung.addRow', '+ Pin')}
          </button>
          {(zeilen.length > 0 || cable.steckerVon || cable.steckerNach) && (
            <button
              type="button"
              onClick={() => printHtmlDocument(konfektionsblattHtml({ cable, von, nach }, t))}
              className="inline-flex items-center gap-1 border border-cp-border bg-cp-surface-2 px-2 py-1 hover:bg-cp-surface-3"
            >
              <Icon icon={Printer} size="xs" />
              {t('belegung.print', 'Assembly sheet')}
            </button>
          )}
        </div>
      </div>
    </details>
  )
}
