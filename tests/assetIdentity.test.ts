import { describe, expect, it } from 'vitest'
import {
  ASSET_FINDING_LABEL,
  IDENTITY_ANCHOR_LABEL,
  assessAssetIdentity,
  assetIdentityTable,
  identityAnchors,
  type AssetIdentityInput,
} from '../src/renderer/lib/assetIdentity'
import { INSTANCE_FIELDS } from '../src/renderer/lib/modelFields'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { InventoryUnit, InventoryItem } from '../src/renderer/types/inventory'
import type { CheckoutRecord } from '../src/renderer/types/checkout'
import sectionQuelle from '../src/renderer/components/Properties/sections/NetworkAccessSection.tsx?raw'
import analyseQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'
import diffQuelle from '../src/renderer/lib/planDiff.ts?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Welche KISTE steht im Plan-Platz (Bedarf 78, P2).
//
//   > The rental system knows serial numbers and barcodes; the IP plan knows
//   > hostnames and addresses. A last-minute substitution of one identical
//   > stagebox for another is invisible to both the IP plan and the Dante
//   > subscription set, and only surfaces as a fault during rehearsal.
//
// Zwei baugleiche Stageboxen sind im Plan dasselbe Kaestchen, im Lager zwei
// Einheiten und im NETZ zwei verschiedene Geraete — jede mit eigenem
// eingebranntem Namen und eigener MAC.
// ---------------------------------------------------------------------------

const zeit = '2026-09-06T10:00:00.000Z'

const geraet = (id: string, name: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name, x: 0, y: 0, inputs: [], outputs: [], ...over }) as never

const netz = (id: string, name: string, over: Partial<EquipmentItem> = {}) =>
  geraet(id, name, { ipAddress: '10.0.0.5', ...over })

const einheit = (id: string, serial: string, over: Partial<InventoryUnit> = {}): InventoryUnit =>
  ({
    id,
    itemId: 'sb',
    serial,
    condition: 'ok',
    history: [],
    createdAt: zeit,
    updatedAt: zeit,
    ...over,
  }) as never

const artikel: InventoryItem = { id: 'sb', model: 'Stagebox 32', quantity: 4 } as never

const schein = (unitIds: string[], geschlossen = false): CheckoutRecord =>
  ({
    id: 'co1',
    nodeId: 'case1',
    nodeLabel: 'Case 1',
    out: { at: zeit, by: 'Lars' },
    contents: unitIds.map((refId) => ({ kind: 'unit', refId, label: refId, quantity: 1 })),
    ...(geschlossen ? { in: { at: zeit, by: 'Lars' } } : {}),
  }) as never

const eingabe = (over: Partial<AssetIdentityInput> = {}): AssetIdentityInput => ({
  equipment: [],
  ...over,
})

// ---------------------------------------------------------------------------
describe('betroffen ist nur, wo eine NETZ-Identitaet haengt', () => {
  it('erkennt IP, MAC, Namen und PTP als Anker', () => {
    expect(identityAnchors(netz('a', 'Stagebox 1'))).toEqual(['ip', 'dante'])
    expect(identityAnchors(geraet('b', 'X', { macAddress: 'aa:bb' }))).toEqual(['mac', 'dante'])
    expect(
      identityAnchors(
        geraet('c', 'X', { networkInterfaces: [{ id: 'n1', role: 'media-primary', ptpDomain: 127 }] } as never),
      ),
    ).toEqual(['dante', 'ptp'])
  })

  it('sieht ein STATIV nicht als betroffen an', () => {
    // Ein Stativ hat keinen eingebrannten Geraete-Namen. Es in die Liste zu
    // nehmen hiesse, den halben Plan zu melden — und die echten Faelle
    // darunter zu begraben.
    expect(identityAnchors(geraet('s', 'Stativ'))).toEqual([])
    const a = assessAssetIdentity(eingabe({ equipment: [geraet('s', 'Stativ')] }))
    expect(a.hasAnchored).toBe(false)
    expect(a.findings).toEqual([])
  })

  it('zaehlt den GERAETE-Namen nur, wenn ueberhaupt eine Schnittstelle da ist', () => {
    // Sonst waere jedes benannte Objekt im Plan ein Anker.
    expect(identityAnchors(geraet('x', 'Kiste ohne Netz'))).toEqual([])
  })

  it('haelt die Etiketten kanonisch deutsch', () => {
    expect(IDENTITY_ANCHOR_LABEL.dante).toBe('Dante-/Geräte-Name')
    expect(ASSET_FINDING_LABEL['serial-mismatch']).toBe(
      'Seriennummer am Platz und an der Einheit gehen auseinander',
    )
  })
})

