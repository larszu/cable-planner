import { useRef, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useGrundrissUi } from '../../store/grundrissUiStore'
import { getViewportCenter } from '../../lib/canvasViewport'
import { downloadBlob } from '../../lib/downloadBlob'
import { meterJePixel } from '../../lib/grundriss/massstab'
import { parseVenueExchange } from '../../lib/grundriss/venueExchange'
import { grundrissAusVenue, venueAusGrundriss } from '../../lib/grundriss/venueAustausch'
import { format, useTranslation } from '../../lib/i18n'
import { PanelHint } from '../shared/PanelHint'
import { planAblage } from '../../avplan/floorplan/planDatei'
import { PLAN_ACCEPT, PLAN_PDF, planFehlerText, ungeeignetCode } from '../../lib/grundriss/planUebernahme'
import { planUebernehmen } from './planUebernehmen'

const Zahl = ({ wert, setze, einheit }: { wert: number; setze: (n: number) => void; einheit: string }) => (
  <label className="inline-flex items-center gap-1">
    <input
      type="number"
      min={0.01}
      step={0.01}
      value={wert}
      onChange={(e) => setze(Number(e.target.value))}
      className="w-20 px-1 py-0.5 bg-cp-surface-2 border border-cp-border text-cp-text"
    />
    <span className="text-cp-text-muted">{einheit}</span>
  </label>
)

