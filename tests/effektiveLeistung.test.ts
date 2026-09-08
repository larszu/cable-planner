import { describe, expect, it } from 'vitest'
import { effectiveWatts, wattsWithSource } from '../src/renderer/lib/equipmentSelectors'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import analysisSrc from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'
import calculatorSrc from '../src/renderer/components/Calculators/CalculatorsDialog.tsx?raw'
import locationBomSrc from '../src/renderer/components/Project/LocationBomDialog.tsx?raw'
import drawingChecksSrc from '../src/renderer/lib/drawingChecks.ts?raw'
import equipmentTypesSrc from '../src/renderer/types/equipment.ts?raw'
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

  it('nimmt `powerWatts` des GERAETS auf — seit E-8', () => {
    // Hier stand bis 2026-09-08 die Gegenprobe: `expect(...).toBe(0)`, mit der
    // Begruendung, die Aufnahme sei eine Eigentuemer-Entscheidung. Die ist
    // gefallen (E-8), und der Einwand loest sich in seiner eigenen Formulierung
    // auf: „veraendert die Zahlen bestehender Projekte" beschreibt eine
    // BERICHTIGUNG. Ein Geraet, dessen Leistung im Projekt steht und das mit
    // 0 W in die Summe geht, faellt aus Phasenverteilung und Ueberlast-Warnung
    // heraus.
    expect(effectiveWatts(eq({ powerWatts: 500 }))).toBe(500)
  })

  it('laesst dem GEPLANTEN Wert den Vorrang vor dem importierten', () => {
    // Wer geplant hat, hat entschieden. Ohne diese Reihenfolge ueberschriebe
    // ein Rentman-Import stillschweigend eine Angabe, die jemand von Hand
    // gesetzt hat.
    expect(effectiveWatts(eq({ powerConsumptionWatts: 100, powerWatts: 500 }))).toBe(100)
  })

  it('nimmt den Import VOR der Rechnung aus V x A', () => {
    // Der Import ist eine genannte Zahl, V x A eine Rechnung aus zwei Feldern,
    // die oft Typenschild-Nennwerte tragen.
    expect(effectiveWatts(eq({ powerWatts: 500, voltage: 230, currentAmps: 2 }))).toBe(500)
  })
})

