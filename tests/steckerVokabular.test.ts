import { describe, expect, it } from 'vitest'
import { ALL_CONNECTOR_TYPES, type ConnectorType } from '../src/renderer/types/equipment'
import { CONNECTOR_CATALOG } from '../src/renderer/lib/connectorCatalog'
import { DEFAULT_CONNECTOR_TYPE_COLORS } from '../src/renderer/lib/cableColors'

// ───────────────────────────────────────────────────────────────────────────
// ZWEI STECKER-VOKABULARE, DIE AUSEINANDERGELAUFEN SIND (gemessen 2026-09-24)
//
// `types/equipment.ts` fuehrt die Union `ConnectorType`. `lib/connectorCatalog
// .ts` fuehrt seit #170 den gruppierten Auswahl-Katalog mit Symbolen, und sein
// Kopf erklaert, warum das ohne die Union ging:
//
//   > Neue Stecker bekommen eine eigene String-ID — `connectorType` ist eh ein
//   > freier String […], sodass das ohne Union-Erweiterung traegt.
//
// Das stimmte und war trotzdem ein Auseinanderlaufen. NACHGEMESSEN: 36
// Stecker-Ids standen im Katalog und nicht in der Union. Der Nutzer konnte sie
// im Patchblenden-Dialog waehlen, und der Uebersetzer hat in ihnen seit #170
// keinen Tippfehler gefunden, weil er sie nicht kannte.
//
// ─── WAS DIESER WAECHTER HAELT ─────────────────────────────────────────────
//
//  1. Jeder Stecker des Auswahl-Katalogs steht in der Union. Das ist die
//     Richtung, die kaputt war.
//  2. Jeder Stecker der Union hat eine Farbe. Ohne sie faellt er in der
//     Legende auf die Vorgabefarbe und ist von seinem Nachbarn nicht zu
//     unterscheiden — und zwar still.
//  3. Kein Stecker steht zweimal.
//  4. Die zwei bekannten DOPPELUNGEN bleiben benannt. Sie meinen dasselbe und
//     bleiben trotzdem beide: gespeicherte Plaene tragen die eine ODER die
//     andere Zeichenkette, und eine davon stillzulegen hiesse, fremde Dateien
//     umzuschreiben.
//
// Die andere Richtung wird NICHT geprueft: die Union darf Stecker fuehren, die
// der Auswahl-Katalog nicht anbietet (Triax-Untertypen, SMPTE-304M-Hybride,
// CEE). Der Katalog ist eine Auswahlhilfe fuer die Patchblende, kein Register.
// ───────────────────────────────────────────────────────────────────────────

/** Stecker, die dasselbe meinen und trotzdem beide dastehen. Mit Grund. */
const BEKANNTE_DOPPELUNGEN: ReadonlyArray<readonly [ConnectorType, ConnectorType, string]> = [
  [
    'opticalCON DUO',
    'Neutrik opticalCON DUO',
    'Die kurze Form kommt aus dem Auswahl-Katalog (#170), die lange aus der ' +
      'Union (#885, wo die Faserzahl am Typ haengt). Beide stehen in ' +
      'gespeicherten Plaenen.',
  ],
  [
    'opticalCON QUAD',
    'Neutrik opticalCON QUAD',
    'Wie DUO.',
  ],
]

describe('das Stecker-Vokabular ist EINES', () => {
  it('kennt jeden Stecker des Auswahl-Katalogs auch im Typ', () => {
    const union = new Set<string>(ALL_CONNECTOR_TYPES)
    const fehlend = CONNECTOR_CATALOG.map((c) => c.id as string).filter((id) => !union.has(id))
    expect(
      fehlend,
      'Diese Stecker kann der Nutzer waehlen, aber der Uebersetzer kennt sie nicht.',
    ).toEqual([])
  })

  it('hat fuer jeden Stecker eine Farbe', () => {
    const ohneFarbe = ALL_CONNECTOR_TYPES.filter((c) => !DEFAULT_CONNECTOR_TYPE_COLORS[c])
    expect(ohneFarbe, 'Ohne Farbe ist der Stecker in der Legende nicht zu unterscheiden.').toEqual([])
  })

  it('fuehrt keinen Stecker doppelt', () => {
    expect(ALL_CONNECTOR_TYPES.length).toBe(new Set(ALL_CONNECTOR_TYPES).size)
  })

  it('haelt die bekannten Doppelungen fest, statt sie zu verschweigen', () => {
    // Faellt eine davon eines Tages weg, wird diese Zeile rot — und dann
    // gehoert die Migration gespeicherter Ports dazu, nicht nur die Loeschung.
    for (const [a, b, grund] of BEKANNTE_DOPPELUNGEN) {
      expect(ALL_CONNECTOR_TYPES, grund).toContain(a)
      expect(ALL_CONNECTOR_TYPES, grund).toContain(b)
    }
  })

  it('zaehlt, wie gross das Vokabular ist', () => {
    // Gegenprobe zum Test selbst: waere die Liste leer, waeren alle Zeilen
    // oben gruen und wuerden nichts bedeuten.
    //
    // 58 -> 127 am 2026-09-24: 36 aus dem Auswahl-Katalog nachgezogen, 33
    // Vokabel-Luecken der Installations-AV geschlossen (Schraubklemmen,
    // NEMA-Strom, etherCON, QSFP, DC-Hohlstecker).
    expect(ALL_CONNECTOR_TYPES.length).toBe(127)
  })
})
