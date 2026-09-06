import { describe, expect, it } from 'vitest'
import { erpReconcileTable, reconcileErp, type ErpLine } from '../src/renderer/lib/erpReconcile'
import type { DemandLine } from '../src/renderer/lib/inventoryCoverage'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import quelle from '../src/renderer/lib/erpReconcile.ts?raw'
import dialogQuelle from '../src/renderer/components/Rentman/RentmanImportDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Bedarf 28 -- der Abgleich gegen die ERP-Reservierung, in BEIDE Richtungen.
//
//   > The PM's real question is never „what does my plan contain" but „WHAT
//   > DOES MY PLAN CONTAIN THAT THE ERP PROJECT DOES NOT, and which side
//   > changed since we last agreed?"
//
// Und: „The valuable increment is the DIFF, not more export."
//
// Der teuerste Fehler waere eine geratene Zuordnung: sie erklaert eine
// Position fuer vorhanden, die es nicht ist, und das kostet am Aufbautag ein
// Geraet. Der zweitteuerste ist das Mitzaehlen der Zeilen, die keine Geraete
// sind -- dann stimmt keine Summe.
// ---------------------------------------------------------------------------

const eq = (id: string, rentmanId?: string): EquipmentItem =>
  ({ id, name: id, category: 'Sonstiges', inputs: [], outputs: [], x: 0, y: 0, width: 1, height: 1, rentmanId }) as unknown as EquipmentItem

const demand = (label: string, quantity: number, equipmentIds: string[] = []): DemandLine => ({
  key: label,
  label,
  quantity,
  equipmentIds,
  labelIsDeviceName: false,
})

const erp = (over: Partial<ErpLine> = {}): ErpLine => ({
  equipmentId: 'r1',
  name: 'Sony PMW-F55',
  qty: 1,
  kind: 'device',
  isSetChild: false,
  ...over,
})

describe('die Zeilen, die nicht zaehlen', () => {
  it('ignoriert Kommentarzeilen und sagt WARUM', () => {
    // „Aufbau ab 8 Uhr" ist kein Geraet. Sie mitzuzaehlen macht jeden
    // Abgleich falsch.
    const r = reconcileErp([], [], [erp({ kind: 'comment', name: 'Aufbau ab 8 Uhr' })])
    expect(r.rows).toEqual([])
    expect(r.ignored).toEqual([{ label: 'Aufbau ab 8 Uhr', reason: 'Kommentarzeile, kein Geraet' }])
  })

  it('ignoriert den Inhalt einer Kombination', () => {
    // Er ist im Elternteil schon gezaehlt; beides zu zaehlen verdoppelt das
    // halbe Projekt.
    const r = reconcileErp([], [], [erp({ isSetChild: true })])
    expect(r.rows).toEqual([])
    expect(r.ignored[0].reason).toContain('Kombination')
  })

  it('ignoriert eine gestrichene Zeile (Menge 0)', () => {
    const r = reconcileErp([], [], [erp({ qty: 0 })])
    expect(r.rows).toEqual([])
    expect(r.ignored[0].reason).toContain('Menge 0')
  })

  it('liefert die Begruendung MIT, statt still wegzulassen', () => {
    // Eine Reservierung mit vierzig Zeilen, von denen zwoelf stillschweigend
    // fehlen, laesst niemanden nachvollziehen, warum die Summe nicht stimmt.
    const r = reconcileErp([], [], [erp({ kind: 'comment' }), erp({ isSetChild: true }), erp({ qty: 0 })])
    expect(r.ignored).toHaveLength(3)
    expect(r.ignored.every((i) => i.reason.length > 10)).toBe(true)
  })
})

