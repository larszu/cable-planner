// #1206 — Last je Endstufenkanal.
//
// Ein Kanal treibt alle Lautsprecher, die an seinem Ausgang haengen — direkt
// oder ueber die Link-Buchse des vorigen Lautsprechers durchgeschleift. Die
// liegen parallel: 1/Z = Σ 1/Zi. Faellt Z unter die Mindestlast der Endstufe,
// geht sie in den Schutz oder kaputt; das ist der Fehler, der im Saal teuer ist.
//
// Die Leistungspruefung ist die Faustregel der Beschallung: ein Kanal sollte
// einem Lautsprecher nicht mehr als das Doppelte seiner Belastbarkeit (RMS/AES)
// zuteilen. Was der Kanal liefert, verteilt sich nach Impedanz: der Anteil
// eines Lautsprechers ist Z/Zi der Kanalleistung.
//
// Die Werte stehen in den Fachdaten der Kategorie Audio (`categoryProps`):
// `impedanceOhm` und `powerRmsW` am Lautsprecher, `minLoadOhm` und
// `powerPerChannelW` an der Endstufe.

import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'

export interface EndstufenBefund {
  art: 'unterlast' | 'ueberleistung' | 'impedanz-fehlt'
  schwere: 'fehler' | 'warnung' | 'hinweis'
  geraetId: string
  portId: string
  schluessel: string
  text: string
  werte: Record<string, string | number>
}

const num = (e: EquipmentItem, key: string): number | undefined => {
  const v = e.categoryProps?.[key]
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

const istEndstufe = (e: EquipmentItem): boolean =>
  e.categoryProps?.audioType === 'amp' || num(e, 'minLoadOhm') !== undefined

const istLautsprecher = (e: EquipmentItem): boolean =>
  !istEndstufe(e) && (e.categoryProps?.audioType === 'speaker' || (num(e, 'impedanceOhm') !== undefined && num(e, 'powerRmsW') !== undefined))

const ohm = (z: number): string => (Math.round(z * 100) / 100).toString()

export const pruefeEndstufen = (equipment: readonly EquipmentItem[], cables: readonly Cable[]): EndstufenBefund[] => {
  const byId = new Map(equipment.map((e) => [e.id, e]))
  const kabelAn = new Map<string, Cable[]>()
  for (const c of cables) {
    for (const id of [c.fromEquipmentId, c.toEquipmentId]) kabelAn.set(id, [...(kabelAn.get(id) ?? []), c])
  }
  const gegenueber = (c: Cable, id: string): string => (c.fromEquipmentId === id ? c.toEquipmentId : c.fromEquipmentId)
  const befunde: EndstufenBefund[] = []

  for (const amp of equipment.filter(istEndstufe)) {
    const minLast = num(amp, 'minLoadOhm')
    const leistung = num(amp, 'powerPerChannelW')
    for (const port of amp.outputs) {
      // Alle Lautsprecher an diesem Kanal: vom Ausgang aus ueber Lautsprecher
      // weiter, nie ueber ein anderes Geraet (das waere ein eigener Kreis).
      const start = (kabelAn.get(amp.id) ?? []).filter(
        (c) => (c.fromEquipmentId === amp.id && c.fromPortId === port.id) || (c.toEquipmentId === amp.id && c.toPortId === port.id),
      )
      const gesehen = new Set<string>()
      const warteschlange = start.map((c) => gegenueber(c, amp.id))
      while (warteschlange.length) {
        const id = warteschlange.shift()!
        if (gesehen.has(id) || id === amp.id) continue
        const e = byId.get(id)
        if (!e || !istLautsprecher(e)) continue
        gesehen.add(id)
        for (const c of kabelAn.get(id) ?? []) warteschlange.push(gegenueber(c, id))
      }
      const lautsprecher = [...gesehen].map((id) => byId.get(id)!)
      if (lautsprecher.length === 0) continue
      const ohneZ = lautsprecher.filter((l) => num(l, 'impedanceOhm') === undefined)
      if (ohneZ.length) {
        befunde.push({
          art: 'impedanz-fehlt',
          schwere: 'hinweis',
          geraetId: amp.id,
          portId: port.id,
          schluessel: 'check.amp.noImpedance',
          text: '{amp} {port}: load not checked — no nominal impedance on {namen}.',
          werte: { amp: amp.name, port: port.name, namen: ohneZ.map((l) => l.name).join(', ') },
        })
        continue
      }
      const leitwert = lautsprecher.reduce((s, l) => s + 1 / num(l, 'impedanceOhm')!, 0)
      const last = 1 / leitwert
      if (minLast !== undefined && last < minLast - 1e-9) {
        befunde.push({
          art: 'unterlast',
          schwere: 'fehler',
          geraetId: amp.id,
          portId: port.id,
          schluessel: 'check.amp.underLoad',
          text: '{amp} {port}: {n} loudspeaker(s) in parallel give {last} Ω, below the minimum load of {min} Ω.',
          werte: { amp: amp.name, port: port.name, n: lautsprecher.length, last: ohm(last), min: ohm(minLast) },
        })
      }
      if (leistung !== undefined) {
        for (const l of lautsprecher) {
          const belastbar = num(l, 'powerRmsW')
          if (belastbar === undefined) continue
          const anteil = (leistung * last) / num(l, 'impedanceOhm')!
          if (anteil > 2 * belastbar) {
            befunde.push({
              art: 'ueberleistung',
              schwere: 'warnung',
              geraetId: l.id,
              portId: port.id,
              schluessel: 'check.amp.overPower',
              text: '{speaker} gets up to {w} W from {amp} {port} — more than twice its rating of {rms} W.',
              werte: { speaker: l.name, w: Math.round(anteil), amp: amp.name, port: port.name, rms: belastbar },
            })
          }
        }
      }
    }
  }
  return befunde
}
