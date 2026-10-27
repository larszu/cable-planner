import { describe, it, expect } from 'vitest'
import { computeEquipmentLayout } from '../src/renderer/lib/equipmentLayout'
import {
  RASTER_DEFAULT,
  RASTER_MAX,
  RASTER_MIN,
  SKALA_MAX,
  SKALA_MIN,
  SKALA_STUFE,
  SKALA_VORGABE,
  rasterAus,
  rasterSkaliert,
  skalaGrenzen,
} from '../src/renderer/lib/raster'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// DIE GEZOGENE GERAETE-GROESSE
//
// NUTZER-WUNSCH 2026-10-27: „mache in cable planner die groesse der geraete
// responsive anpassbar vom user im canvas".
//
// Die Groesse ist ein FAKTOR auf die Mindestmasse, kein freies Mass. Alles,
// was dieser Lauf festhaelt, folgt aus diesem einen Entschluss:
//
//   * Faktor 1 darf NICHTS verschieben. Sonst waere jeder bestehende Plan
//     beim ersten Oeffnen anders — und zwar bis in die Kabelenden.
//   * Die Zusage von `raster.ts` („jede Buchse ist ein Gitterpunkt") muss in
//     JEDER Groesse gelten, nicht nur bei 100 %. Haette man das fertige Mass
//     skaliert statt der Mindestmasse, laege bei Faktor 1,5 jede zweite
//     Port-Reihe neben dem Gitter — der Fehler, den `raster.ts` 2026-09-12
//     abgestellt hat, waere durch die Hintertuer zurueck.
//   * `width`/`height` bleiben ein ABBILD. Die Regression vom 2026-09-11
//     (langer Port-Name macht breit, Kuerzen macht nicht schmal) darf auch
//     bei einem gezogenen Geraet nicht wiederkommen.
//
// WAS DIESER LAUF NICHT KANN: er rechnet. Ob eine Kachel bei 300 % noch gut
// aussieht, ist eine Geschmacksfrage und steht hier nicht.
// ───────────────────────────────────────────────────────────────────────────

const geraet = (ports: number, extra: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: 'eq-1',
    name: 'Device 1',
    category: 'Other',
    x: 0,
    y: 0,
    inputs: Array.from({ length: ports }, (_, i) => ({
      id: `in${i}`, name: `In ${i + 1}`, type: 'BNC', connectorType: 'BNC', direction: 'in' as const,
    })),
    outputs: Array.from({ length: ports }, (_, i) => ({
      id: `out${i}`, name: `Out ${i + 1}`, type: 'BNC', connectorType: 'BNC', direction: 'out' as const,
    })),
    ...extra,
  }) as EquipmentItem

/** Alle Faktoren, die der Griff hergibt — in der Stufung, in der er sie gibt. */
const ALLE_FAKTOREN = Array.from(
  { length: Math.round((SKALA_MAX - SKALA_MIN) / SKALA_STUFE) + 1 },
  (_, i) => skalaGrenzen(SKALA_MIN + i * SKALA_STUFE),
)

describe('skalaGrenzen — was aus einer Datei kommt, wird nicht geglaubt', () => {
  it('fehlende und unbrauchbare Angaben werden die Vorgabe', () => {
    for (const roh of [undefined, Number.NaN, Number.POSITIVE_INFINITY, null as unknown as number]) {
      expect(skalaGrenzen(roh)).toBe(SKALA_VORGABE)
    }
  })

  it('zu klein und zu gross werden an die Grenze geholt', () => {
    // Eine 0 ergaebe eine Kachel ohne Flaeche, eine 50 eine, die man auf dem
    // Bildschirm nicht mehr findet. Beides steht so in keiner Datei, die
    // dieses Programm geschrieben hat — aber in einer fremden schon.
    expect(skalaGrenzen(0)).toBe(SKALA_MIN)
    expect(skalaGrenzen(-3)).toBe(SKALA_MIN)
    expect(skalaGrenzen(50)).toBe(SKALA_MAX)
  })

  it('krumme Werte rasten auf die Stufe', () => {
    expect(skalaGrenzen(1.234)).toBe(1.25)
    expect(skalaGrenzen(1.01)).toBe(1)
    // Und das Ergebnis ist selbst stufenrein: zweimal durchgeschickt bleibt
    // es, wo es ist.
    for (const f of ALLE_FAKTOREN) expect(skalaGrenzen(f)).toBe(f)
  })
})