describe('die Zuordnung: erst die Tatsache, dann der Vorschlag', () => {
  it('ordnet ueber die rentmanId zu und nennt das als Tatsache', () => {
    const r = reconcileErp([demand('Kamera', 1, ['e1'])], [eq('e1', 'r1')], [erp()])
    expect(r.rows[0].basis).toBe('rentman-id')
    expect(r.rows[0].verdict).toBe('matched')
  })

  it('ordnet ueber den Namen zu und nennt das als Vorschlag', () => {
    const r = reconcileErp([demand('Sony PMW-F55', 1)], [], [erp()])
    expect(r.rows[0].basis).toBe('name')
    expect(r.rows[0].verdict).toBe('matched')
  })

  it('zieht die rentmanId dem Namen vor', () => {
    // Die Bruecke aus dem Import ist eine Tatsache; der Name ist es nie.
    const zeilen = [erp({ equipmentId: 'r1', name: 'Ganz anders' }), erp({ equipmentId: 'r2', name: 'Kamera' })]
    const r = reconcileErp([demand('Kamera', 1, ['e1'])], [eq('e1', 'r1')], zeilen)
    expect(r.rows.find((x) => x.basis === 'rentman-id')?.label).toBe('Kamera')
  })

  it('ordnet NICHT zu, wenn der Name auf der ERP-Seite mehrfach vorkommt', () => {
    // Eine geratene Zuordnung erklaert eine Position fuer vorhanden, die es
    // nicht ist — und das kostet am Aufbautag ein Geraet.
    const zwei = [erp({ equipmentId: 'r1' }), erp({ equipmentId: 'r2' })]
    const r = reconcileErp([demand('Sony PMW-F55', 1)], [], zwei)
    const planZeile = r.rows.find((x) => x.verdict === 'only-in-plan')
    expect(planZeile?.basis).toBe('ambiguous')
  })

  it('ordnet NICHT zu, wenn der Name auf der PLAN-Seite mehrfach vorkommt', () => {
    // Die andere Haelfte derselben Regel. Sie fehlt gern.
    const zweimal = [demand('Sony PMW-F55', 1, ['e1']), demand('Sony PMW-F55', 2, ['e2'])]
    const r = reconcileErp(zweimal, [], [erp()])
    expect(r.rows.filter((x) => x.basis === 'ambiguous')).toHaveLength(2)
  })
})

describe('die vier Befunde', () => {
  it('nennt, was nur im Plan steht', () => {
    const r = reconcileErp([demand('Fehlt im ERP', 2)], [], [])
    expect(r.rows[0]).toEqual({ verdict: 'only-in-plan', basis: 'none', label: 'Fehlt im ERP', planQty: 2 })
    expect(r.onlyInPlan).toBe(1)
  })

  it('nennt, was nur in der Reservierung steht', () => {
    // Der halbe Bedarf, den ein reiner Export nie zeigt: reserviert und
    // bezahlt, aber im Plan nicht verlangt.
    const r = reconcileErp([], [], [erp({ name: 'Zuviel bestellt', qty: 3 })])
    expect(r.rows[0].verdict).toBe('only-in-erp')
    expect(r.rows[0].erpQty).toBe(3)
    expect(r.onlyInErp).toBe(1)
  })

  it('nennt eine Mengenabweichung MIT beiden Zahlen', () => {
    const r = reconcileErp([demand('Sony PMW-F55', 5)], [], [erp({ qty: 3 })])
    expect(r.rows[0].verdict).toBe('quantity-differs')
    expect(r.rows[0].planQty).toBe(5)
    expect(r.rows[0].erpQty).toBe(3)
    expect(r.differing).toBe(1)
  })

  it('sortiert das zu Klaerende nach oben', () => {
    // Fehlendes Material zuerst, dann Mengen, dann Ueberzaehliges, dann was
    // stimmt.
    const d = [demand('Nur Plan', 1), demand('Menge', 5, ['e1']), demand('Stimmt', 1, ['e2'])]
    const e = [eq('e1', 'rM'), eq('e2', 'rS')]
    const lines = [
      erp({ equipmentId: 'rM', name: 'Menge', qty: 2 }),
      erp({ equipmentId: 'rS', name: 'Stimmt', qty: 1 }),
      erp({ equipmentId: 'rX', name: 'Nur ERP' }),
    ]
    expect(reconcileErp(d, e, lines).rows.map((r) => r.verdict)).toEqual([
      'only-in-plan',
      'quantity-differs',
      'only-in-erp',
      'matched',
    ])
  })
})

