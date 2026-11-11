// @avplan/floorplan — KI-Planlesen: Prompt, Antwort, Umrechnung.
// Quelle aller Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// WARUM DIE ALTE ANALYSE DANEBEN LAG (gemessen 2026-10-14, multicam #189):
//  1. Sie liess die KI „Meter je Pixel" schaetzen und setzte das als
//     Massstab. Die Anbieter verkleinern das Bild aber vor dem Lesen
//     (Claude auf 1568 px Kante, OpenAI und Gemini kacheln) — die KI kennt
//     die Pixel gar nicht, auf die sich ihre Zahl bezieht. Der falsche
//     Massstab verschob danach jede Wand.
//  2. Sie schickte das ganze Blatt. Ein A0-Plan 1:200 auf 2000 px hat
//     12 cm je Pixel; eine 11,5-cm-Wand ist ein Pixel breit.
//  3. Brueche 0..1 ohne Anhaltspunkt im Bild: Modelle verorten so auf
//     einige Prozent genau, im Saal Meter.
// Deshalb hier: Ausschnitt statt Blatt, ein beschriftetes Gitter 0..1000
// im Bild, Koordinaten in Gittereinheiten, Massstab nur ueber eine
// abgelesene Masskette, und jedes Ergebnis wird eingerastet (einrasten.ts).

export const KI_GITTER = 1000
/** Laengste Bildkante an die KI. Claude verkleinert darueber, die anderen
 *  kacheln — groesser bringt nichts, kleiner verliert Waende. */
export const KI_BILD_KANTE = 1568

export interface KiPlanAufgaben {
  waende: boolean
  buehnen: boolean
  raeume: boolean
  massstab: boolean
}

export type KiBuehnenArt = 'stage' | 'podium' | 'tribune' | 'riser' | 'other'

export interface KiPlanAntwort {
  walls?: { x1: number; y1: number; x2: number; y2: number; thickness_cm?: number }[]
  stages?: { x: number; y: number; w: number; h: number; kind?: KiBuehnenArt; label?: string; confidence?: number }[]
  rooms?: { x: number; y: number; name?: string; number?: string; area_m2?: number; height_m?: number }[]
  scale?: { x1: number; y1: number; x2: number; y2: number; meters: number; text?: string } | null
  scale_text?: string | null
}

export function kiPlanPrompt(a: KiPlanAufgaben, k: { breitePx: number; hoehePx: number; vektorBekannt?: boolean }): string {
  const teile: string[] = []
  const schema: string[] = []
  if (a.waende) {
    teile.push(
      '- walls: every straight wall segment. Draw it along the CENTRE of the drawn wall (the solid black or hatched band, or between its two parallel lines). One segment per straight run; split at corners. Leave door and window gaps open. Skip furniture, dimension lines, grid axes and text. thickness_cm is the drawn wall thickness.',
    )
    schema.push('  "walls": [{ "x1": int, "y1": int, "x2": int, "y2": int, "thickness_cm": number }]')
  }
  if (a.buehnen) {
    teile.push(
      '- stages: every stage, podium, riser or tribune (seating rake). Axis-aligned box: top-left corner (x, y) and size (w, h). kind is one of "stage", "podium", "tribune", "riser", "other". Use the drawn outline, not the label. confidence 0..1.',
    )
    schema.push('  "stages": [{ "x": int, "y": int, "w": int, "h": int, "kind": string, "label": string, "confidence": number }]')
  }
  if (a.raeume) {
    teile.push('- rooms: every room stamp. Position of the stamp, room name and number as written, area in m² (F:, NRF, m²) and clear height (RH, LH, H) if written.')
    schema.push('  "rooms": [{ "x": int, "y": int, "name": string, "number": string, "area_m2": number | null, "height_m": number | null }]')
  }
  if (a.massstab) {
    teile.push(
      '- scale: pick ONE long, clearly labelled dimension line. Return its two end ticks in grid units and the written value in metres. Also copy any written scale such as "1:100" into scale_text. Do not estimate metres per pixel.',
    )
    schema.push('  "scale": { "x1": int, "y1": int, "x2": int, "y2": int, "meters": number } | null')
    schema.push('  "scale_text": string | null')
  }
  return [
    'You read architectural floor plans for a camera and stage planning tool.',
    k.vektorBekannt
      ? 'The walls are already known from the CAD data; your answer will be snapped onto the drawing. Focus on what geometry cannot tell.'
      : 'Your answer will be snapped onto the drawn lines afterwards, so trace what is drawn as closely as you can.',
    '',
    `COORDINATES. The image (${k.breitePx} × ${k.hoehePx} px) carries a thin cyan grid labelled 0..${KI_GITTER} on every edge.`,
    `x runs from 0 at the left edge to ${KI_GITTER} at the right edge, y from 0 at the top edge to ${KI_GITTER} at the bottom edge.`,
    'Both axes use 0..1000 regardless of the image aspect ratio. Give integers. Read positions against the grid labels.',
    '',
    'Extract:',
    ...teile,
    '',
    'Return ONLY one JSON object, no markdown:',
    '{',
    schema.join(',\n'),
    '}',
    'Use an empty list when there is nothing of a kind.',
  ].join('\n')
}

