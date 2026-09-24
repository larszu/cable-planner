/**
 * facility#15 — welche Hausstrecke und welche Ader dieses Kabel benutzt.
 *
 * Fuer die Festinstallation und die Messehalle: „Video in die 3. Etage" geht
 * ueber eine feste Leitung des Hauses, und die hat Adern, Stecker und an
 * beiden Enden eine Blende. Das Haus nennt sie in seiner Auskunft
 * (`.avfacility` v2); der Plan erklaert hier nur, welche er belegt — und
 * sieht dabei, welche Ader schon ein anderes Kabel hat.
 *
 * Erscheint nur, wenn eine Auskunft mit Hausstrecken hinterlegt ist.
 */
import { Cable as CableIcon } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { format, useTranslation } from '../../lib/i18n'
import { streckenBelegung, streckenWeg } from '../../lib/hausStrecken'
import { Icon } from '../shared/Icon'
import type { Cable } from '../../types/cable'

export const HausStreckeSection = ({ cable }: { cable: Cable }) => {
  const t = useTranslation()
  const auskunft = useProjectStore((s) => s.project.hausAuskunft)
  const cables = useProjectStore((s) => s.project.cables)
  const updateCable = useProjectStore((s) => s.updateCable)
  if (!auskunft || auskunft.strecken.length === 0) return null

  const belegung = cable.hausStreckeId ? streckenBelegung(auskunft, cables, cable.hausStreckeId) : undefined
  const nameVon = (id: string) => {
    const c = cables.find((x) => x.id === id)
    return c ? c.cableNumber || c.name : id
  }

  return (
    <div className="border border-cp-border bg-cp-surface-3/50 p-2 text-cp-xs">
      <div className="mb-1 font-semibold uppercase tracking-wide text-cp-text-muted">
        <Icon icon={CableIcon} size="xs" className="mr-1 inline" />
        {t('hausStrecke.title', 'House run')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-cp-text-muted">{t('hausStrecke.run', 'Run')}</span>
          <select
            value={cable.hausStreckeId ?? ''}
            onChange={(e) =>
              updateCable(cable.id, { hausStreckeId: e.target.value || undefined, hausAder: undefined })
            }
            className="mt-0.5 w-full border border-cp-border bg-cp-surface-3 p-1"
          >
            <option value="">{t('hausStrecke.none', '— none —')}</option>
            {auskunft.strecken.map((s) => (
              <option key={s.id} value={s.id}>
                {s.bezeichnung}
              </option>
            ))}
            {cable.hausStreckeId && !belegung && (
              <option value={cable.hausStreckeId}>
                {t('hausStrecke.missingOption', '(no longer in the building statement)')}
              </option>
            )}
          </select>
        </label>
        {belegung && belegung.adern.length > 0 && (
          <label className="block">
            <span className="text-cp-text-muted">{t('hausStrecke.core', 'Core / port')}</span>
            <select
              value={cable.hausAder ?? ''}
              onChange={(e) => updateCable(cable.id, { hausAder: e.target.value || undefined })}
              className="mt-0.5 w-full border border-cp-border bg-cp-surface-3 p-1"
            >
              <option value="">{t('hausStrecke.wholeRun', '— whole run —')}</option>
              {belegung.adern.map(({ ader, kabel }) => {
                const fremd = kabel.filter((k) => k !== cable.id)
                const info = [ader.stecker, ader.signal].filter(Boolean).join(' · ')
                return (
                  <option key={ader.nr} value={ader.nr}>
                    {ader.nr}
                    {info ? ` (${info})` : ''}
                    {fremd.length > 0
                      ? ` — ${format(t('hausStrecke.takenBy', 'used by {cables}'), { cables: fremd.map(nameVon).join(', ') })}`
                      : ''}
                  </option>
                )
              })}
            </select>
          </label>
        )}
      </div>
      {cable.hausStreckeId && !belegung && (
        <p className="mt-1 text-cp-danger">
          {format(
            t('hausStrecke.missing', 'The building statement of {stand} no longer lists this run.'),
            { stand: auskunft.gelesenAm.slice(0, 10) },
          )}
        </p>
      )}
      {belegung && (
        <div className="mt-1 flex flex-col gap-0.5">
          <span className="text-cp-text">{streckenWeg(auskunft, belegung.strecke)}</span>
          {belegung.adern.length > 0 && (
            <span className="text-cp-text-muted">
              {format(t('hausStrecke.occupancy', '{used} of {total} cores used in this plan'), {
                used: belegung.adern.filter((a) => a.kabel.length > 0).length,
                total: belegung.adern.length,
              })}
            </span>
          )}
          {belegung.adern
            .filter((a) => a.kabel.length > 1)
            .map((a) => (
              <span key={a.ader.nr} className="text-cp-warn">
                {format(t('hausStrecke.conflict', 'Core {nr} is used by several cables: {cables}'), {
                  nr: a.ader.nr,
                  cables: a.kabel.map(nameVon).join(', '),
                })}
              </span>
            ))}
          {belegung.unbekannteAder.some((u) => u.kabelId === cable.id) && (
            <span className="text-cp-warn">
              {format(t('hausStrecke.unknownCore', 'The building lists no core "{nr}" on this run.'), {
                nr: cable.hausAder ?? '',
              })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