describe('das Blatt', () => {
  it('fuehrt beide Mengen und die Art der Zuordnung', () => {
    const r = reconcileErp([demand('Sony PMW-F55', 5)], [], [erp({ qty: 3 })])
    const t = erpReconcileTable(r)
    expect(t.headers).toEqual(['Befund', 'Position', 'Plan', 'Reservierung', 'Zuordnung'])
    expect(t.rows[0]).toEqual(['Menge weicht ab', 'Sony PMW-F55', 5, 3, 'ueber den Namen (Vorschlag)'])
  })

  it('laesst die Mengenspalte LEER, wo eine Seite die Position nicht kennt', () => {
    // Eine 0 waere eine Behauptung („null Stueck reserviert"); leer ist die
    // Wahrheit („kommt dort nicht vor").
    const t = erpReconcileTable(reconcileErp([demand('Nur Plan', 2)], [], []))
    expect(t.rows[0][3]).toBe('')
  })
})

describe('was die Datei NICHT tut', () => {
  it('holt sich weder Zeit noch Store noch Netz', () => {
    expect(quelle).not.toMatch(/new Date\(\)|Date\.now\(\)|useProjectStore|fetch\(|axios/)
  })

  it('haengt nicht von einer Komponente ab', () => {
    // Eine Bibliothek, die aus `components/` importiert, dreht die
    // Abhaengigkeit um — und `RentmanEquipment` passt strukturell ohnehin.
    expect(quelle).not.toMatch(/from '\.\.\/components\//)
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Der Abgleich gehoert dorthin, wo die Reservierung schon auf
// dem Schirm ist -- ein eigener Dialog waere ein zweiter Ort fuer dieselbe
// Frage.
// ---------------------------------------------------------------------------
describe('Erreichbarkeit im Rentman-Dialog', () => {
  it('rechnet den Abgleich und zeigt ihn an', () => {
    expect(dialogQuelle).toMatch(/const erpReport = useMemo\(/)
    expect(dialogQuelle).toMatch(/reconcileErp\(/)
    expect(dialogQuelle).toMatch(/erpReport\.onlyInPlan/)
    expect(dialogQuelle).toMatch(/erpReport\.onlyInErp/)
    // Und die BEDINGUNG, unter der der Block erscheint. Ohne sie blieb die
    // Gegenprobe gruen, die `items.length > 0` durch `false` ersetzte: alle
    // gesuchten Zeichenketten standen weiter da, gerendert wurde nichts.
    expect(dialogQuelle).toContain('{items.length > 0 && erpReport.rows.length > 0 && (')
  })

  it('benutzt DENSELBEN Bedarfsbegriff wie die Stueckliste', () => {
    // Zwei Bedarfsbegriffe nebeneinander waeren zwei Wahrheiten. Der Aufruf
    // reicht Kabel und Geraete herein, wie in Bedarf 17 festgelegt.
    expect(dialogQuelle).toMatch(/deriveDemand\(\s*\n?\s*projectEquipment,/)
    expect(dialogQuelle).toMatch(/zusatzBedarf\(\{ drumKit, wirelessRig, cables: planCables, equipment: projectEquipment \}\)/)
  })

  it('nennt die nicht gezaehlten Zeilen', () => {
    expect(dialogQuelle).toContain('erpReport.ignored.length')
    expect(dictsQuelle).toContain("'rentman.diff.ignored'")
  })

  it('gibt das Blatt aus', () => {
    expect(dialogQuelle).toMatch(/csvFromTable\(erpReconcileTable\(erpReport\)\)/)
  })
})