describe('Faktor 1 verschiebt nichts', () => {
  it('ohne Feld und mit 1 ist dasselbe Layout', () => {
    for (const ports of [1, 3, 8]) {
      for (const zusatz of [{}, { subtitle: 'Sub' }, { ipAddress: '10.0.0.1' }]) {
        const ohne = computeEquipmentLayout(geraet(ports, zusatz))
        const mit = computeEquipmentLayout(geraet(ports, { ...zusatz, sizeScale: 1 }))
        expect({ w: mit.width, h: mit.height }).toEqual({ w: ohne.width, h: ohne.height })
        const a = ohne.portPos('in0', 'target')!
        const b = mit.portPos('in0', 'target')!
        expect(b).toEqual(a)
      }
    }
  })

  it('das Vorgabe-Raster traegt die alten Zahlen und eine Extra-Zeile von 11', () => {
    // EXTRA_LINE ist neu. Bei der Vorgabe MUSS sie die Rastergroesse selbst
    // sein — genau die Zahl, die vorher in Knoten und Layout je als
    // `GRID_SIZE` hingeschrieben stand.
    const r = rasterAus(RASTER_DEFAULT)
    expect(r.EXTRA_LINE).toBe(r.GRID_SIZE)
    expect(r.SKALA).toBe(SKALA_VORGABE)
  })
})

describe('Die Buchsen bleiben in JEDER Groesse auf dem Gitter', () => {
  it('Port-Reihe bleibt gerades Vielfaches, alle Masse Vielfache', () => {
    for (const g of [RASTER_MIN, 8, RASTER_DEFAULT, 16, 22, RASTER_MAX]) {
      for (const f of ALLE_FAKTOREN) {
        const r = rasterAus(g, f)
        expect(r.PORT_ROW % (2 * r.GRID_SIZE)).toBe(0)
        expect((r.PORT_ROW / 2) % r.GRID_SIZE).toBe(0)
        for (const mass of [r.HEADER_HEIGHT, r.HEADER_HEIGHT_WITH_IP, r.PADDING, r.DEFAULT_WIDTH, r.EXTRA_LINE]) {
          expect(mass % r.GRID_SIZE).toBe(0)
        }
      }
    }
  })

  it('jede Buchse eines gezogenen Geraets liegt auf einem Gitterpunkt', () => {
    // Nicht aus der Formel abgelesen, sondern aus dem fertigen Layout: Kopf,
    // Untertitel, Adresszeile, Reihenhoehe und Faktor wirken hier zusammen,
    // und genau dieses Zusammenwirken ist die Stelle, an der es schiefgeht.
    let geprueft = 0
    for (const g of [RASTER_MIN, RASTER_DEFAULT, 16, RASTER_MAX]) {
      for (const f of [0.6, 0.75, 1, 1.25, 1.5, 2, 2.35, 3]) {
        const r = rasterAus(g)
        for (const zusatz of [{}, { subtitle: 'Sub' }, { ipAddress: '10.0.0.1' },
                              { ipAddress: '10.0.0.1', subtitle: 'Sub' }]) {
          for (const ports of [1, 2, 5, 9]) {
            const eq = geraet(ports, { ...zusatz, sizeScale: f })
            const layout = computeEquipmentLayout(eq, undefined, r)
            expect(layout.width % r.GRID_SIZE).toBe(0)
            expect(layout.height % r.GRID_SIZE).toBe(0)
            for (let i = 0; i < ports; i += 1) {
              for (const [portId, art] of [[`in${i}`, 'target'], [`out${i}`, 'source']] as const) {
                const p = layout.portPos(portId, art)!
                expect(p.x % r.CELL_SIZE).toBe(0)
                expect(p.y % r.CELL_SIZE).toBe(0)
                geprueft += 1
              }
            }
          }
        }
      }
    }
    // Ohne diese Zeile koennte die Schleife leer laufen und der Lauf waere
    // gruen, ohne eine einzige Buchse angesehen zu haben.
    expect(geprueft).toBeGreaterThan(2000)
  })
})