/** Antworttext → JSON, tolerant gegenueber Zaeunen und Vor-/Nachtext. */
export function kiAntwortLesen(text: string): KiPlanAntwort {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(t) as KiPlanAntwort
  } catch {
    const a = t.indexOf('{')
    const b = t.lastIndexOf('}')
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1)) as KiPlanAntwort
    throw new Error('KI-Antwort ist kein JSON')
  }
}

const zahl = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Ausschnitt, den die KI gesehen hat, in den Koordinaten des Zielsystems
 *  (Planpixel oder Meter). */
export interface KiAusschnitt {
  x0: number
  y0: number
  breite: number
  hoehe: number
}

/** Gittereinheiten → Zielkoordinaten. Werte ausserhalb 0..1000 werden
 *  begrenzt, nicht verworfen (Modelle runden an den Rand hinaus). */
export function gitterNach(a: KiAusschnitt, gx: number, gy: number): { x: number; y: number } {
  const c = (v: number) => Math.max(0, Math.min(KI_GITTER, v))
  return { x: a.x0 + (c(gx) / KI_GITTER) * a.breite, y: a.y0 + (c(gy) / KI_GITTER) * a.hoehe }
}

export interface KiPlanErgebnis {
  waende: { x1: number; y1: number; x2: number; y2: number; dicke?: number }[]
  buehnen: { x: number; y: number; breite: number; tiefe: number; art: KiBuehnenArt; label: string; sicherheit: number }[]
  raeume: { x: number; y: number; name?: string; nummer?: string; flaecheM2?: number; hoeheM?: number }[]
  /** Masskette: Laenge in Zielkoordinaten und Wert in Metern. */
  masskette?: { laenge: number; meter: number }
  massstabText?: number
}

