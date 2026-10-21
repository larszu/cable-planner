// ───────────────────────────────────────────────────────────────────────────
// Patchfeld-Beschriftung (#999).
//
// „Beschriftung auch als Zettel passend nach Vorlagen fuer Patchblenden
// generieren und auch fuer Label-Printer importierbare Formate. Zusaetzlich
// abgleichen mit Rack-Builder und Rackblenden und Patchpanel-Builder."
//
// Je Blende eine Zeile Felder in Vorlagen-Breite: Position n traegt das Geraet,
// das wirklich hinter Position n haengt. Der Weg dorthin ist `durchBlenden`
// aus `patchPanel.ts` — dieselbe Antwort wie in Signalkette und Switch-Port-
// Karte, keine zweite. Bevorzugt wird die Rueckseite (Hausstrecke/Rack-
// verkabelung), weil das am Patchfeld die Information ist, die man nicht
// sieht; ist sie leer, steht die Vorderseite da.
//
// Die Pruefung vergleicht dieselben Daten mit dem Rack-Bauer: Blende ohne
// Rack, Blende ohne ein einziges beschaltetes Feld, ungleiche Seiten (dann
// laesst sich nicht durchleiten), ein Kabel auf einem Leerfeld, und ein
// Switch-Port, der im selben Rack wie eine Blende an der Blende vorbei aus
// dem Rack geht.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import { detectNetworkDevice } from './deviceKind'
import type { LabelRow } from './labelPrinterCsv'
import {
  categoryIsPatchPanel,
  durchBlenden,
  gegenendenJePort,
  isPatchPanelDevice,
  patchPanelCounterpart,
  plattenPorts,
} from './patchPanel'

/** Eine Vorlage fuer den Beschriftungsstreifen einer Blende. */
export interface StripTemplate {
  id: 'rj45-24' | 'rj45-12' | 'd-16'
  /** Felder je Streifen. */
  cells: number
  cellWidthMm: number
  heightMm: number
}

/**
 * Die drei gaengigen Streifen: 19"-Netzwerkfeld mit 24 Ports (Teilung 15,9 mm),
 * dasselbe in Zwoelfer-Bloecken, und die D-Serie mit 16 Ausschnitten (XLR,
 * BNC, etherCON; Teilung 24 mm).
 */
export const STRIP_TEMPLATES: readonly StripTemplate[] = [
  { id: 'rj45-24', cells: 24, cellWidthMm: 15.9, heightMm: 9 },
  { id: 'rj45-12', cells: 12, cellWidthMm: 15.9, heightMm: 9 },
  { id: 'd-16', cells: 16, cellWidthMm: 24, heightMm: 12 },
]

export type StripTemplateChoice = StripTemplate['id'] | 'auto'

const RJ45 = new Set(['Ethernet/RJ45', 'RJ45', 'Cat6', 'Cat5e'])

/** Auto: reine RJ45-Felder bekommen den 24er-Streifen, alles andere D-Serie. */
export const templateFor = (ports: readonly Port[], choice: StripTemplateChoice): StripTemplate => {
  if (choice !== 'auto') return STRIP_TEMPLATES.find((t) => t.id === choice) ?? STRIP_TEMPLATES[0]
  const allRj45 = ports.length > 0 && ports.every((p) => RJ45.has(String(p.connectorType)))
  return allRj45 ? STRIP_TEMPLATES[0] : STRIP_TEMPLATES[2]
}

export interface PanelLabelCell {
  position: number
  portName: string
  /** Was hinter dieser Position haengt. Leer: unbeschaltet. */
  text: string
}

export interface PanelLabelSheet {
  panelId: string
  panelName: string
  rack?: string
  startUnit?: number
  template: StripTemplate
  strips: PanelLabelCell[][]
}

const isBlank = (p: Port | undefined) => String(p?.connectorType ?? '') === 'Blanking Panel'

/** Alle Blenden des Projekts als Beschriftungsblaetter. */
export const panelLabelSheets = (
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
  choice: StripTemplateChoice = 'auto',
): PanelLabelSheet[] => {
  const eqById = new Map(equipment.map((e) => [e.id, e]))
  const enden = gegenendenJePort(cables)
  const farEnd = (dev: EquipmentItem, port: Port | null | undefined): string => {
    if (!port) return ''
    const start = enden.get(port.id)?.find((e) => e.equipmentId !== dev.id)
    if (!start) return ''
    const { ende } = durchBlenden(start, eqById, enden)
    const d = eqById.get(ende.equipmentId)
    if (!d) return ''
    const p = [...d.inputs, ...d.outputs].find((x) => x.id === ende.portId)
    return p ? `${d.name} ${p.name}` : d.name
  }
  const sheets: PanelLabelSheet[] = []
  for (const dev of equipment) {
    if (!isPatchPanelDevice(dev)) continue
    const ports = plattenPorts(dev)
    if (ports.length === 0) continue
    const template = templateFor(ports, choice)
    const cells = ports.map((p, i) => {
      const back = patchPanelCounterpart(dev, p)
      const text = isBlank(p) ? '' : farEnd(dev, back) || farEnd(dev, p)
      return { position: i + 1, portName: p.name, text }
    })
    const strips: PanelLabelCell[][] = []
    for (let i = 0; i < cells.length; i += template.cells) strips.push(cells.slice(i, i + template.cells))
    sheets.push({
      panelId: dev.id,
      panelName: dev.name,
      rack: dev.rackInstanceLabel,
      startUnit: dev.rackInstanceStartUnit,
      template,
      strips,
    })
  }
  return sheets
}

