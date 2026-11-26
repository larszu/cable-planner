// #1240 Stufe 3 — Zeichenschritte (`compose.ts`) auf ein Canvas2D bringen.
//
// Bildqualitaet ist nicht das Ziel, nur die richtige Anordnung: jede Quelle
// ist ihr Pruefbild mit Namen (`testPattern.ts`) oder ihr geladenes PNG.
import type { Clip, DrawOp, MvWindow, Rect, WipePattern } from '../../../lib/switching'

/** Was fuer eine Quelle gezeichnet wird: ein Bild oder eine Flaeche. */
export interface LeafLook {
  img?: CanvasImageSource
  fill?: string
}

const px = (r: Rect, w: number, h: number) => ({ x: r.x * w, y: r.y * h, w: r.w * w, h: r.h * h })

/** Den Umriss eines Wipes als Pfad. Dieselbe Geometrie wie `wipeContains`. */
const wipePath = (ctx: CanvasRenderingContext2D, pattern: WipePattern, k: number, frame: Rect, W: number, H: number) => {
  const f = px(frame, W, H)
  const cx = f.x + f.w / 2
  const cy = f.y + f.h / 2
  switch (pattern) {
    case 'right':
      ctx.rect(f.x, f.y, f.w * k, f.h)
      return
    case 'left':
      ctx.rect(f.x + f.w * (1 - k), f.y, f.w * k, f.h)
      return
    case 'down':
      ctx.rect(f.x, f.y, f.w, f.h * k)
      return
    case 'up':
      ctx.rect(f.x, f.y + f.h * (1 - k), f.w, f.h * k)
      return
    case 'barnDoor':
      ctx.rect(cx - (f.w * k) / 2, f.y, f.w * k, f.h)
      return
    case 'box':
      ctx.rect(cx - (f.w * k) / 2, cy - (f.h * k) / 2, f.w * k, f.h * k)
      return
    case 'circle':
      ctx.arc(cx, cy, k * Math.hypot(8 / 9, 0.5) * f.h, 0, Math.PI * 2)
      return
    case 'diamond': {
      const a = k * (8 / 9 + 0.5) * f.h
      ctx.moveTo(cx - a, cy)
      ctx.lineTo(cx, cy - a)
      ctx.lineTo(cx + a, cy)
      ctx.lineTo(cx, cy + a)
      ctx.closePath()
    }
  }
}

const applyClip = (ctx: CanvasRenderingContext2D, c: Clip, W: number, H: number) => {
  ctx.beginPath()
  if (c.kind === 'rect') {
    const r = px(c.rect, W, H)
    ctx.rect(r.x, r.y, r.w, r.h)
  } else wipePath(ctx, c.pattern, c.k, c.frame, W, H)
  ctx.clip()
}

/** Zeichenschritte auf die ganze Flaeche. Fehlt ein Bild noch, bleibt die Stelle grau. */
export function zeichne(
  ctx: CanvasRenderingContext2D,
  ops: readonly DrawOp[],
  look: (leaf: string) => LeafLook,
): void {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.save()
  ctx.globalAlpha = 1
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  for (const op of ops) {
    const l = look(op.leaf)
    ctx.save()
    for (const c of op.clips) applyClip(ctx, c, W, H)
    ctx.globalAlpha = op.alpha
    const r = px(op.rect, W, H)
    if (l.img) ctx.drawImage(l.img, r.x, r.y, r.w, r.h)
    else {
      ctx.fillStyle = l.fill ?? '#3a3a3a'
      ctx.fillRect(r.x, r.y, r.w, r.h)
    }
    ctx.restore()
  }
  ctx.restore()
}

/** Rahmen und Namen der Multiviewer-Fenster; Programm rot, Vorschau gruen. */
export function zeichneFenster(
  ctx: CanvasRenderingContext2D,
  windows: readonly MvWindow[],
  label: (w: MvWindow) => string,
  tally: (w: MvWindow) => 'pgm' | 'pvw' | null,
): void {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.save()
  const fs = Math.max(10, Math.round(H / 40))
  ctx.font = `${fs}px Arial, Helvetica, sans-serif`
  ctx.textBaseline = 'bottom'
  for (const w of windows) {
    const r = px(w.rect, W, H)
    const t = tally(w)
    ctx.lineWidth = t ? 3 : 1
    ctx.strokeStyle = t === 'pgm' ? '#e11d2e' : t === 'pvw' ? '#16a34a' : '#555'
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2)
    const text = label(w)
    const tw = ctx.measureText(text).width
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(r.x + r.w / 2 - tw / 2 - 4, r.y + r.h - fs - 6, tw + 8, fs + 4)
    ctx.fillStyle = '#fff'
    ctx.fillText(text, r.x + r.w / 2 - tw / 2, r.y + r.h - 4)
  }
  ctx.restore()
}