describe('Der Faktor wirkt — und wirkt in eine Richtung', () => {
  it('groesser ist nie kleiner, und 200 % ist deutlich groesser als 100 %', () => {
    const masse = ALLE_FAKTOREN.map((f) => {
      const l = computeEquipmentLayout(geraet(4, { sizeScale: f }))
      return { f, w: l.width, h: l.height }
    })
    for (let i = 1; i < masse.length; i += 1) {
      expect(masse[i].w).toBeGreaterThanOrEqual(masse[i - 1].w)
      expect(masse[i].h).toBeGreaterThanOrEqual(masse[i - 1].h)
    }
    const eins = computeEquipmentLayout(geraet(4, { sizeScale: 1 }))
    const zwei = computeEquipmentLayout(geraet(4, { sizeScale: 2 }))
    const klein = computeEquipmentLayout(geraet(4, { sizeScale: 0.6 }))
    // Nicht exakt das Doppelte — die Masse rasten auf das Raster ein, und die
    // Kopfhoehe hat eine Untergrenze. Aber in der Groessenordnung.
    expect(zwei.width / eins.width).toBeGreaterThan(1.7)
    expect(zwei.height / eins.height).toBeGreaterThan(1.7)
    expect(klein.width).toBeLessThan(eins.width)
  })

  it('rasterSkaliert und rasterAus sagen dasselbe', () => {
    const basis = rasterAus(RASTER_DEFAULT)
    expect(rasterSkaliert(basis, 1.5)).toEqual(rasterAus(RASTER_DEFAULT, 1.5))
    // Ein fehlender Faktor ist die Vorgabe und nicht „irgendwas".
    expect(rasterSkaliert(basis, undefined)).toEqual(basis)
  })

  it('dieselbe Anfrage gibt DASSELBE Objekt zurueck, auch im Wechsel', () => {
    // Der Grund, warum der Ein-Platz-Zwischenspeicher einem je Schluessel
    // gewichen ist: Komponenten rufen `rasterAus` im Rendern auf und haengen
    // `useMemo` daran. Mit einem Platz raeumte ein Plan aus zwei verschieden
    // grossen Geraeten den Speicher bei jedem Knoten leer, und jede
    // Memoisierung waere still verschwunden.
    const a1 = rasterAus(RASTER_DEFAULT, 1)
    const b1 = rasterAus(RASTER_DEFAULT, 2)
    const a2 = rasterAus(RASTER_DEFAULT, 1)
    const b2 = rasterAus(RASTER_DEFAULT, 2)
    expect(a2).toBe(a1)
    expect(b2).toBe(b1)
    expect(a1).not.toBe(b1)
  })
})

describe('width/height bleiben ein Abbild, auch am gezogenen Geraet', () => {
  it('ein gekuerzter Port-Name macht die Kachel auch bei Faktor 2 wieder schmaler', () => {
    // Die Regression vom 2026-09-11 in der neuen Groesse: damals war die
    // gespeicherte Breite die Untergrenze, und ein 37 Zeichen langer Port-Name
    // liess das Geraet fuer immer 671 px breit. Der Faktor darf dieses Tor
    // nicht wieder aufmachen.
    const lang = computeEquipmentLayout(
      geraet(1, {
        sizeScale: 2,
        inputs: [{ id: 'in0', name: 'Kamera 1 Rueckweg Regie Halle A', type: 'BNC', connectorType: 'BNC', direction: 'in' }],
      } as Partial<EquipmentItem>),
    )
    const kurz = computeEquipmentLayout(
      geraet(1, {
        sizeScale: 2,
        inputs: [{ id: 'in0', name: 'IN', type: 'BNC', connectorType: 'BNC', direction: 'in' }],
      } as Partial<EquipmentItem>),
    )
    expect(kurz.width).toBeLessThan(lang.width)
  })

  it('eine gespeicherte width ist keine Untergrenze — auch nicht mit Faktor', () => {
    const mitAltlast = computeEquipmentLayout(geraet(2, { sizeScale: 1, width: 900 }))
    const ohne = computeEquipmentLayout(geraet(2, { sizeScale: 1 }))
    expect(mitAltlast.width).toBe(ohne.width)
  })
})

describe('Beim Laden wird der Faktor in die Grenzen geholt', () => {
  it('healProjectPositions klemmt, stuft und erfindet nichts', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    useProjectStore.getState().loadProject({
      metadata: { name: 'Groessen' },
      cables: [],
      canvasState: { x: 0, y: 0, zoom: 1 },
      equipment: [
        { ...geraet(1), id: 'a', sizeScale: 99 },
        { ...geraet(1), id: 'b', sizeScale: 0 },
        { ...geraet(1), id: 'c', sizeScale: 1.234 },
        { ...geraet(1), id: 'd' },
      ],
    } as never)
    const eq = useProjectStore.getState().project.equipment
    const von = (id: string) => eq.find((e) => e.id === id)!
    expect(von('a').sizeScale).toBe(SKALA_MAX)
    expect(von('b').sizeScale).toBe(SKALA_MIN)
    expect(von('c').sizeScale).toBe(1.25)
    // Das nie angefasste Geraet bekommt KEINEN Wert. Die Vorgabe ist das
    // Verhalten ohne Feld und gehoert nicht in die Datei — sonst traegt jedes
    // Geraet eines jeden Plans ab heute eine Angabe, die niemand gemacht hat.
    expect(von('d').sizeScale).toBeUndefined()
  })
})
