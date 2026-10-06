// Welche ATEM-Source-ID gehoert zu welchem Port des Geraets?
//
// Der Multiviewer-Dialog beschriftet seine Fenster mit den Portnamen aus dem
// Canvas. Voraussetzung ist eine Source-ID am Port. Ein Geraet aus der
// Bibliothek oder einem Import-Preset traegt sie nicht — die Namen blieben
// deshalb im Multiviewer unsichtbar, sobald man sie aenderte (#1008).
// Hier wird die ID abgeleitet, wenn keine gesetzt ist:
//   Eingang n               -> n
//   Ausgang "AUX n"         -> 8000 + n
//   Ausgang "PGM"/"Program" -> 10010, "PVW"/"Preview" -> 10011
//   mit "ME n" davor        -> 10000 + 10 * n (+1 fuer PVW)
// Ein ausdruecklich gesetztes `atemSourceId` gewinnt immer.

interface PortLike {
  name?: string
  atemSourceId?: number
}

export interface AtemPortSource {
  id: number
  name: string
  isOutput: boolean
}

export function impliedOutputSourceId(name: string): number | undefined {
  const n = name.trim().toLowerCase()
  const aux = /\baux(?:iliary)?\s*0*(\d{1,2})\b/.exec(n)
  if (aux) return 8000 + Number(aux[1])
  const pvw = /\b(pvw|prv|preview)\b/.test(n)
  const pgm = /\b(pgm|prog|program)\b/.test(n)
  if (!pvw && !pgm) return undefined
  const me = /\bme\s*0*(\d)\b/.exec(n)
  const base = me ? 10000 + 10 * Number(me[1]) : 10010
  return pvw ? base + 1 : base
}

export function atemPortSources(equipment: {
  inputs?: PortLike[]
  outputs?: PortLike[]
}): AtemPortSource[] {
  const out: AtemPortSource[] = []
  const inputs = Array.isArray(equipment.inputs) ? equipment.inputs : []
  inputs.forEach((p, idx) => {
    const name = typeof p?.name === 'string' ? p.name.trim() : ''
    if (!name) return
    out.push({ id: typeof p.atemSourceId === 'number' ? p.atemSourceId : idx + 1, name, isOutput: false })
  })
  const outputs = Array.isArray(equipment.outputs) ? equipment.outputs : []
  for (const p of outputs) {
    const name = typeof p?.name === 'string' ? p.name.trim() : ''
    if (!name) continue
    const id = typeof p.atemSourceId === 'number' ? p.atemSourceId : impliedOutputSourceId(name)
    if (id !== undefined) out.push({ id, name, isOutput: true })
  }
  return out
}