/** Antwort in Zielkoordinaten umrechnen und offensichtlichen Unsinn verwerfen. */
export function kiErgebnis(antw: KiPlanAntwort, a: KiAusschnitt): KiPlanErgebnis {
  const waende: KiPlanErgebnis['waende'] = []
  for (const w of Array.isArray(antw.walls) ? antw.walls : []) {
    const [x1, y1, x2, y2] = [w.x1, w.y1, w.x2, w.y2].map(zahl)
    if ([x1, y1, x2, y2].some((v) => v === undefined)) continue
    const p = gitterNach(a, x1!, y1!)
    const q = gitterNach(a, x2!, y2!)
    if (Math.hypot(q.x - p.x, q.y - p.y) < 1e-6) continue
    const d = zahl(w.thickness_cm)
    waende.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, dicke: d !== undefined && d > 0 && d < 200 ? d / 100 : undefined })
  }
  const arten: KiBuehnenArt[] = ['stage', 'podium', 'tribune', 'riser', 'other']
  const buehnen: KiPlanErgebnis['buehnen'] = []
  for (const s of Array.isArray(antw.stages) ? antw.stages : []) {
    const [x, y, w, h] = [s.x, s.y, s.w, s.h].map(zahl)
    if ([x, y, w, h].some((v) => v === undefined) || w! <= 0 || h! <= 0) continue
    const p = gitterNach(a, x!, y!)
    const q = gitterNach(a, x! + w!, y! + h!)
    buehnen.push({
      x: p.x,
      y: p.y,
      breite: q.x - p.x,
      tiefe: q.y - p.y,
      art: arten.includes(s.kind as KiBuehnenArt) ? (s.kind as KiBuehnenArt) : 'other',
      label: typeof s.label === 'string' && s.label.trim() ? s.label.trim() : '',
      sicherheit: Math.max(0, Math.min(1, zahl(s.confidence) ?? 0.5)),
    })
  }
  const raeume: KiPlanErgebnis['raeume'] = []
  for (const r of Array.isArray(antw.rooms) ? antw.rooms : []) {
    const x = zahl(r.x)
    const y = zahl(r.y)
    if (x === undefined || y === undefined) continue
    const p = gitterNach(a, x, y)
    raeume.push({ ...p, name: r.name || undefined, nummer: r.number || undefined, flaecheM2: zahl(r.area_m2), hoeheM: zahl(r.height_m) })
  }
  let masskette: KiPlanErgebnis['masskette']
  const s = antw.scale
  if (s && zahl(s.meters)) {
    const p = gitterNach(a, zahl(s.x1) ?? 0, zahl(s.y1) ?? 0)
    const q = gitterNach(a, zahl(s.x2) ?? 0, zahl(s.y2) ?? 0)
    const l = Math.hypot(q.x - p.x, q.y - p.y)
    if (l > 0) masskette = { laenge: l, meter: zahl(s.meters)! }
  }
  const mt = /1\s*:\s*(\d{1,4})/.exec(String(antw.scale_text ?? antw.scale?.text ?? ''))
  return { waende, buehnen, raeume, masskette, massstabText: mt ? Number(mt[1]) : undefined }
}

/** Beschriftetes Gitter auf ein Canvas legen (Hilfe fuer die Verortung). */
export function kiGitterZeichnen(ctx: CanvasRenderingContext2D, breite: number, hoehe: number): void {
  ctx.save()
  ctx.strokeStyle = 'rgba(0, 170, 200, 0.55)'
  ctx.fillStyle = 'rgba(0, 120, 150, 0.95)'
  ctx.lineWidth = 1
  const schrift = Math.max(10, Math.round(Math.min(breite, hoehe) / 70))
  ctx.font = `${schrift}px sans-serif`
  for (let g = 0; g <= KI_GITTER; g += 100) {
    const x = Math.round((g / KI_GITTER) * (breite - 1)) + 0.5
    const y = Math.round((g / KI_GITTER) * (hoehe - 1)) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, hoehe)
    ctx.moveTo(0, y)
    ctx.lineTo(breite, y)
    ctx.stroke()
    const t = String(g)
    ctx.textBaseline = 'top'
    ctx.fillText(t, Math.min(x + 2, breite - schrift * 2.2), 2)
    ctx.textBaseline = 'bottom'
    ctx.fillText(t, Math.min(x + 2, breite - schrift * 2.2), hoehe - 2)
    ctx.textBaseline = 'middle'
    ctx.fillText(t, 2, Math.max(schrift, Math.min(y, hoehe - schrift)))
    ctx.fillText(t, breite - schrift * 2.2, Math.max(schrift, Math.min(y, hoehe - schrift)))
  }
  ctx.restore()
}
