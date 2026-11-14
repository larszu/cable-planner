/**
 * #1181 — Stecker je Kabelende aus dem Steckerkatalog, samt Konfektion.
 *
 * Zugeklappt, solange nichts gewaehlt ist: die meisten Kabel brauchen das
 * nicht, und wer es braucht, sieht es an der Ueberschrift.
 */
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { format, useTranslation } from '../../lib/i18n'
import {
  EINGEBAUTE_STECKER,
  konfektionFuer,
  konfektionsPreis,
  steckerById,
  steckerFuerTyp,
  teileEinesSteckers,
} from '../../lib/steckerKatalog'
import type { Cable } from '../../types/cable'
import type { SteckerWahl } from '../../types/stecker'

interface Props {
  cable: Cable
  connectorFrom?: string
  connectorTo?: string
}

export const SteckerKonfektionSection = ({ cable, connectorFrom, connectorTo }: Props) => {
  const t = useTranslation()
  const updateCable = useProjectStore((s) => s.updateCable)
  const gesetzt = Boolean(cable.steckerVon || cable.steckerNach)

  const ende = (feld: 'steckerVon' | 'steckerNach', label: string, connectorType?: string) => {
    const wahl = cable[feld]
    const stecker = steckerById(wahl?.steckerId)
    const auswahl = steckerFuerTyp(connectorType)
    const konfektion = stecker && wahl ? konfektionFuer(stecker, wahl, cable.aderAwg) : undefined
    const preis = stecker ? konfektionsPreis(stecker, konfektion) : undefined
    const setze = (next: SteckerWahl | undefined) => updateCable(cable.id, { [feld]: next })
    return (
      <div className="space-y-1">
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{label}</span>
          <select
            value={wahl?.steckerId ?? ''}
            onChange={(e) => setze(e.target.value ? { steckerId: e.target.value } : undefined)}
            className="w-full border border-cp-border bg-cp-surface-1 p-1.5"
          >
            <option value="">{t('stecker.none', '— not set —')}</option>
            {auswahl.map((s) => (
              <option key={s.id} value={s.id}>
                {s.hersteller} {s.teilenummer} ({s.polzahl}p, {s.geschlecht === 'male' ? t('stecker.male', 'male') : t('stecker.female', 'female')})
              </option>
            ))}
          </select>
        </label>
        {stecker && stecker.konfektionen.length > 1 && (
          <select
            value={konfektion?.id ?? ''}
            onChange={(e) => setze({ steckerId: stecker.id, konfektionId: e.target.value })}
            className="w-full border border-cp-border bg-cp-surface-1 p-1.5"
            title={t('stecker.konfektion', 'Assembly')}
          >
            {stecker.konfektionen.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        )}
        {stecker && (
          <ul className="space-y-0.5 text-cp-text-muted">
            {teileEinesSteckers(stecker, konfektion).map((z) => (
              <li key={z.teilenummer} className="flex justify-between gap-2">
                <span className="font-mono">{z.teilenummer}</span>
                <span className="truncate">{z.beschreibung}</span>
                <span className="shrink-0">{z.anzahl}×</span>
              </li>
            ))}
            <li>
              <a href={stecker.datenblattUrl} target="_blank" rel="noreferrer" className="text-cp-accent underline">
                {t('stecker.datasheet', 'Datasheet')}
              </a>
              {preis !== undefined && <span className="ml-2">{format(t('stecker.price', 'Price per end: {price}'), { price: preis.toFixed(2) })}</span>}
            </li>
          </ul>
        )}
      </div>
    )
  }

  return (
    <details className="border border-cp-border bg-cp-surface-3/40" open={gesetzt}>
      <summary className="cursor-pointer select-none px-2 py-1.5 text-cp-xs font-semibold text-cp-text-muted hover:bg-cp-surface-2/40">
        {t('stecker.section', 'Connector parts')}
      </summary>
      <div className="space-y-2 border-t border-cp-border p-2">
        {ende('steckerVon', t('stecker.endA', 'End A'), connectorFrom)}
        {ende('steckerNach', t('stecker.endB', 'End B'), connectorTo)}
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('stecker.awg', 'Conductor size (AWG)')}</span>
          <input
            type="number"
            min={1}
            max={40}
            value={cable.aderAwg ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value)
              updateCable(cable.id, { aderAwg: e.target.value && Number.isInteger(n) && n > 0 ? n : undefined })
            }}
            className="w-full border border-cp-border bg-cp-surface-1 p-1.5"
          />
        </label>
        <p className="text-cp-text-faint">
          {format(t('stecker.catalogNote', '{count} connectors in the catalogue, each with its manufacturer datasheet.'), {
            count: EINGEBAUTE_STECKER.length,
          })}
        </p>
      </div>
    </details>
  )
}
