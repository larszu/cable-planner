// ───────────────────────────────────────────────────────────────────────────
// Adapter vorschlagen und einsetzen (#876).
//
// ─── DREI AUSSAGEN TRAGEN DIESE DATEI ──────────────────────────────────────
//
// 1. ADAPTER, GESCHLECHTSWANDLER UND KONVERTER SIND DREI DINGE. Der
//    Konverter wird nur ANGEZEIGT und nie gesetzt: er hat einen Hersteller,
//    eine Bandbreite und einen Preis, und keine dieser Angaben steht im Plan.
// 2. DER VORGESCHLAGENE ADAPTER BEHAUPTET NICHTS. Richtung und Speisung
//    bleiben „unbekannt", damit die Plan-Prüfung ihn als offenen Punkt führt
//    statt als grünen Haken. Ein grüner Haken für ein Teil, das niemand
//    geprüft hat, ist teurer als ein offener Punkt.
// 3. DIE LÄNGE WIRD NICHT GETEILT. Wo der Adapter sitzt, weiss der Plan
//    nicht; das zweite Stück bekommt 0 m und nicht die Hälfte.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { adapterVorschlag } from '../src/renderer/lib/adapterVorschlag'
import { planeEinfuegen } from '../src/renderer/lib/adapterEinfuegen'
import { beurteileAdapter } from '../src/renderer/types/adapter'
import { checkGenderMismatch } from '../src/renderer/types/cableSpec'
import type { Cable } from '../src/renderer/types/cable'

const port = (connectorType: string, gender?: 'male' | 'female') =>
  ({ connectorType, gender }) as never

describe('was zwischen zwei Anschlüsse gehört', () => {
  it('sagt „keiner", wenn die beiden zusammenpassen', () => {
    expect(adapterVorschlag(port('BNC'), port('BNC')).art).toBe('keiner')
  })

  it('erkennt zwei gleiche Geschlechter — der Fall, den sonst niemand sieht', () => {
    // „XLR auf XLR" ist für jede Typprüfung in Ordnung, und am Aufbau stehen
    // zwei Stifte voreinander.
    const v = adapterVorschlag(port('XLR', 'male'), port('XLR', 'male'))
    expect(v.art).toBe('geschlechtswandler')
    expect(v.spec).toMatchObject({ von: 'XLR', nach: 'XLR', speisung: 'passiv' })
  })

  it('sagt nichts, wenn an einer Seite das Geschlecht fehlt', () => {
    // Ein Port ohne Geschlecht ist nicht „männlich", er ist ungemessen — und
    // eine Warnung darüber schickte jemanden mit einem Adapter los, den er
    // nicht braucht.
    expect(adapterVorschlag(port('XLR', 'male'), port('XLR')).art).toBe('keiner')
    expect(checkGenderMismatch('male', undefined)).toBeNull()
  })

  it('schlägt einen Adapter vor, wo dieselbe Familie anders steckt', () => {
    const v = adapterVorschlag(port('IEC 230V'), port('PowerCON'))
    expect(v.art).toBe('adapter')
    expect(v.spec).toMatchObject({ von: 'IEC 230V', nach: 'PowerCON' })
  })

  it('setzt beim vorgeschlagenen Adapter WEDER Richtung NOCH Speisung', () => {
    const v = adapterVorschlag(port('IEC 230V'), port('PowerCON'))
    expect(v.spec?.richtung).toBe('unbekannt')
    expect(v.spec?.speisung).toBe('unbekannt')
  })

  it('führt genau deshalb zu einem OFFENEN Punkt und nicht zu einem grünen Haken', () => {
    const v = adapterVorschlag(port('IEC 230V'), port('PowerCON'))
    const urteil = beurteileAdapter(v.spec!, {
      quelleSteckt: 'IEC 230V',
      senkeSteckt: 'PowerCON',
    })
    expect(urteil.art).toBe('offen')
  })

  it('schlägt einen Konverter nur VOR und liefert keine Spec', () => {
    // SDI auf HDMI ist ein Gerät mit Strom und einer Grenze — das wählt ein
    // Mensch aus.
    const v = adapterVorschlag(port('BNC'), port('HDMI'))
    expect(v.art).toBe('konverter')
    expect(v.spec).toBeUndefined()
  })

  it('schweigt, wenn ein Anschluss fehlt', () => {
    expect(adapterVorschlag(undefined, port('BNC')).art).toBe('keiner')
  })
})

