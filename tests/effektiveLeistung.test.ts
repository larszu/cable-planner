import { describe, expect, it } from 'vitest'
import { effectiveWatts } from '../src/renderer/lib/equipmentSelectors'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import analysisSrc from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'
import calculatorSrc from '../src/renderer/components/Calculators/CalculatorsDialog.tsx?raw'
import locationBomSrc from '../src/renderer/components/Project/LocationBomDialog.tsx?raw'
import drawingChecksSrc from '../src/renderer/lib/drawingChecks.ts?raw'
import { stripComments } from './support/stripComments'

// Die effektive Leistung eines Geraets stand in VIER Kopien im Renderer, und
// zwei davon liefen auseinander (gemessen 2026-09-04):
//
//   Analyse -> Gewicht/Waerme      kannte den aktiven Betriebsmodus
//   Location-BOM                   kannte den aktiven Betriebsmodus
//   Werkzeuge -> Stromverbrauch    NICHT
//   Plan-Check (drawingChecks)     NICHT
//
// Derselbe Plan zeigte damit je nach Ansicht eine andere Zahl. Der Schaden ist
// nicht die Abweichung an sich, sondern WELCHE Ansicht zu niedrig rechnete:
// ausgerechnet der Stromrechner. Aus dessen Summe kommen Phasenverteilung,
// Neutralleiterstrom, Generator-kVA, USV-Laufzeit und die Ueberlast-Warnung
// (CalculatorsDialog.tsx: totalWithMargin, balancePhases, generatorKva,
// upsOverloaded). Die sicherheitsrelevante Ansicht war die optimistischere.
//
// Watt-Summen hatten bis hierher UEBERHAUPT keine Testabdeckung -- alle 833
// Tests waren auch mit der Divergenz gruen.

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Geraet',
  category: 'Kameras',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

describe('effektive Leistung — eine Kette, nicht vier', () => {
  it('nimmt den aktiven Modus vor dem Geraete-Wert', () => {
    const item = eq({
      powerConsumptionWatts: 100,
      activeModeId: 'm4k',
      modes: [
        { id: 'm4k', name: '4K', inputs: [], outputs: [], powerWatts: 250 },
        { id: 'mhd', name: 'HD', inputs: [], outputs: [], powerWatts: 90 },
      ],
    })
    expect(effectiveWatts(item)).toBe(250)
  })

  it('faellt auf den Geraete-Wert zurueck, wenn der Modus keine Leistung nennt', () => {
    const item = eq({
      powerConsumptionWatts: 100,
      activeModeId: 'mstd',
      modes: [{ id: 'mstd', name: 'Standard', inputs: [], outputs: [] }],
    })
    expect(effectiveWatts(item)).toBe(100)
  })

  it('rechnet V x A, wenn keine Watt-Angabe da ist', () => {
    expect(effectiveWatts(eq({ voltage: 230, currentAmps: 2 }))).toBe(460)
  })

  it('ist 0 statt undefined, wenn gar nichts bekannt ist', () => {
    expect(effectiveWatts(eq({}))).toBe(0)
  })

  it('ignoriert Modus-Leistung, solange der Modus nicht aktiv ist', () => {
    const item = eq({
      powerConsumptionWatts: 100,
      modes: [{ id: 'm4k', name: '4K', inputs: [], outputs: [], powerWatts: 250 }],
    })
    expect(effectiveWatts(item)).toBe(100)
  })

  it('nimmt `powerWatts` des GERAETS bewusst NICHT auf', () => {
    // #167-Feld (Rentman-Engineering-Daten) ist ein anderes Feld als
    // `powerConsumptionWatts` und wird von keiner Summe gelesen. Es hier
    // aufzunehmen wuerde die Zahlen bestehender Projekte veraendern -- das ist
    // eine Eigentuemer-Entscheidung (B-15 im Suite-Backlog), keine
    // Aufraeumarbeit. Dieser Test haelt die Entscheidung fest, damit sie nicht
    // beilaeufig gekippt wird.
    expect(effectiveWatts(eq({ powerWatts: 500 }))).toBe(0)
  })
})

describe('effektive Leistung — keine neue Kopie', () => {
  const QUELLEN: Array<[string, string]> = [
    ['AnalysisDialog', analysisSrc],
    ['CalculatorsDialog', calculatorSrc],
    ['LocationBomDialog', locationBomSrc],
    ['drawingChecks', drawingChecksSrc],
  ]

  it('alle vier Stellen holen den Helfer aus equipmentSelectors', () => {
    for (const [name, src] of QUELLEN) {
      expect(stripComments(src), `${name} importiert effectiveWatts nicht`).toMatch(
        /import\s*\{[^}]*\beffectiveWatts\b[^}]*\}\s*from\s*'[^']*equipmentSelectors'/,
      )
    }
  })

  it('keine der vier Stellen deklariert eine eigene Fassung', () => {
    for (const [name, src] of QUELLEN) {
      expect(stripComments(src), `${name} deklariert effectiveWatts erneut`).not.toMatch(
        /(?:const|function)\s+effectiveWatts\b/,
      )
    }
  })

  it('keine der vier Stellen loest den aktiven Modus von Hand auf', () => {
    // Genau diese Handaufloesung war die Divergenz: LocationBomDialog machte
    // sie neben `effectiveDeviceResources(d)` noch einmal selbst.
    for (const [name, src] of QUELLEN) {
      expect(stripComments(src), `${name} loest activeModeId fuer Leistung selbst auf`).not.toMatch(
        /activeModeId[\s\S]{0,120}?\?\.powerWatts/,
      )
    }
  })
})