// ---------------------------------------------------------------------------
describe('der Fall aus dem Bedarf: niemand weiss, WELCHE Kiste', () => {
  it('meldet einen Platz mit Netz-Identitaet ohne benannte Einheit', () => {
    const a = assessAssetIdentity(eingabe({ equipment: [netz('e1', 'Stagebox 1')] }))
    const f = a.findings.find((x) => x.kind === 'unit-unnamed')!
    expect(f).toBeDefined()
    expect(f.equipmentId).toBe('e1')
  })

  it('NENNT DIE FOLGE, nicht nur die Luecke', () => {
    // „Feld leer" bewegt niemanden. „Der eingebrannte Name wandert mit, und
    // die Abonnements zeigen ins Leere" schon.
    const a = assessAssetIdentity(eingabe({ equipment: [netz('e1', 'Stagebox 1')] }))
    const f = a.findings.find((x) => x.kind === 'unit-unnamed')!
    expect(f.text).toMatch(/eingebrannte/)
    expect(f.text).toMatch(/Abonnements/)
  })

  it('schweigt, sobald eine Einheit benannt ist', () => {
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'Stagebox 1', { inventoryUnitId: 'u1' })],
        units: [einheit('u1', 'SN-1')],
      }),
    )
    expect(a.findings).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('wo zwei Aufzeichnungen einander widersprechen', () => {
  it('FAENGT DEN TAUSCH an den beiden Seriennummern', () => {
    // Jemand hat die neue Nummer am Platz eingetragen und den Zeiger auf die
    // alte Einheit stehen lassen (oder umgekehrt). Eine von beiden ist von
    // einem Tausch uebrig.
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'Stagebox 1', { inventoryUnitId: 'u1', serialNumber: 'SN-2' })],
        units: [einheit('u1', 'SN-1')],
      }),
    )
    const f = a.findings.find((x) => x.kind === 'serial-mismatch')!
    expect(f).toBeDefined()
    expect(f.text).toContain('SN-1')
    expect(f.text).toContain('SN-2')
  })

  it('BEHAUPTET NICHT, welche der beiden stimmt', () => {
    // Der Plan weiss nicht, was im Rack steht. Ein Widerspruch zwischen zwei
    // Listen laesst sich am Schreibtisch aufloesen; eine Behauptung ueber die
    // Wirklichkeit muesste jemand pruefen gehen.
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'Stagebox 1', { inventoryUnitId: 'u1', serialNumber: 'SN-2' })],
        units: [einheit('u1', 'SN-1')],
      }),
    )
    const f = a.findings.find((x) => x.kind === 'serial-mismatch')!
    expect(f.text).toMatch(/welche stimmt, sagt der Plan nicht/)
  })

  it('vergleicht Seriennummern, wie ein Mensch sie tippt', () => {
    // Bindestrich und Leerzeichen sind Tippgewohnheit, kein Unterschied.
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'S', { inventoryUnitId: 'u1', serialNumber: ' sn 1 ' })],
        units: [einheit('u1', 'SN-1')],
      }),
    )
    expect(a.findings.filter((f) => f.kind === 'serial-mismatch')).toEqual([])
  })

  it('meldet nichts, solange nur EINE der beiden Nummern da ist', () => {
    // Nichts zu vergleichen ist kein Widerspruch.
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'S', { inventoryUnitId: 'u1' })],
        units: [einheit('u1', 'SN-1')],
      }),
    )
    expect(a.findings).toEqual([])
  })

  it('meldet EINE Einheit in ZWEI Plaetzen — einmal, nicht zweimal', () => {
    const a = assessAssetIdentity(
      eingabe({
        equipment: [
          netz('e1', 'Stagebox 1', { inventoryUnitId: 'u1' }),
          netz('e2', 'Stagebox 2', { inventoryUnitId: 'u1' }),
        ],
        units: [einheit('u1', 'SN-1')],
      }),
    )
    const doppelt = a.findings.filter((f) => f.kind === 'unit-double')
    expect(doppelt).toHaveLength(1)
    expect(doppelt[0].text).toContain('Stagebox 1')
    expect(doppelt[0].text).toContain('Stagebox 2')
  })

  it('leert einen Zeiger ins Nichts NICHT still, sondern meldet ihn', () => {
    const a = assessAssetIdentity(
      eingabe({ equipment: [netz('e1', 'S', { inventoryUnitId: 'weg' })], units: [] }),
    )
    const f = a.findings.find((x) => x.kind === 'unit-missing')!
    expect(f).toBeDefined()
    expect(f.text).toMatch(/anderen Lagerdatenbank/)
    // Und die Zeile traegt die Einheit weiter — sie ist eine Auskunft.
    expect(a.rows[0].unitId).toBe('weg')
  })
})