export const GrundrissPanel = () => {
  const t = useTranslation()
  const offen = useGrundrissUi((s) => s.grundrissPanel)
  const setOffen = useGrundrissUi((s) => s.setGrundrissPanel)
  const starte = useGrundrissUi((s) => s.starteKalibrierung)
  const g = useProjectStore((s) => s.project.grundriss)
  const projektName = useProjectStore((s) => s.project.metadata.name)
  const setGrundriss = useProjectStore((s) => s.setGrundriss)
  const updateGrundriss = useProjectStore((s) => s.updateGrundriss)
  const estimate = useProjectStore((s) => s.estimateCableLengths)
  const [meter, setMeter] = useState(10)
  const [breite, setBreite] = useState(10)
  const [tiefe, setTiefe] = useState(10)
  const [meldung, setMeldung] = useState<string | null>(null)
  const bildInput = useRef<HTMLInputElement>(null)
  const venueInput = useRef<HTMLInputElement>(null)
  const [ablageAktiv, setAblageAktiv] = useState(false)

  if (!offen) return null

  const ursprung = () => {
    const m = getViewportCenter() ?? { x: 0, y: 0 }
    return { x: Math.round(m.x - 400), y: Math.round(m.y - 300) }
  }

  const bildGewaehlt = async (datei: File | undefined) => {
    if (!datei) return
    const r = await planUebernehmen({
      datei,
      ursprung: () => ursprung(),
      aktuell: useProjectStore.getState().project.grundriss,
      setze: setGrundriss,
      t,
    })
    if (r.status === 'ok') {
      setMeldung(t('floorplan.loaded', 'Floor plan loaded. Set the scale next — until then lengths use “metres per 100 px”.'))
    } else if (r.status === 'fehler') {
      setMeldung(r.text)
    }
  }

  // Drop aufs Panel: dieselbe Uebernahme wie die Dateiauswahl.
  const ablage = planAblage({
    pdf: PLAN_PDF,
    onAktiv: setAblageAktiv,
    onDatei: (datei) => void bildGewaehlt(datei),
    onUngeeignet: (dateien) => setMeldung(planFehlerText(ungeeignetCode(dateien), t)),
  })

  const venueGewaehlt = async (datei: File | undefined) => {
    if (!datei) return
    try {
      const ex = parseVenueExchange(await datei.text())
      setGrundriss(grundrissAusVenue(ex, ursprung()))
      setMeldung(format(t('floorplan.venueImported', 'Venue “{name}” imported from {app}, scale included.'), { name: ex.venue.name, app: ex.app }))
    } catch (e) {
      const grund = e instanceof Error ? e.message : ''
      setMeldung(
        grund === 'no-floor-plan'
          ? t('floorplan.venueNoPlan', 'The venue file carries no floor plan image.')
          : grund === 'no-scale'
            ? t('floorplan.venueNoScale', 'The venue file carries a floor plan without real dimensions.')
            : t('floorplan.venueInvalid', 'This is not a venue exchange file (MultiCam / Light Planner).'),
      )
    }
  }

  const venueExport = () => {
    if (!g) return
    const ex = venueAusGrundriss(g, 'cable-planner', __APP_VERSION__, projektName || 'Venue', new Date())
    if (!ex) return
    downloadBlob(`${projektName || 'venue'}.venue.json`, JSON.stringify(ex, null, 2), 'application/json')
  }

  const k = g?.kalibrierung
  const mJePx = k ? meterJePixel(k) : null
  const status = !k
    ? t('floorplan.scale.none', 'No scale set.')
    : k.art === 'zweiPunkt'
      ? format(t('floorplan.scale.twoPoint', 'Scale from {m} m reference: {cm} cm per canvas pixel.'), {
          m: k.meter,
          cm: mJePx == null ? '?' : (mJePx * 100).toFixed(2),
        })
      : format(t('floorplan.scale.rect', 'Perspective scale from a {w} × {d} m area.'), { w: k.breiteM, d: k.tiefeM })

  return (
    <div
      className={`fixed right-0 top-0 z-40 flex h-screen w-full max-w-[95vw] flex-col border-l bg-cp-surface-1 text-cp-text sm:w-96 text-sm ${
        ablageAktiv ? 'border-cp-accent outline outline-2 -outline-offset-2 outline-cp-accent' : 'border-cp-border'
      }`}
      data-testid="grundriss-panel"
      onDragOver={ablage.onDragOver}
      onDragLeave={(e) => {
        // Beim Wechsel auf ein Kind-Element feuert dragleave auch — nur das
        // echte Verlassen des Panels beendet die Markierung.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) ablage.onDragLeave()
      }}
      onDrop={ablage.onDrop}
    >
      <div className="flex items-center justify-between border-b border-cp-border px-3 py-2">
        <strong>{t('floorplan.title', 'Floor plan')}</strong>
        <button className="px-2 hover:bg-cp-surface-3" onClick={() => setOffen(false)} aria-label={t('common.close', 'Close')}>
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <input ref={bildInput} type="file" accept={PLAN_ACCEPT} hidden onChange={(e) => void bildGewaehlt(e.target.files?.[0])} />
        <input ref={venueInput} type="file" accept=".json,application/json" hidden onChange={(e) => void venueGewaehlt(e.target.files?.[0])} />
        <section className="space-y-2">
          <button className="w-full px-2 py-1 border border-cp-border hover:bg-cp-surface-3" onClick={() => bildInput.current?.click()}>
            {g ? t('floorplan.replaceImage', 'Replace image…') : t('floorplan.loadImage', 'Load floor plan image…')}
          </button>
          <button className="w-full px-2 py-1 border border-cp-border hover:bg-cp-surface-3" onClick={() => venueInput.current?.click()}>
            {t('floorplan.importVenue', 'Import venue from MultiCam / Light Planner…')}
          </button>
          <p className={ablageAktiv ? 'text-cp-accent' : 'text-cp-text-muted'}>
            {t('floorplan.dropHint', 'Or drop an image file here or onto the canvas.')}
          </p>
        </section>

        {g && (
          <>
            <section className="space-y-2">
              <div className="text-cp-text-secondary">{g.name}</div>
              <label className="flex items-center gap-2">
                <span className="w-24">{t('floorplan.opacity', 'Opacity')}</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={g.deckkraft}
                  onChange={(e) => updateGrundriss({ deckkraft: Number(e.target.value) })}
                  className="flex-1"
                />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!g.gesperrt} onChange={(e) => updateGrundriss({ gesperrt: e.target.checked })} />
                {t('floorplan.lock', 'Lock position (clicks go through to the devices)')}
              </label>
            </section>

            <section className="space-y-2 border-t border-cp-border pt-3">
              <strong>{t('floorplan.scale.title', 'Scale')}</strong>
              <div className="text-cp-text-secondary">{status}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Zahl wert={meter} setze={setMeter} einheit="m" />
                <button
                  className="px-2 py-1 border border-cp-border hover:bg-cp-surface-3 disabled:opacity-50"
                  disabled={!(meter > 0)}
                  onClick={() => starte({ art: 'zweiPunkt', meter })}
                >
                  {t('floorplan.scale.twoPointButton', 'Two points')}
                </button>
              </div>
              <p className="text-cp-text-muted">
                {t('floorplan.scale.twoPointHelp', 'For plans drawn straight from above (CAD export, scan): click both ends of a known distance.')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Zahl wert={breite} setze={setBreite} einheit="m" />
                <span>×</span>
                <Zahl wert={tiefe} setze={setTiefe} einheit="m" />
                <button
                  className="px-2 py-1 border border-cp-border hover:bg-cp-surface-3 disabled:opacity-50"
                  disabled={!(breite > 0 && tiefe > 0)}
                  onClick={() => starte({ art: 'rechteck', breiteM: breite, tiefeM: tiefe })}
                >
                  {t('floorplan.scale.rectButton', 'Four corners')}
                </button>
              </div>
              <PanelHint
                text={t(
                  'floorplan.scale.rectHelp',
                  'For photos, signs and isometric drawings: click the corners of a rectangular floor area of known size. Distances on the floor are then measured correctly in every direction; heights shown in the picture are not.',
                )}
              />
            </section>

            <section className="space-y-2 border-t border-cp-border pt-3">
              <button
                className="w-full px-2 py-1 border border-cp-border hover:bg-cp-surface-3"
                onClick={() => {
                  const n = estimate()
                  setMeldung(format(t('floorplan.lengthsDone', '{n} cable lengths recalculated along their drawn routes.'), { n }))
                }}
              >
                {t('floorplan.recalc', 'Recalculate cable lengths')}
              </button>
              <button
                className="w-full px-2 py-1 border border-cp-border hover:bg-cp-surface-3 disabled:opacity-50"
                disabled={mJePx == null}
                title={
                  mJePx == null
                    ? t('floorplan.exportNeedsUniform', 'The venue exchange carries one scale per plan; a four-corner calibration cannot be expressed in it.')
                    : undefined
                }
                onClick={venueExport}
              >
                {t('floorplan.exportVenue', 'Export venue for MultiCam / Light Planner')}
              </button>
              <button className="w-full px-2 py-1 border border-cp-border text-cp-danger hover:bg-cp-surface-3" onClick={() => setGrundriss(null)}>
                {t('floorplan.remove', 'Remove floor plan')}
              </button>
            </section>
          </>
        )}
        {meldung && <p className="border-l-2 border-cp-warn pl-2">{meldung}</p>}
      </div>
    </div>
  )
}
