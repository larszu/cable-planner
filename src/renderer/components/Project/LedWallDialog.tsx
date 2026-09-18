// ───────────────────────────────────────────────────────────────────────────
// Der LED-Wand-Rechner (#881).
//
// ─── WAS HIER NICHT RECHNET ────────────────────────────────────────────────
//
// Nichts. Kachelzahl, Auflösung, Gewicht, Last und das Urteil über die
// Sending Card kommen aus `lib/ledWall.ts`; diese Datei zeigt sie und nimmt
// Eingaben entgegen.
//
// ─── DIE PIXELMAP WIRD HIER ZUM PNG, UND NUR HIER ──────────────────────────
//
// Das Rechenmodul liefert SVG — eine Zeichenkette, die ein Test lesen kann.
// Ein PNG braucht eine Zeichenfläche, und die gibt es nur im Browser. Die
// Umrechnung steht deshalb an der Stelle, an der es einen `<canvas>` gibt,
// und nicht im reinen Modul.
//
// Das Bild ist SO GROSS WIE DIE WAND PIXEL HAT. Wer es am Medienserver
// einspielt, legt es 1:1 auf die Wand; ein skaliertes Bild verschiebt genau
// die Kanten, auf die es ankommt.
//
// ─── UND WAS EINE FEHLENDE ANGABE HIER TUT ─────────────────────────────────
//
// Sie steht als Satz da, wo sonst die Zahl stünde. Eine Wand aus Panels ohne
// Gewichtsangabe wiegt nicht 0 kg; eine Sending Card, über die niemand etwas
// gesagt hat, trägt nicht unbegrenzt viel.
// ───────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react'
import { useSyncedState } from '../../hooks/useSyncedState'
import { Plus, X } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { PanelHint } from '../shared/PanelHint'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { format, useTranslation } from '../../lib/i18n'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { pixelMapSvg, portUrteil, rasterFuer, wandSumme } from '../../lib/ledWall'
import type { LedPanelType, LedWall } from '../../types/ledWall'

const neueId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** Ein Zahlenfeld, das leer bleiben darf — leer heisst „nicht angegeben". */
const Zahl = ({
  wert,
  onFertig,
  label,
  min = 0,
}: {
  wert: number | undefined
  onFertig: (n: number | undefined) => void
  label: string
  min?: number
}) => {
  // MITGEFUEHRT und nicht einmal gesetzt: „Raster einpassen" schreibt Spalten
  // und Reihen in den Store, und ein Feld mit eigenem Anfangswert zeigte
  // danach weiter die alte Zahl — daneben stuenden 60 Panels aus 10 × 6.
  // Gemessen im Browser: Felder auf 4/3, Summe auf 10 × 6.
  const [text, setText] = useSyncedState(wert === undefined ? '' : String(wert))
  return (
    <label className="block">
      <span className="mb-1 block text-cp-text-muted">{label}</span>
      <input
        type="number"
        min={min}
        value={text}
        onChange={(e) => setText(e.target.value)}
        // Auf `blur`: wer „128" tippt, schriebe sonst zwischendurch 1 und 12.
        onBlur={() => {
          const n = Number(text)
          onFertig(text.trim() === '' || !Number.isFinite(n) || n <= 0 ? undefined : n)
        }}
        className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
      />
    </label>
  )
}

