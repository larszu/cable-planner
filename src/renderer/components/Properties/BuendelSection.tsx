/**
 * #1178 — Aussendurchmesser des Kabels und der Querschnitt seiner Trasse.
 *
 * Das Schnittbild zeigt jedes Kabel der Trasse als Kreis (dieses Kabel
 * hervorgehoben), aussen die gestrichelte Huelle. Mit eingetragenem Rohr
 * kommen Fuellgrad und Grenzwert dazu. Ohne Trasse nur das Durchmesser-Feld.
 */
import { useMemo } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { format, useTranslation } from '../../lib/i18n'
import { kabelAussendurchmesserMm, trassenBuendel } from '../../lib/buendel'
import { cableCatalog } from '../../types/cableSpec'
import type { Cable } from '../../types/cable'

export const BuendelSection = ({ cable }: { cable: Cable }) => {
  const t = useTranslation()
  const cables = useProjectStore((s) => s.project.cables)
  const ductMm = useProjectStore((s) => s.project.pathwayDuctMm)
  const updateCable = useProjectStore((s) => s.updateCable)
  const setPathwayDuct = useProjectStore((s) => s.setPathwayDuct)
  const customSpecs = useUiStore((s) => s.customCableSpecs)
  const specs = useMemo(() => [...cableCatalog, ...customSpecs], [customSpecs])
  const trasse = cable.pathway?.trim()
  const buendel = useMemo(
    () => (trasse ? trassenBuendel(cables, ductMm, specs).find((b) => b.trasse === trasse) : undefined),
    [cables, ductMm, specs, trasse],
  )
  const ausTyp = kabelAussendurchmesserMm({ cableSpecId: cable.cableSpecId }, specs)

  const svg = () => {
    if (!buendel || buendel.packung.kreise.length === 0) return null
    const R = buendel.packung.huelle.r
    const innenR = buendel.innenDurchmesserMm ? buendel.innenDurchmesserMm / 2 : 0
    const aussen = Math.max(R, innenR) * 1.08
    return (
      <svg
        viewBox={`${-aussen} ${-aussen} ${aussen * 2} ${aussen * 2}`}
        className="mx-auto block h-32 w-32"
        role="img"
        aria-label={t('bundle.svgLabel', 'Cross-section of the bundle')}
      >
        {innenR > 0 && (
          <circle cx={0} cy={0} r={innenR} fill="none" stroke="currentColor" strokeWidth={aussen * 0.015} className="text-cp-text-muted" />
        )}
        <circle cx={0} cy={0} r={R} fill="none" stroke="currentColor" strokeDasharray={`${aussen * 0.04} ${aussen * 0.03}`} strokeWidth={aussen * 0.012} className="text-cp-text-secondary" />
        {buendel.packung.kreise.map((k, i) => {
          const c = buendel.kabel[i]
          const selbst = c?.id === cable.id
          return (
            <circle
              key={c?.id ?? i}
              cx={k.x}
              cy={k.y}
              r={k.r}
              fill={c?.color}
              fillOpacity={selbst ? 1 : 0.55}
              stroke={selbst ? 'currentColor' : 'none'}
              strokeWidth={aussen * 0.02}
              className="text-cp-accent"
            >
              <title>{c ? c.cableNumber || c.name : ''}</title>
            </circle>
          )
        })}
      </svg>
    )
  }

  return (
    <div className="space-y-2 border border-cp-border bg-cp-surface-1/40 p-2">
      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">{t('bundle.outerDiameter', 'Outer diameter (mm)')}</span>
        <input
          type="number"
          min={0}
          step={0.1}
          value={cable.outerDiameterMm ?? ''}
          placeholder={ausTyp ? String(ausTyp) : t('bundle.fromDatasheet', 'from the datasheet')}
          onChange={(e) => {
            const n = Number(e.target.value)
            updateCable(cable.id, { outerDiameterMm: e.target.value && n > 0 ? n : undefined })
          }}
          className="w-full border border-cp-border bg-cp-surface-1 p-1.5"
        />
      </label>
      {trasse && buendel && (
        <>
          <div className="font-medium text-cp-text-secondary">
            {format(t('bundle.summary', 'Pathway {pathway}: {count} cables · Ø {diameter} mm · {area} mm²'), {
              pathway: trasse,
              count: buendel.kabel.length,
              diameter: buendel.aussendurchmesserMm,
              area: buendel.querschnittMm2,
            })}
          </div>
          {buendel.ohneDurchmesser.length > 0 && (
            <div className="text-cp-warn">
              {format(t('bundle.missing', '{count} cables in this pathway have no diameter and are not counted.'), {
                count: buendel.ohneDurchmesser.length,
              })}
            </div>
          )}
          {svg()}
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">{t('bundle.duct', 'Duct inner diameter (mm)')}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={buendel.innenDurchmesserMm ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value)
                setPathwayDuct(trasse, e.target.value && n > 0 ? n : undefined)
              }}
              className="w-full border border-cp-border bg-cp-surface-1 p-1.5"
            />
          </label>
          {buendel.fuellgrad && (
            <div className={buendel.fuellgrad.passt ? 'text-cp-ok' : 'font-medium text-cp-danger'}>
              {format(t('bundle.fill', 'Fill {fill} % (limit {limit} %)'), {
                fill: Math.round(buendel.fuellgrad.anteil * 100),
                limit: Math.round(buendel.fuellgrad.grenze * 100),
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
