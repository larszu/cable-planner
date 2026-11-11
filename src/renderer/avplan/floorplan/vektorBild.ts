// @avplan/floorplan — Vektorzeichnung (DXF) als Planbild rendern.
// Quelle aller Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// Ein DXF hat kein Bild. Damit es wie ein PDF als Hintergrund liegt (und
// die Plan-Erkennung dieselbe Lage hat), wird es hier gezeichnet: schwarz
// auf weiss, gefuellte Flaechen grau, Masstab 1:1 ueber die ganze Flaeche.
// Braucht ein DOM-Canvas.

import type { GeladenerPlan } from './planDatei'
import { PLAN_MAX_KANTE } from './planDatei'
import type { VektorZeichnung } from './vektor'

export function vektorAlsPlan(z: VektorZeichnung, name: string, maxKante = PLAN_MAX_KANTE): GeladenerPlan {
  const faktor = maxKante / Math.max(z.breite, z.hoehe, 1e-9)
  const breite = Math.max(1, Math.round(z.breite * faktor))
  const hoehe = Math.max(1, Math.round(z.hoehe * faktor))
  const c = document.createElement('canvas')
  c.width = breite
  c.height = hoehe
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, breite, hoehe)
  const ox = z.minX ?? 0
  const oy = z.minY ?? 0
  ctx.lineWidth = 1
  for (const p of z.pfade) {
    ctx.beginPath()
    p.teile.forEach((t, i) => {
      t.forEach((q, k) => {
        const x = (q.x - ox) * faktor
        const y = (q.y - oy) * faktor
        if (k) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      })
      if (p.zu[i]) ctx.closePath()
    })
    if (p.gefuellt) {
      ctx.fillStyle = p.fuellfarbe ?? '#9ca3af'
      ctx.fill('evenodd')
    }
    if (p.gezogen) {
      ctx.strokeStyle = p.strichfarbe ?? '#000000'
      ctx.stroke()
    }
  }
  ctx.fillStyle = '#000000'
  for (const t of z.texte) {
    const h = t.hoehe * faktor
    if (h < 4) continue
    ctx.save()
    ctx.translate((t.x - ox) * faktor, (t.y - oy) * faktor)
    ctx.rotate((t.winkel * Math.PI) / 180)
    ctx.font = `${h}px sans-serif`
    ctx.fillText(t.text, 0, 0)
    ctx.restore()
  }
  return { src: c.toDataURL('image/png'), name, naturalWidth: breite, naturalHeight: hoehe, art: 'bild', seiten: 1, seite: 0 }
}
