// #353 — Stage-Plot als Deliverable (nativ).
//
// Erzeugt eine top-down SVG-Übersicht der "Audio-Welt" des Plans: alle Geräte,
// die an mindestens einem Audio-Layer-Kabel hängen (Mics/DIs/Stageboxen/Pulte),
// an ihrer Canvas-Position, nummeriert + beschriftet — als Stage-Plot/Input-
// Positions-Übersicht zum Mitschicken. Self-contained (nur Projektdaten +
// Layer-Heuristik), damit kein DOM/Store nötig ist.
//
// Hinweis: bewusst eine schlanke, native Variante. Eine reichere Stage-Plot-
// Symbolik (Instrumenten-Icons o.ä.) wäre ein Folgeausbau.

import type { CablePlannerProject } from '../types/project'
import { topLayer } from './cableLayers'

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const exportStagePlotSvg = (project: CablePlannerProject): string => {
  // Audio-Geräte = Endpunkte von Audio-Layer-Kabeln.
  const audioIds = new Set<string>()
  for (const c of project.cables) {
    if (topLayer(c.layer) === 'audio') {
      audioIds.add(c.fromEquipmentId)
      audioIds.add(c.toEquipmentId)
    }
  }
  const fromAudio = project.equipment.filter((e) => audioIds.has(e.id))
  const devices = fromAudio.length > 0 ? fromAudio : project.equipment

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const e of devices) {
    const w = e.width ?? 240
    const h = e.height ?? 80
    minX = Math.min(minX, e.x)
    minY = Math.min(minY, e.y)
    maxX = Math.max(maxX, e.x + w)
    maxY = Math.max(maxY, e.y + h)
  }
  if (!Number.isFinite(minX)) {
    minX = 0
    minY = 0
    maxX = 1000
    maxY = 700
  }
  const pad = 60
  const titleH = 60
  const vx = minX - pad
  const vy = minY - pad - titleH
  const vw = maxX - minX + 2 * pad
  const vh = maxY - minY + 2 * pad + titleH

  // Reihenfolge: oben→unten, links→rechts (stabile Nummerierung).
  const ordered = [...devices].sort((a, b) => a.y - b.y || a.x - b.x)

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" font-family="sans-serif">`,
  )
  parts.push(`<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#0f172a"/>`)
  parts.push(
    `<text x="${minX - pad + 8}" y="${minY - pad - titleH + 34}" fill="#e2e8f0" font-size="26" font-weight="700">Stage-Plot — ${esc(project.metadata?.name ?? 'Plan')}</text>`,
  )
  parts.push(
    `<text x="${minX - pad + 8}" y="${minY - pad - titleH + 52}" fill="#94a3b8" font-size="13">${ordered.length} Audio-Quellen/-Ziele</text>`,
  )

  ordered.forEach((e, i) => {
    const w = e.width ?? 240
    const h = e.height ?? 80
    const accent = e.nodeColor ?? '#ef4444'
    parts.push(
      `<rect x="${e.x}" y="${e.y}" width="${w}" height="${h}" rx="8" fill="#1e293b" stroke="${esc(accent)}" stroke-width="2"/>`,
    )
    // Nummern-Kreis links oben.
    parts.push(`<circle cx="${e.x + 16}" cy="${e.y + 16}" r="13" fill="${esc(accent)}"/>`)
    parts.push(
      `<text x="${e.x + 16}" y="${e.y + 21}" fill="#0f172a" font-size="14" font-weight="700" text-anchor="middle">${i + 1}</text>`,
    )
    parts.push(
      `<text x="${e.x + 36}" y="${e.y + 21}" fill="#ffffff" font-size="13" font-weight="600">${esc(e.name)}</text>`,
    )
    if (e.subtitle) {
      parts.push(
        `<text x="${e.x + 12}" y="${e.y + 40}" fill="#94a3b8" font-size="12">${esc(e.subtitle)}</text>`,
      )
    }
    const inCount = Array.isArray(e.inputs) ? e.inputs.length : 0
    const outCount = Array.isArray(e.outputs) ? e.outputs.length : 0
    parts.push(
      `<text x="${e.x + 12}" y="${e.y + h - 10}" fill="#64748b" font-size="11">${inCount} In · ${outCount} Out</text>`,
    )
  })

  parts.push('</svg>')
  return parts.join('\n')
}