export const LedWallDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.ledWallOpen)
  const setOpen = useUiStore((s) => s.setLedWallOpen)
  const project = useProjectStore((s) => s.project)
  const setLedPanelTypes = useProjectStore((s) => s.setLedPanelTypes)
  const setLedWalls = useProjectStore((s) => s.setLedWalls)

  const typen = project.ledPanelTypes ?? []
  const waende = project.ledWalls ?? []
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  /** Die gewünschte Öffnung, aus der das Raster fällt. Nur Eingabe, nichts Gespeichertes. */
  const [oeffnung, setOeffnung] = useState({ b: '', h: '' })

  const wand = waende.find((w) => w.id === gewaehlt) ?? waende[0]
  const typ = wand ? typen.find((x) => x.id === wand.panelTypeId) : undefined

  const summe = useMemo(
    () => (wand && typ ? wandSumme(typ, wand.columns, wand.rows) : null),
    [wand, typ],
  )
  const ports = useMemo(() => (summe && wand ? portUrteil(summe, wand) : null), [summe, wand])

  const typAendern = (id: string, patch: Partial<LedPanelType>) =>
    setLedPanelTypes(typen.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const wandAendern = (id: string, patch: Partial<LedWall>) =>
    setLedWalls(waende.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const typAnlegen = () => {
    const id = neueId('panel')
    setLedPanelTypes([
      ...typen,
      {
        id,
        name: t('led.panel.new', 'New panel type'),
        pitchMm: 3.9,
        pixels: { x: 128, y: 128 },
        sizeMm: { w: 500, h: 500 },
      },
    ])
  }

  const wandAnlegen = () => {
    const ersterTyp = typen[0]
    if (!ersterTyp) return
    const id = neueId('wall')
    setLedWalls([
      ...waende,
      { id, name: t('led.wall.new', 'New wall'), panelTypeId: ersterTyp.id, columns: 4, rows: 3 },
    ])
    setGewaehlt(id)
  }

  /** Das Raster aus der eingegebenen Öffnung übernehmen. */
  const ausOeffnung = () => {
    if (!wand || !typ) return
    const b = Number(oeffnung.b)
    const h = Number(oeffnung.h)
    if (!(b > 0) || !(h > 0)) return
    const r = rasterFuer(typ, b, h)
    wandAendern(wand.id, { columns: r.columns, rows: r.rows })
  }

  const raster = useMemo(() => {
    const b = Number(oeffnung.b)
    const h = Number(oeffnung.h)
    return typ && b > 0 && h > 0 ? rasterFuer(typ, b, h) : null
  }, [typ, oeffnung])

  /**
   * Die Pixelmap als PNG.
   *
   * Über `<img>` auf einen `<canvas>` in der Grösse der Wand — das Bild, das
   * am Medienserver eingespielt wird, ist so gross wie die Wand Pixel hat.
   */
  const pixelmapLaden = () => {
    if (!wand || !typ || !summe || summe.panels === 0) return
    const svg = pixelMapSvg(typ, wand.columns, wand.rows)
    const bild = new Image()
    bild.onload = () => {
      const flaeche = document.createElement('canvas')
      flaeche.width = summe.pixels.x
      flaeche.height = summe.pixels.y
      const ctx = flaeche.getContext('2d')
      if (!ctx) return
      ctx.drawImage(bild, 0, 0)
      flaeche.toBlob((blob) => {
        if (!blob) return
        downloadBlob(
          buildExportFilenameWithSuffix(project.metadata.name || 'cable-planner', 'pixelmap', 'png'),
          blob,
          'image/png',
        )
      }, 'image/png')
    }
    bild.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  if (!open) return null

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('led.title', 'LED wall')}
      maxWidth="4xl"
    >
      <div className="space-y-4 p-4 text-cp-xs text-cp-text-bright">
        <PanelHint
          text={t(
            'led.intro',
            'A wall is a grid of identical tiles. Panel count, resolution, weight and load all fall out of the tile data — nothing here is estimated, and a panel type without a weight gives a wall of unknown weight, not one of zero.',
          )}
        />

        {/* ── Panel-Typen ──────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-2 font-semibold uppercase tracking-wide text-cp-text-secondary">
            {t('led.types', 'Panel types')}
          </h3>
          {typen.length === 0 && (
            <p className="text-cp-text-muted">
              {t(
                'led.types.none',
                'No panel type recorded. Take the figures off the datasheet — pixel pitch, resolution, size, and, where stated, weight and power.',
              )}
            </p>
          )}
          {typen.map((x) => (
            <div key={x.id} className="mb-2 border border-cp-border-muted p-2">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_2rem] items-end gap-2">
                <label className="block">
                  <span className="mb-1 block text-cp-text-muted">{t('led.panel.name', 'Name')}</span>
                  <input
                    value={x.name}
                    onChange={(e) => typAendern(x.id, { name: e.target.value })}
                    className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
                  />
                </label>
                <Zahl
                  label={t('led.panel.pitch', 'Pitch (mm)')}
                  wert={x.pitchMm}
                  onFertig={(n) => typAendern(x.id, { pitchMm: n ?? 0 })}
                />
                <Zahl
                  label={t('led.panel.px', 'Pixels across')}
                  wert={x.pixels.x}
                  onFertig={(n) => typAendern(x.id, { pixels: { ...x.pixels, x: n ?? 0 } })}
                />
                <Zahl
                  label={t('led.panel.py', 'Pixels down')}
                  wert={x.pixels.y}
                  onFertig={(n) => typAendern(x.id, { pixels: { ...x.pixels, y: n ?? 0 } })}
                />
                <button
                  type="button"
                  onClick={() => setLedPanelTypes(typen.filter((y) => y.id !== x.id))}
                  className="border border-cp-border p-1.5 hover:bg-cp-surface-3"
                  title={t('led.remove', 'Remove')}
                >
                  <Icon icon={X} className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-5 gap-2">
                <Zahl
                  label={t('led.panel.w', 'Width (mm)')}
                  wert={x.sizeMm.w}
                  onFertig={(n) => typAendern(x.id, { sizeMm: { ...x.sizeMm, w: n ?? 0 } })}
                />
                <Zahl
                  label={t('led.panel.h', 'Height (mm)')}
                  wert={x.sizeMm.h}
                  onFertig={(n) => typAendern(x.id, { sizeMm: { ...x.sizeMm, h: n ?? 0 } })}
                />
                <Zahl
                  label={t('led.panel.weight', 'Weight (kg)')}
                  wert={x.weightKg}
                  onFertig={(n) => typAendern(x.id, { weightKg: n })}
                />
                <Zahl
                  label={t('led.panel.avg', 'Power, average (W)')}
                  wert={x.powerAvgW}
                  onFertig={(n) => typAendern(x.id, { powerAvgW: n })}
                />
                <Zahl
                  label={t('led.panel.max', 'Power, peak (W)')}
                  wert={x.powerMaxW}
                  onFertig={(n) => typAendern(x.id, { powerMaxW: n })}
                />
              </div>
              <label className="mt-2 block">
                <span className="mb-1 block text-cp-text-muted">
                  {t('led.panel.source', 'Datasheet (URL)')}
                </span>
                <input
                  value={x.manufacturerUrl ?? ''}
                  onChange={(e) => typAendern(x.id, { manufacturerUrl: e.target.value || undefined })}
                  className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
                />
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={typAnlegen}
            className="flex items-center gap-1 bg-sky-700 px-3 py-1.5 hover:bg-sky-600"
          >
            <Icon icon={Plus} className="h-3 w-3" /> {t('led.types.add', 'Add panel type')}
          </button>
        </section>

        {/* ── Wände ───────────────────────────────────────────────────── */}
        <section>
          <h3 className="mb-2 font-semibold uppercase tracking-wide text-cp-text-secondary">
            {t('led.walls', 'Walls')}
          </h3>
          {waende.length === 0 ? (
            <p className="text-cp-text-muted">
              {typen.length === 0
                ? t('led.walls.needType', 'A wall needs a panel type first.')
                : t('led.walls.none', 'No wall planned yet.')}
            </p>
          ) : (
            <div className="mb-2 flex flex-wrap gap-2">
              {waende.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setGewaehlt(w.id)}
                  className={`border px-2 py-1 ${
                    w.id === wand?.id
                      ? 'border-sky-500 bg-sky-900/40'
                      : 'border-cp-border hover:bg-cp-surface-3'
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={wandAnlegen}
            disabled={typen.length === 0}
            className="flex items-center gap-1 bg-sky-700 px-3 py-1.5 hover:bg-sky-600 disabled:opacity-50"
          >
            <Icon icon={Plus} className="h-3 w-3" /> {t('led.walls.add', 'Add wall')}
          </button>
        </section>

        {/* ── Die gewählte Wand ───────────────────────────────────────── */}
        {wand && typ && summe && (
          <section className="border border-cp-border-muted p-3">
            <div className="grid grid-cols-4 gap-2">
              <label className="block">
                <span className="mb-1 block text-cp-text-muted">{t('led.wall.name', 'Name')}</span>
                <input
                  value={wand.name}
                  onChange={(e) => wandAendern(wand.id, { name: e.target.value })}
                  className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-text-muted">{t('led.wall.type', 'Panel type')}</span>
                <select
                  value={wand.panelTypeId}
                  onChange={(e) => wandAendern(wand.id, { panelTypeId: e.target.value })}
                  className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
                >
                  {typen.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <Zahl
                label={t('led.wall.columns', 'Columns')}
                wert={wand.columns}
                onFertig={(n) => wandAendern(wand.id, { columns: n ?? 0 })}
              />
              <Zahl
                label={t('led.wall.rows', 'Rows')}
                wert={wand.rows}
                onFertig={(n) => wandAendern(wand.id, { rows: n ?? 0 })}
              />
            </div>

            {/* Aus der Öffnung rechnen. */}
            <div className="mt-3 flex items-end gap-2">
              <label className="block">
                <span className="mb-1 block text-cp-text-muted">
                  {t('led.opening.w', 'Opening width (mm)')}
                </span>
                <input
                  type="number"
                  value={oeffnung.b}
                  onChange={(e) => setOeffnung((o) => ({ ...o, b: e.target.value }))}
                  className="w-32 border border-cp-border bg-cp-surface-3 p-1.5"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-text-muted">
                  {t('led.opening.h', 'Opening height (mm)')}
                </span>
                <input
                  type="number"
                  value={oeffnung.h}
                  onChange={(e) => setOeffnung((o) => ({ ...o, h: e.target.value }))}
                  className="w-32 border border-cp-border bg-cp-surface-3 p-1.5"
                />
              </label>
              <button
                type="button"
                onClick={ausOeffnung}
                disabled={!raster}
                className="bg-sky-700 px-3 py-1.5 hover:bg-sky-600 disabled:opacity-50"
              >
                {t('led.opening.apply', 'Fit the grid')}
              </button>
              {raster && (
                <span className="text-cp-text-muted">
                  {format(
                    t('led.opening.result', '{c} × {r} tiles, {bw} mm across and {bh} mm up left over'),
                    { c: raster.columns, r: raster.rows, bw: raster.restBreiteMm, bh: raster.restHoeheMm },
                  )}
                </span>
              )}
            </div>

            {/* Die Summe. */}
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-3">
              <div>
                <dt className="text-cp-text-muted">{t('led.sum.panels', 'Panels')}</dt>
                <dd className="font-mono">{summe.panels}</dd>
              </div>
              <div>
                <dt className="text-cp-text-muted">{t('led.sum.pixels', 'Resolution')}</dt>
                <dd className="font-mono">
                  {summe.pixels.x} × {summe.pixels.y}
                </dd>
              </div>
              <div>
                <dt className="text-cp-text-muted">{t('led.sum.size', 'Size (mm)')}</dt>
                <dd className="font-mono">
                  {summe.sizeMm.w} × {summe.sizeMm.h}
                </dd>
              </div>
              <div>
                <dt className="text-cp-text-muted">{t('led.sum.weight', 'Weight')}</dt>
                <dd className={summe.weightKg === undefined ? 'text-amber-300' : 'font-mono'}>
                  {summe.weightKg === undefined
                    ? t('led.sum.noWeight', 'panel type carries no weight')
                    : `${summe.weightKg} kg`}
                </dd>
              </div>
              <div>
                <dt className="text-cp-text-muted">{t('led.sum.avg', 'Power, average')}</dt>
                <dd className={summe.powerAvgW === undefined ? 'text-amber-300' : 'font-mono'}>
                  {summe.powerAvgW === undefined
                    ? t('led.sum.noPower', 'panel type carries no power figure')
                    : `${summe.powerAvgW} W`}
                </dd>
              </div>
              <div>
                <dt className="text-cp-text-muted">{t('led.sum.max', 'Power, peak')}</dt>
                <dd className={summe.powerMaxW === undefined ? 'text-amber-300' : 'font-mono'}>
                  {summe.powerMaxW === undefined
                    ? t('led.sum.noPower', 'panel type carries no power figure')
                    : `${summe.powerMaxW} W`}
                </dd>
              </div>
            </dl>
            <PanelHint
              text={t(
                'led.sum.peakWhy',
                'Size the breaker on the peak, not the average. An LED wall draws a multiple of its average on a white frame, and a breaker chosen from the average trips on the first white flash.',
              )}
            />

            {/* Die Sending Card. */}
            <div className="mt-3 grid grid-cols-3 items-end gap-2">
              <Zahl
                label={t('led.ports.count', 'Ports on the sending card')}
                wert={wand.ausspielung?.ports}
                onFertig={(n) =>
                  wandAendern(wand.id, {
                    ausspielung:
                      n === undefined
                        ? undefined
                        : { ports: n, pixelProPort: wand.ausspielung?.pixelProPort ?? 0 },
                  })
                }
              />
              <Zahl
                label={t('led.ports.capacity', 'Pixels per port')}
                wert={wand.ausspielung?.pixelProPort}
                onFertig={(n) =>
                  wandAendern(wand.id, {
                    ausspielung:
                      n === undefined
                        ? undefined
                        : { ports: wand.ausspielung?.ports ?? 0, pixelProPort: n },
                  })
                }
              />
              <div className="text-cp-xs">
                {ports?.bekannt ? (
                  <span className={ports.reicht ? 'text-emerald-400' : 'text-amber-300'}>
                    {format(
                      ports.reicht
                        ? t('led.ports.ok', '{need} of {have} ports carry it')
                        : t('led.ports.short', 'Not enough — {need} ports needed, {have} there'),
                      { need: ports.gebraucht, have: ports.vorhanden },
                    )}
                  </span>
                ) : (
                  <span className="text-cp-text-muted">
                    {t('led.ports.unknown', 'Nothing recorded about the sending card — so nothing is claimed.')}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={pixelmapLaden}
                disabled={summe.panels === 0}
                className="bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600 disabled:opacity-50"
              >
                {t('led.pixelmap', 'Pixel map as PNG')}
              </button>
            </div>
          </section>
        )}
      </div>
    </ModalShell>
  )
}