// ---------------------------------------------------------------------------
describe('was das Lager dazu sagt', () => {
  it('meldet eine Einheit, die nicht einsatzbereit ist — mit Modell', () => {
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'Stagebox 1', { inventoryUnitId: 'u1' })],
        units: [einheit('u1', 'SN-1', { condition: 'inRepair' })],
        items: [artikel],
      }),
    )
    const f = a.findings.find((x) => x.kind === 'unit-blocked')!
    expect(f).toBeDefined()
    expect(f.text).toContain('Stagebox 32')
    expect(f.text).toContain('inRepair')
  })

  it('meldet eine Einheit, die auf keinem offenen Schein steht', () => {
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'Stagebox 1', { inventoryUnitId: 'u1' })],
        units: [einheit('u1', 'SN-1')],
        checkouts: [schein(['u2'])],
      }),
    )
    expect(a.findings.some((f) => f.kind === 'unit-not-issued')).toBe(true)
  })

  it('schweigt, wenn die Einheit auf dem offenen Schein steht', () => {
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'Stagebox 1', { inventoryUnitId: 'u1' })],
        units: [einheit('u1', 'SN-1')],
        checkouts: [schein(['u1'])],
      }),
    )
    expect(a.findings).toEqual([])
  })

  it('zaehlt einen GESCHLOSSENEN Vorgang nicht als Ausgabe', () => {
    // Was zurueck ist, faehrt nicht mit.
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'Stagebox 1', { inventoryUnitId: 'u1' })],
        units: [einheit('u1', 'SN-1')],
        checkouts: [schein(['u1'], true), schein(['u2'])],
      }),
    )
    expect(a.findings.some((f) => f.kind === 'unit-not-issued')).toBe(true)
  })

  it('prueft die Ausgabe GAR NICHT, wenn es keinen offenen Vorgang gibt', () => {
    // Ohne Lagerbetrieb waere das eine Warnung fuer jeden Platz — und damit
    // eine Warnung fuer niemanden.
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'Stagebox 1', { inventoryUnitId: 'u1' })],
        units: [einheit('u1', 'SN-1')],
        checkouts: [schein(['u2'], true)],
      }),
    )
    expect(a.findings).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('das Blatt, mit dem jemand vor dem Rack steht', () => {
  it('traegt BEIDE Seriennummern — sonst kann man nicht vergleichen', () => {
    const a = assessAssetIdentity(
      eingabe({
        equipment: [netz('e1', 'Stagebox 1', { inventoryUnitId: 'u1', serialNumber: 'SN-2' })],
        units: [einheit('u1', 'SN-1')],
      }),
    )
    const t = assetIdentityTable(a)
    expect(t.headers).toEqual([
      'Platz',
      'Anker',
      'Einheit',
      'Serie (Einheit)',
      'Serie (Platz)',
      'Befund',
    ])
    expect(t.rows[0][3]).toBe('SN-1')
    expect(t.rows[0][4]).toBe('SN-2')
    expect(t.rows[0][5]).toContain('Seriennummer')
  })

  it('schreibt „nicht benannt" statt einer leeren Zelle', () => {
    const t = assetIdentityTable(assessAssetIdentity(eingabe({ equipment: [netz('e1', 'S')] })))
    expect(t.rows[0][2]).toBe('nicht benannt')
  })

  it('fuehrt keine Zeile fuer Plaetze ohne Anker', () => {
    const t = assetIdentityTable(
      assessAssetIdentity(eingabe({ equipment: [netz('e1', 'S'), geraet('s', 'Stativ')] })),
    )
    expect(t.rows).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
describe('Erreichbarkeit und Einordnung des neuen Feldes', () => {
  it('ist eine INSTANZ-Eigenschaft, nicht eine des Modells', () => {
    // In einem Template getragen zeigten zwei Plaetze auf dieselbe Kiste --
    // genau der Befund `unit-double`, nur diesmal vom Werkzeug erzeugt.
    expect(INSTANCE_FIELDS as readonly string[]).toContain('inventoryUnitId')
  })

  it('ist im Plan-Diff SUBSTANTIELL, nicht kosmetisch', () => {
    // Wer sie aendert, hat getauscht. Ein Diff, der das schluckt, verschweigt
    // genau die Aenderung, deretwegen das Feld existiert.
    expect(diffQuelle).toContain("inventoryUnitId: 'substantive'")
  })

  it('steht als Auswahl neben der Seriennummer — und nur bei Anker', () => {
    expect(sectionQuelle).toContain('const anchors = identityAnchors(equipment)')
    expect(sectionQuelle).toMatch(/\{anchors\.length > 0 && \(/)
    expect(sectionQuelle).toMatch(
      /updateEquipment\(equipment\.id, \{\n\s*inventoryUnitId: event\.target\.value \|\| undefined,\n\s*\}\)/,
    )
  })

  it('sagt an der leeren Auswahl, warum sie zaehlt', () => {
    expect(sectionQuelle).toMatch(/\{!equipment\.inventoryUnitId && \(/)
    expect(sectionQuelle).toContain("t(\n                  'eq.field.unitHint',")
  })

  it('steht als Befundliste im Netzwerk-Reiter der Analyse', () => {
    expect(analyseQuelle).toContain('assessAssetIdentity({')
    expect(analyseQuelle).toContain('{asset.hasAnchored && (')
    // Die BEDINGUNG und das Etikett zusammen, nicht das Etikett allein: eine
    // Gegenprobe, die nur den Wahrheitswert des `&&` umlegt, liess das
    // Etikett im Quelltext stehen — die Liste wurde nie gerendert und nichts
    // wurde rot.
    expect(analyseQuelle).toMatch(
      /\{asset\.findings\.length > 0 && \([\s\S]{0,400}ASSET_FINDING_LABEL\[f\.kind\]/,
    )
  })

  it('LIEST Bestand und Scheine nur, statt sie ins Projekt zu kopieren', () => {
    // Dieselbe Kiste faehrt auf mehreren Shows; sie ins Projektfile zu
    // kopieren waere eine zweite Wahrheit ueber den Lagerbestand.
    expect(analyseQuelle).toContain('const invUnits = useInventoryStore((st) => st.units)')
    expect(analyseQuelle).toContain('const checkouts = useCheckoutStore((st) => st.records)')
    expect(analyseQuelle).not.toContain('setInventory')
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of [
      'analysis.asset.title',
      'analysis.asset.intro',
      'analysis.asset.export',
      'analysis.asset.none',
      'eq.field.unit',
      'eq.field.unitNone',
      'eq.field.unitHint',
    ]) {
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