describe('die Leistung kommt nie ohne ihre Herkunft', () => {
  // Die zweite Bedingung von E-8. Eine Summe aus zwei Quellen ohne Herkunft
  // ist genau die Zahl, an der jemand eine Verteilung zusagt.
  it('nennt jede der fuenf Herkuenfte', () => {
    expect(
      wattsWithSource(
        eq({
          activeModeId: 'm',
          modes: [{ id: 'm', name: '4K', inputs: [], outputs: [], powerWatts: 250 }],
        }),
      ),
    ).toEqual({ watts: 250, source: 'mode' })
    expect(wattsWithSource(eq({ powerConsumptionWatts: 100 }))).toEqual({
      watts: 100,
      source: 'planned',
    })
    expect(wattsWithSource(eq({ powerWatts: 500 }))).toEqual({ watts: 500, source: 'imported' })
    expect(wattsWithSource(eq({ voltage: 230, currentAmps: 2 }))).toEqual({
      watts: 460,
      source: 'derived',
    })
    expect(wattsWithSource(eq({}))).toEqual({ watts: 0, source: 'none' })
  })

  it('der Stromrechner zeigt die Herkunft in derselben Zeile wie die Zahl', () => {
    // Eine Herkunft in einer Fussnote wird nicht gelesen; die Liste liest man
    // wegen der Zahlen.
    const zeile = calculatorSrc.slice(
      calculatorSrc.indexOf('totals.devices.slice(0, 12).map'),
      calculatorSrc.indexOf('</details>', calculatorSrc.indexOf('totals.devices.slice(0, 12).map')),
    )
    expect(zeile).toContain('wattsQuelleLabel(t, d.source)')
    expect(zeile).toContain('{d.watts} W')
  })

  it('beschriftet jede Herkunft — erzwungen durch den Typ', () => {
    // Eine Kette mit Default haette eine neue Quelle stumm als „geplant"
    // ausgegeben, und das ist die eine Auskunft, die nicht raten darf.
    expect(calculatorSrc).toContain('satisfies Record<WattsSource, [string, string]>')
    for (const q of ['mode', 'planned', 'imported', 'derived', 'none']) {
      expect(calculatorSrc).toMatch(new RegExp(`\\b${q}: \\['calc\\.watts\\.`))
    }
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
    // Auf DIE ENGSTELLE pruefen, nicht auf einen Namen: seit E-8 gibt es zwei
    // Ausgaenge desselben Helfers — `effectiveWatts` (nur die Zahl) und
    // `wattsWithSource` (Zahl mit Herkunft). Der Stromrechner nimmt den
    // zweiten. Eine erste Fassung pinnte den Namen `effectiveWatts` und wurde
    // an genau dieser Verbesserung rot — also an der richtigen Aenderung statt
    // am Defekt.
    for (const [name, src] of QUELLEN) {
      expect(stripComments(src), `${name} importiert den Leistungs-Helfer nicht`).toMatch(
        /import\s*\{[^}]*\b(?:effectiveWatts|wattsWithSource)\b[^}]*\}\s*from\s*'[^']*equipmentSelectors'/,
      )
    }
  })

  it('keine der vier Stellen deklariert eine eigene Fassung', () => {
    for (const [name, src] of QUELLEN) {
      expect(stripComments(src), `${name} deklariert den Leistungs-Helfer erneut`).not.toMatch(
        /(?:const|function)\s+(?:effectiveWatts|wattsWithSource)\b/,
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

// ───────────────────────────────────────────────────────────────────────────
// Die Typ-Doku von `powerWatts`/`weightKg` gegen den gemessenen Stand.
//
// WARUM ES DAS GIBT (2026-09-04). Der Kommentar an den beiden Feldern in
// `types/equipment.ts` behauptete, sie wuerden "in den Properties angezeigt
// und vom 3D-Rack-Builder (#170) fuer die Tiefen-Visualisierung genutzt".
// Beides war falsch: `components/Rack/` nennt keines der beiden Felder, die
// Tiefe kommt aus `depthMm` (`RackPlacementProperties.tsx:276`).
//
// Der Schaden lag nicht im falschen Satz, sondern darin, was er verhindert
// hat: `powerWatts` sah benutzt aus. Wer nach stummen Feldern sucht, haette
// es uebersprungen -- und genau das ist ueber acht Fundstellen hinweg
// passiert (B-15 im Suite-Backlog).
//
// WARUM ALS BERECHNETE PRUEFUNG. Die Korrektur ist eine Messung, und eine
// Messung, die nur als Prosa dasteht, ist am naechsten Tag wieder eine
// Behauptung. Diese Pruefung faellt, sobald `Rack/` eines der Felder
// benutzt -- nicht um das zu verbieten (ein Gewichts-Hinweis am Rack waere
// sinnvoll), sondern damit derselbe Satz nicht ein zweites Mal stehenbleibt,
// waehrend die Welt sich darunter bewegt.
// ───────────────────────────────────────────────────────────────────────────
const rackQuellen = import.meta.glob('../src/renderer/components/Rack/*.ts*', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

describe('Typ-Doku powerWatts/weightKg', () => {
  it('Rack/ liest weder powerWatts noch weightKg — sonst gehoert die Doku nachgezogen', () => {
    const dateien = Object.keys(rackQuellen)
    expect(dateien.length, 'Rack-Glob hat nichts gefunden — dann misst diese Pruefung nichts').toBeGreaterThan(0)

    const treffer = dateien.flatMap((pfad) =>
      ['powerWatts', 'weightKg']
        .filter((feld) => stripComments(rackQuellen[pfad]).includes(feld))
        .map((feld) => `${pfad.split('/').pop()}: ${feld}`),
    )

    expect(
      treffer,
      'Rack/ benutzt jetzt eines der Felder. Das ist erlaubt — aber die Typ-Doku ' +
        'an EquipmentItem.powerWatts/weightKg sagt derzeit ausdruecklich, dass es ' +
        'das NICHT tut. Diesen Absatz mit anpassen, sonst steht dort wieder eine ' +
        'Behauptung statt einer Messung.',
    ).toEqual([])
  })

  it('die Typ-Doku behauptet keine Rack-Nutzung mehr', () => {
    const start = equipmentTypesSrc.indexOf('v7.9.70 / #167')
    expect(start, 'Doku-Block zu powerWatts nicht gefunden').toBeGreaterThan(-1)
    const block = equipmentTypesSrc.slice(start, equipmentTypesSrc.indexOf('powerWatts?: number', start))

    expect(
      /Werden in den Properties angezeigt und vom[\s*]+3D-Rack-Builder/.test(block),
      'Der widerlegte Satz steht wieder in der Typ-Doku.',
    ).toBe(false)
  })
})
