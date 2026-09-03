import { describe, expect, it } from 'vitest'
import { INSTANCE_FIELDS, MODEL_FIELDS, pickModelFields } from '../src/renderer/lib/modelFields'
import { topLevelKeys } from './support/topLevelKeys'
import equipmentTypesSrc from '../src/renderer/types/equipment.ts?raw'
import templateSliceSrc from '../src/renderer/store/slices/templateSlice.ts?raw'
import projectStoreSrc from '../src/renderer/store/projectStore.ts?raw'

// ---------------------------------------------------------------------------
// ADR-005 Design-Frage 2 — Modell- oder Instanz-Eigenschaft?
//
// Entschieden: *„Alle Modell-Eigenschaften sollten in allen Plaenen immer den
// Geraeten zugeordnet sein — egal ob in der Anwendung abgefragt oder nicht."*
//
// Gemessener Ausgangszustand: `templateFromEquipment` trug 22 der 97 Felder.
// Der ADR nennt den Schaden — die Modell-Gruppe laeuft in Stuecklisten weiter,
// „eine falsche Zuordnung propagiert still falsche Preise".
// ---------------------------------------------------------------------------

describe('die Klassifizierung ist vollstaendig', () => {
  it('ordnet jedes Feld von EquipmentItem genau einer Seite zu', () => {
    // Der eigentliche Guard, gleiche Machart wie die 146 Felder in planDiff:
    // ein neues Feld bleibt nicht stillschweigend unklassifiziert, sondern
    // bricht hier — und wer es klassifiziert, muss dabei entscheiden, ob es
    // in Stuecklisten weiterlaeuft.
    const all = topLevelKeys(equipmentTypesSrc, 'EquipmentItem')
    const classified = [...MODEL_FIELDS, ...INSTANCE_FIELDS].sort()
    expect(classified).toEqual(all)
  })

  it('ordnet kein Feld beiden Seiten zu', () => {
    const both = MODEL_FIELDS.filter((f) => (INSTANCE_FIELDS as readonly string[]).includes(f))
    expect(both).toEqual([])
  })

  it('fuehrt die Preis-Gruppe als Modell', () => {
    // Die Gruppe, die der ADR beim Namen nennt.
    for (const field of ['priceEUR', 'rentPricePerDay', 'rentCurrency', 'powerConsumptionWatts', 'heightMm', 'modes', 'shortName']) {
      expect(MODEL_FIELDS as readonly string[], field).toContain(field)
    }
  })

  it('fuehrt die Exemplar-Gruppe als Instanz', () => {
    for (const field of ['assetTag', 'serialNumber', 'qrId', 'installStatus', 'videohubRouting']) {
      expect(INSTANCE_FIELDS as readonly string[], field).toContain(field)
    }
  })
})

describe('pickModelFields', () => {
  it('nimmt die Modell-Felder mit und laesst die Instanz-Felder liegen', () => {
    const item = {
      id: 'A',
      name: 'ETC S4',
      priceEUR: 1200,
      heightMm: 44,
      assetTag: 'INV-0001',
      ipAddress: '10.0.0.2',
      x: 5,
      y: 6,
    }
    const picked = pickModelFields(item)
    expect(picked.name).toBe('ETC S4')
    expect(picked.priceEUR).toBe(1200)
    expect(picked.heightMm).toBe(44)
    expect(picked.assetTag).toBeUndefined()
    expect(picked.ipAddress).toBeUndefined()
    expect(picked.id).toBeUndefined()
  })

  it('macht aus einem fehlenden Wert keinen leeren Schluessel', () => {
    // `priceEUR: undefined` behauptete, der Preis sei bekannt und leer.
    const picked = pickModelFields({ name: 'X', priceEUR: undefined })
    expect('priceEUR' in picked).toBe(false)
    expect(Object.keys(picked)).toEqual(['name'])
  })
})

describe('die Rekonstruktion traegt sie wirklich', () => {
  it('templateFromEquipment beginnt mit den Modell-Feldern', () => {
    // Zuerst die Rohuebernahme, danach die ausdruecklichen Felder: so gewinnt
    // eine bewusste Angabe (override-Name, normalisierte Kategorie) und der
    // Rest kommt trotzdem vollstaendig mit.
    expect(templateSliceSrc).toContain('...(pickModelFields(')
    const start = templateSliceSrc.indexOf('const templateFromEquipment')
    const pick = templateSliceSrc.indexOf('pickModelFields(item', start)
    const name = templateSliceSrc.indexOf('name: override.name', start)
    expect(pick).toBeGreaterThan(-1)
    expect(pick).toBeLessThan(name)
  })
})

describe('der Widerspruch, den die Frage aufgedeckt hat', () => {
  it('die zweite Rekonstruktion urteilt weiterhin anders — und sagt es', () => {
    // `healRentmanLibraryFromProject` traegt die Netz-Identitaet bewusst NICHT
    // und begruendet es: „eine Library-Vorlage mit fest eingebauter IP erzeugt
    // beim zweiten Herausziehen einen Adresskonflikt."
    //
    // `templateFromEquipment` traegt sie. Zwei Rekonstruktionen desselben
    // Programms, zwei entgegengesetzte Urteile — und das bleibt vorerst so:
    // die Netz-Identitaet im Template ist der Ausroll-Nutzen, den
    // Design-Frage 5 als echt bezeichnet und mit „beim Export fragen"
    // beantwortet hat. Ihn hier nebenbei wegzunehmen waere genau die
    // Nebenbei-Entscheidung, die der Kommentar selbst zurueckweist.
    //
    // Dieser Test haelt den Widerspruch fest, statt ihn zu verstecken: wer
    // eine der beiden Seiten aendert, kommt hier vorbei.
    expect(projectStoreSrc).toContain('Bewusst NICHT uebernommen')
    expect(templateSliceSrc).toContain('password: item.password')
    expect(INSTANCE_FIELDS as readonly string[]).toContain('password')
  })
})
