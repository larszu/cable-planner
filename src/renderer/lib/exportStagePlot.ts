// ───────────────────────────────────────────────────────────────────────────
// Der Stage-Plot als EIN-SEITEN-LIEFERUNG (Bedarf 38, P1).
//
// WOFUER. Der Markt-Standard fuer dieses Blatt ist gestorben: StagePlotPro
// gilt als „highly regarded", aber „the official purchase channels have been
// discontinued, making this excellent software inaccessible". Die Folge steht
// als Zaehlung im Dossier: **21 unabhaengige Repositories namens „stageplot"**
// auf GitHub zwischen 2016 und 2026 — jeder baut es sich neu. Und der Grund,
// warum ein Textfeld nicht reicht, steht daneben: „Promoters expect a
// drawing, not a text field."
//
// WAS DIE BEDARFS-DATENBANK VERLANGT, und es ist mehr als ein Bild:
//
//   > Stage plot as a first-class, offline, one-page deliverable **that also
//   > generates the input list and monitor mix list from the same objects**.
//
// Genau das ist der Unterschied zwischen einer Zeichnung und einer Lieferung:
// Zeichnung UND Legende auf EINEM Blatt, aus DENSELBEN Objekten, mit
// DERSELBEN Nummer.
//
// ─── DIE NUMMER IST DER KANAL ──────────────────────────────────────────────
//
// Bis hierher nummerierte dieses Blatt nach Canvas-Position (oben nach unten,
// links nach rechts). Seit `cable#706` nummeriert die Kanalliste nach
// Absteck-Reihenfolge (Ziel-Port). Zwei verschiedene Nummern fuer dasselbe
// Mikrofon auf einem Blatt sind schlimmer als gar keine: der Techniker liest
// „3" im Plot, sucht Kanal 3 auf der Stagebox und findet ein anderes Geraet.
//
// Die Nummer im Plot ist deshalb die KANALNUMMER. Geraete, die kein Kanal
// sind (Stagebox, Pult, Wedge), bekommen keine — sie sind Ziel und nicht
// Quelle, und eine Nummer an ihnen waere eine Behauptung ueber die Patchliste.
//
// Self-contained (nur Projektdaten + die Kanal-Ableitung), damit kein DOM und
// kein Store noetig ist — „offline, account-free" ist Teil des Bedarfs.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import { topLayer } from './cableLayers'
import { buildChannelList, monitorPaths } from './channelList'

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const exportStagePlotSvg = (project: CablePlannerProject): string => {
  // Die Kanalliste ist DIESELBE wie in der Patchliste (Bedarf 37) — nicht eine
  // zweite Ableitung daneben. Genau das verlangt Bedarf 38: „generates the
  // input list … from the same objects".
  const channels = buildChannelList(project.equipment, project.cables)
  const monitors = monitorPaths(project.equipment, project.cables)
  const chByEquipment = new Map<string, number>()
  const byCableId = new Map(project.cables.map((c) => [c.id, c]))
  for (const row of channels) {
    const cable = byCableId.get(row.cableId)
    if (cable && !chByEquipment.has(cable.fromEquipmentId)) {
      chByEquipment.set(cable.fromEquipmentId, row.ch)
    }
  }

  // Audio-Geraete = Endpunkte von Audio-Layer-Kabeln.
  const audioIds = new Set<string>()
  for (const c of project.cables) {
    if (topLayer(c.layer) === 'audio') {
      audioIds.add(c.fromEquipmentId)
      audioIds.add(c.toEquipmentId)
    }
  }
  const fromAudio = project.equipment.filter((e) => audioIds.has(e.id))
  // ADR-005, Regel 4 — der Rueckfall auf ALLE Geraete bleibt (eine
  // Positions-Uebersicht ist auch ohne Audio-Kabel nuetzlich), aber die
  // Unterzeile darf danach nicht weiter „Audio-Quellen/-Ziele" behaupten.
  // Ein Plan ohne ein einziges Audio-Kabel wies sonst Kameras, Mischer und
  // Router als Audio-Quellen aus — auf einem Blatt, das an die Halle geht.
  const audioFound = fromAudio.length > 0
  const devices = audioFound ? fromAudio : project.equipment

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
  // Die Legende steht RECHTS neben der Zeichnung, auf demselben Blatt. Ein
  // zweites Blatt waere genau die Trennung, an der der Bedarf haengt: das
  // Bild geht an den Promoter, die Liste an den Tontechniker, und beide
  // veralten getrennt.
  const zeilen = channels.length + (monitors.length > 0 ? monitors.length + 2 : 0)
  const legendW = zeilen > 0 ? 420 : 0
  const legendH = 40 + zeilen * 22
  const vx = minX - pad
  const vy = minY - pad - titleH
  const vw = maxX - minX + 2 * pad + legendW
  const vh = Math.max(maxY - minY + 2 * pad + titleH, legendH + titleH + pad)

  // Reihenfolge: oben→unten, links→rechts (stabile Zeichen-Reihenfolge). Die
  // NUMMER kommt aus der Kanalliste, nicht aus dieser Sortierung.
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
    `<text x="${minX - pad + 8}" y="${minY - pad - titleH + 52}" fill="#94a3b8" font-size="13">${
      audioFound
        ? `${ordered.length} Audio-Quellen/-Ziele · ${channels.length} Kanäle`
        : `${ordered.length} Geräte — kein Audio-Kabel im Plan, daher alle`
    }</text>`,
  )

  ordered.forEach((e) => {
    const w = e.width ?? 240
    const h = e.height ?? 80
    const accent = e.nodeColor ?? '#ef4444'
    const ch = chByEquipment.get(e.id)
    parts.push(
      `<rect x="${e.x}" y="${e.y}" width="${w}" height="${h}" rx="8" fill="#1e293b" stroke="${esc(accent)}" stroke-width="2"/>`,
    )
    // Die Nummer ist der KANAL. Ein Geraet ohne Kanal (Stagebox, Pult, Wedge)
    // bekommt keine: es ist Ziel und nicht Quelle, und eine Nummer an ihm
    // waere eine Behauptung ueber die Patchliste.
    if (ch !== undefined) {
      parts.push(`<circle cx="${e.x + 16}" cy="${e.y + 16}" r="13" fill="${esc(accent)}"/>`)
      parts.push(
        `<text x="${e.x + 16}" y="${e.y + 21}" fill="#0f172a" font-size="14" font-weight="700" text-anchor="middle">${ch}</text>`,
      )
    }
    parts.push(
      `<text x="${e.x + (ch !== undefined ? 36 : 12)}" y="${e.y + 21}" fill="#ffffff" font-size="13" font-weight="600">${esc(e.name)}</text>`,
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

  // ── Die Legende: die Eingangsliste auf demselben Blatt ──────────────────
  if (zeilen > 0) {
    const lx = maxX + pad
    let ly = minY - pad + 24
    parts.push(
      `<text x="${lx}" y="${ly}" fill="#e2e8f0" font-size="15" font-weight="700">Eingangsliste</text>`,
    )
    ly += 22
    for (const row of channels) {
      const abnahme = row.sourcePort ? ` · ${row.sourcePort}` : ''
      parts.push(
        `<text x="${lx}" y="${ly}" fill="#cbd5e1" font-size="12">${row.ch}. ${esc(row.source)}${esc(abnahme)}</text>`,
      )
      parts.push(
        `<text x="${lx + 300}" y="${ly}" fill="#64748b" font-size="11">${esc(row.destinationPort)}</text>`,
      )
      ly += 22
    }
    if (monitors.length > 0) {
      ly += 14
      parts.push(
        `<text x="${lx}" y="${ly}" fill="#e2e8f0" font-size="15" font-weight="700">Monitor-Wege</text>`,
      )
      ly += 22
      for (const m of monitors) {
        parts.push(
          `<text x="${lx}" y="${ly}" fill="#cbd5e1" font-size="12">${esc(m.outputPort)} → ${esc(m.sink)}</text>`,
        )
        ly += 22
      }
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}