/** Ein Etikett je beschaltetem Feld — fuer P-touch/Dymo im Format der Patchliste. */
export const panelLabelRows = (sheets: readonly PanelLabelSheet[]): LabelRow[] =>
  sheets.flatMap((s) =>
    s.strips.flat().filter((c) => c.text).map((c) => ({ label1: `${s.panelName} ${c.position}`, label2: c.text })),
  )

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Druckblatt 1:1 — je Streifen eine Zeile Felder in Vorlagen-Teilung. */
export const buildPanelLabelHtml = (title: string, sheets: readonly PanelLabelSheet[]): string => {
  const body = sheets
    .map((s) => {
      const where = [s.rack, s.startUnit != null ? `U${s.startUnit}` : ''].filter(Boolean).join(' · ')
      const strips = s.strips
        .map((strip) => {
          const w = s.template.cells * s.template.cellWidthMm
          const cells = strip
            .map(
              (c) =>
                `<div class="feld" style="width:${s.template.cellWidthMm}mm"><b>${c.position}</b><span>${esc(c.text)}</span></div>`,
            )
            .join('')
          return `<div class="streifen" style="width:${w}mm;height:${s.template.heightMm}mm">${cells}</div>`
        })
        .join('\n')
      return `<section><h2>${esc(s.panelName)}${where ? ` <small>${esc(where)}</small>` : ''}</h2>\n${strips}</section>`
    })
    .join('\n')
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Inter, Arial, sans-serif; color: #000; background: #fff; margin: 0; }
  h1 { font-size: 11pt; margin: 0 0 4mm; }
  h2 { font-size: 8pt; margin: 5mm 0 1mm; }
  h2 small { font-weight: normal; color: #444; }
  section { break-inside: avoid; }
  .streifen { display: flex; border: 0.3mm dashed #666; margin-bottom: 2mm; box-sizing: border-box; }
  .feld { box-sizing: border-box; border-right: 0.2mm solid #999; display: flex; flex-direction: column;
          align-items: center; justify-content: center; overflow: hidden; font-size: 5.5pt; line-height: 1.1;
          text-align: center; padding: 0 0.5mm; }
  .feld:last-child { border-right: 0; }
  .feld b { font-size: 6pt; }
</style></head>
<body><h1>${esc(title)} · 1:1</h1>
${body}
</body></html>`
}

export type LabelIssueKind =
  | 'panelNotInRack'
  | 'panelWithoutLabels'
  | 'sidesMismatch'
  | 'blankCabled'
  | 'portWithoutPanel'

export interface LabelIssue {
  kind: LabelIssueKind
  device: string
  /** Port- oder Gegenstellen-Angabe, wo sinnvoll. */
  detail?: string
}

/** Abgleich Beschriftung ↔ Rack-Bauer ↔ Patchfeld-Bauer. */
export const labelCrossCheck = (
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
): LabelIssue[] => {
  const issues: LabelIssue[] = []
  const eqById = new Map(equipment.map((e) => [e.id, e]))
  const cabled = new Set<string>()
  for (const c of cables) {
    cabled.add(c.fromPortId)
    cabled.add(c.toPortId)
  }
  const portById = new Map<string, { dev: EquipmentItem; port: Port }>()
  for (const dev of equipment) for (const port of [...dev.inputs, ...dev.outputs]) portById.set(port.id, { dev, port })

  const racksWithPanel = new Set<string>()
  for (const dev of equipment) {
    if (!isPatchPanelDevice(dev)) continue
    if (dev.rackInstanceId) racksWithPanel.add(dev.rackInstanceId)
    const rackPanel = !dev.frontplatte && (dev.isPatchPanel === true || categoryIsPatchPanel(dev.category))
    if (rackPanel && !dev.rackInstanceId) issues.push({ kind: 'panelNotInRack', device: dev.name })
    if (dev.inputs.length > 0 && dev.outputs.length > 0 && dev.inputs.length !== dev.outputs.length) {
      issues.push({ kind: 'sidesMismatch', device: dev.name, detail: `${dev.inputs.length}/${dev.outputs.length}` })
    }
    if (![...dev.inputs, ...dev.outputs].some((p) => cabled.has(p.id))) {
      issues.push({ kind: 'panelWithoutLabels', device: dev.name })
    }
  }

  for (const c of cables) {
    for (const id of [c.fromPortId, c.toPortId]) {
      const hit = portById.get(id)
      if (hit && isBlank(hit.port)) issues.push({ kind: 'blankCabled', device: hit.dev.name, detail: hit.port.name })
    }
    // Switch im Rack mit Blende, Kabel geht direkt aus dem Rack hinaus.
    const ends = [
      [c.fromEquipmentId, c.fromPortId, c.toEquipmentId],
      [c.toEquipmentId, c.toPortId, c.fromEquipmentId],
    ] as const
    for (const [selfId, portId, otherId] of ends) {
      const self = eqById.get(selfId)
      const other = eqById.get(otherId)
      if (!self || !other || !self.rackInstanceId || !racksWithPanel.has(self.rackInstanceId)) continue
      if (detectNetworkDevice(self) !== 'switch') continue
      if (isPatchPanelDevice(other) || other.rackInstanceId === self.rackInstanceId) continue
      const port = portById.get(portId)?.port
      issues.push({ kind: 'portWithoutPanel', device: self.name, detail: `${port?.name ?? ''} -> ${other.name}` })
    }
  }
  return issues
}