describe('den Adapter einsetzen', () => {
  const kabel = {
    id: 'c1',
    name: 'Strom Bühne',
    type: 'IEC 230V',
    length: 40,
    color: '#fff',
    fromEquipmentId: 'A',
    fromPortId: 'A-out',
    toEquipmentId: 'B',
    toPortId: 'B-in',
    notes: 'über den Steg',
    needsConverter: true,
  } as Cable

  const spec = { von: 'IEC 230V', nach: 'PowerCON', richtung: 'unbekannt', speisung: 'unbekannt' } as const
  const ids = { geraet: 'g1', kabelVor: 'c2', kabelNach: 'c3' }
  const plan = () =>
    planeEinfuegen(kabel, spec, ids, { x: 0, y: 100, width: 200 }, { x: 800, y: 300 })

  it('macht aus einem Lauf zwei und hängt das Gerät dazwischen', () => {
    const p = plan()
    expect(p.kabelVor.fromEquipmentId).toBe('A')
    expect(p.kabelVor.toEquipmentId).toBe('g1')
    expect(p.kabelNach.fromEquipmentId).toBe('g1')
    expect(p.kabelNach.toEquipmentId).toBe('B')
  })

  it('gibt dem Gerät genau zwei Anschlüsse, in den beiden Bauformen', () => {
    const p = plan()
    expect(p.geraet.inputs).toHaveLength(1)
    expect(p.geraet.outputs).toHaveLength(1)
    expect(p.geraet.inputs[0]!.connectorType).toBe('IEC 230V')
    expect(p.geraet.outputs[0]!.connectorType).toBe('PowerCON')
  })

  it('teilt die Länge NICHT — das zweite Stück ist ungemessen', () => {
    const p = plan()
    expect(p.kabelVor.length).toBe(40)
    expect(p.kabelNach.length).toBe(0)
  })

  it('nimmt dem Kabel den Adapter-Vermerk ab — er steht jetzt im Plan', () => {
    const p = plan()
    expect(p.kabelVor.needsConverter).toBe(false)
    expect(p.kabelNach.needsConverter).toBe(false)
  })

  it('legt das Gerät MITTIG zwischen seine beiden Nachbarn', () => {
    // Quelle endet bei x = 200, Senke beginnt bei x = 800: die Lücke ist
    // 600 breit, das Gerät 160 — es steht bei 200 + 300 − 80 = 420.
    // Mit der eigenen Breite gerechnet und nicht ohne: ein Gerät, dessen
    // linke Kante auf der Mitte sitzt, steht halb im Nachbarn.
    const p = plan()
    expect(p.geraet.x).toBe(420)
    expect(p.geraet.y).toBe(200)
  })

  it('weicht nach unten aus, wenn der Platz dazwischen nicht reicht', () => {
    // Nachbarn dicht beieinander: das Gerät ginge sonst in einen hinein.
    const p = planeEinfuegen(kabel, spec, ids, { x: 0, y: 100, width: 200 }, { x: 260, y: 100 })
    expect(p.geraet.y).toBeGreaterThan(100)
  })

  it('findet auch dann einen Platz, wenn nur ein Nachbar bekannt ist', () => {
    const p = planeEinfuegen(kabel, spec, ids, { x: 100, y: 50, width: 200 }, undefined)
    expect(Number.isFinite(p.geraet.x)).toBe(true)
    expect(p.geraet.x).toBeGreaterThan(100)
  })

  it('trägt die Spec am Gerät — daran erkennt der Plan einen Adapter', () => {
    expect(plan().geraet.adapter).toEqual(spec)
  })

  it('benennt das Gerät nach der einen Stelle, die Adapter benennt', () => {
    // `adapterBezeichnung` ist die Quelle des Namens; ein zweiter Ort dafür
    // hiesse, dass derselbe Adapter in Plan und Stückliste anders heisst.
    expect(plan().geraet.name).toContain('IEC 230V')
    expect(plan().geraet.name).toContain('PowerCON')
  })
})
