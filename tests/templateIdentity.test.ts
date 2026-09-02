import { describe, expect, it, beforeEach } from 'vitest'
import {
  upsertCachedRentmanTemplateFromEquipment,
  getCachedRentmanTemplate,
} from '../src/renderer/lib/rentmanTemplateCache'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ADR-005, Inkrement 3 — zweiter von Hand nachgelesener Hinweis.
//
// `deviceTypeId` ist die stabile Katalog-Identitaet aus ADR-002. Der Kommentar
// in `healItem` sagt dazu: „die Typ-Identitaet muss die Heilung ueberleben;
// genau hier ginge sie sonst still verloren." Genau das passierte eine Datei
// weiter: der Rentman-Template-Cache und `saveEquipmentAsTemplate` bauen ihr
// Template aus einer festen Feldliste neu, und `deviceTypeId` stand auf keiner
// von beiden. Ein Geraet kam aus dem Cache ohne Katalog-Identitaet zurueck und
// der Import fiel auf die Namens-Heuristiken zurueck — aus einer
// Datenblatt-Tatsache wurde wieder ein Regex-Treffer.

const eq = (over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: 'e1',
    name: 'ATEM Mini Extreme',
    category: 'Videomischer',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rentmanId: 'rm-42',
    deviceTypeId: 'dt-0815',
    ...over,
  }) as unknown as EquipmentItem

describe('Rentman-Template-Cache — Katalog-Identitaet ueberlebt (ADR-005)', () => {
  beforeEach(() => localStorage.clear())

  it('traegt deviceTypeId in den Cache und wieder heraus', () => {
    upsertCachedRentmanTemplateFromEquipment(eq())
    expect(getCachedRentmanTemplate('rm-42')?.deviceTypeId).toBe('dt-0815')
  })

  it('erfindet keine Identitaet, wo das Geraet keine hat', () => {
    // Ein manuell angelegtes Geraet hat keine Katalog-Zeile. Es bekommt hier
    // auch keine — sonst waere die ID eine Behauptung statt einer Tatsache.
    upsertCachedRentmanTemplateFromEquipment(eq({ deviceTypeId: undefined }))
    expect(getCachedRentmanTemplate('rm-42')?.deviceTypeId).toBeUndefined()
  })

  it('schreibt nichts ohne rentmanId', () => {
    upsertCachedRentmanTemplateFromEquipment(eq({ rentmanId: undefined }))
    expect(getCachedRentmanTemplate('rm-42')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// ADR-005, Inkrement 3 — neunter nachgelesener Hinweis.
//
// `healRentmanLibraryFromProject` synthetisiert eine Library-Vorlage, wenn ein
// Canvas-Geraet einen `rentmanId` hat, aber kein Template dazu existiert (der
// Fall aus #171: fremder Rechner, geleerte Library). Der Zweig nannte 15
// Felder — eine echte Teilmenge der 37 des Caches. Wer danach eine zweite
// Kopie aus der Library zieht, bekam ein Geraet ohne Leistungsaufnahme, ohne
// Tiefe und ohne Katalog-Identitaet.

describe('healRentmanLibraryFromProject — Synthese verliert die Modelldaten nicht', () => {
  const project = (item: Partial<EquipmentItem>) =>
    ({
      metadata: {
        name: 'T',
        description: '',
        createdAt: '',
        updatedAt: '',
        rentmanProjectId: 'p1',
        rentmanProjectName: 'Show',
      },
      equipment: [eq(item)],
      cables: [],
      canvasState: { x: 0, y: 0, zoom: 1 },
    }) as never

  const synthesize = async (item: Partial<EquipmentItem>) => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    useProjectStore.setState({ customLibrary: [] })
    useProjectStore.getState().loadProject(project(item))
    return useProjectStore
      .getState()
      .customLibrary.find((t) => t.rentmanId === 'rm-42')
  }

  it('traegt die Engineering-Daten in die synthetisierte Vorlage', async () => {
    const t = await synthesize({ powerWatts: 350, weightKg: 12.4, depthMm: 480 })
    expect(t).toBeDefined()
    expect(t?.powerWatts).toBe(350)
    expect(t?.weightKg).toBe(12.4)
    expect(t?.depthMm).toBe(480)
  })

  it('traegt die Katalog-Identitaet mit', async () => {
    // Ohne sie faellt der naechste Rentman-Import auf Namens-Heuristiken
    // zurueck — derselbe Schaden wie oben, nur an einer zweiten Stelle.
    expect((await synthesize({}))?.deviceTypeId).toBe('dt-0815')
  })

  it('nimmt die Netz-Identitaet ausdruecklich NICHT mit', async () => {
    // Eine Library-Vorlage mit fest eingebauter IP erzeugt beim zweiten
    // Herausziehen einen Adresskonflikt. Die beiden anderen Rekonstruktionen
    // tragen sie; ob das dort richtig ist, ist eine eigene Frage.
    const t = await synthesize({ ipAddress: '10.0.0.5', macAddress: 'aa:bb' })
    expect(t?.ipAddress).toBeUndefined()
    expect(t?.macAddress).toBeUndefined()
  })
})
