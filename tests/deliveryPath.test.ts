import { describe, expect, it } from 'vitest'
import {
  buildDeliveryChains,
  chainFindingText,
  deliveryPathTable,
} from '../src/renderer/lib/deliveryPath'
import { DEFAULT_ENCODING, type DeliveryDestination } from '../src/renderer/types/delivery'
import { DOCUMENT_STANDS, DOCUMENT_LABELS } from '../src/renderer/lib/documentRegistry'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import dialogQuelle from '../src/renderer/components/Delivery/DeliveryDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'
import pfadQuelle from '../src/renderer/lib/deliveryPath.ts?raw'

// ---------------------------------------------------------------------------
// Der Ausspielweg (Bedarf 32).
//
//   > The transmission chain modelled as first-class signal flow (encoder,
//   > transport, destination, backup) rather than a note on the last node.
//   > Signal-flow diagrams stop at the encoder input.
//
// Bis hierher hatte `DeliveryDestination` keinen einzigen Zeiger in den Plan:
// das Ziel-Register war das zweite Dokument, das der Bedarf beklagt -- nur in
// unserer eigenen Anwendung. Geprueft wird deshalb, dass der Weg ABGELEITET
// wird (aus Kabeln, nicht aus einem zweiten Feld), dass er anhaelt statt zu
// raten, und dass „weiss ich nicht" als Befund herauskommt und nicht als
// leere Zelle, die wie „in Ordnung" aussieht.
// ---------------------------------------------------------------------------

const port = (id: string, name: string, over: Partial<Port> = {}): Port => ({
  id,
  name,
  type: 'BNC',
  connectorType: 'BNC',
  ...over,
})

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Gerät',
  category: 'Video',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const cable = (from: [string, string], to: [string, string], id = `${from[1]}->${to[1]}`): Cable => ({
  id,
  name: id,
  type: 'BNC',
  length: 10,
  color: '#fff',
  fromEquipmentId: from[0],
  fromPortId: from[1],
  toEquipmentId: to[0],
  toPortId: to[1],
  notes: '',
})

const ziel = (name: string, over: Partial<DeliveryDestination> = {}): DeliveryDestination => ({
  id: `id-${name}`,
  name,
  platform: 'custom',
  transport: 'RTMP',
  ingestUrl: 'rtmp://example.test/live',
  hasStreamKey: true,
  encoding: { ...DEFAULT_ENCODING },
  ...over,
})

/** Mischer -> Encoder, der uebliche Aufbau. */
const aufbau = () => {
  const mischer = eq({
    id: 'atem',
    name: 'ATEM Mini Extreme',
    outputs: [port('atem-pgm', 'Programm SDI')],
  })
  const encoder = eq({
    id: 'enc',
    name: 'Streaming-PC',
    category: 'Sonstiges',
    inputs: [port('enc-in', 'SDI In')],
  })
  return {
    equipment: [mischer, encoder],
    cables: [cable(['atem', 'atem-pgm'], ['enc', 'enc-in'])],
  }
}

describe('die Kette entsteht aus dem Plan, nicht aus einem zweiten Feld', () => {
  it('nennt Quelle, Encoder, Transport und Ziel', () => {
    const [c] = buildDeliveryChains({
      ...aufbau(),
      deliveryDestinations: [ziel('YouTube', { encoderEquipmentId: 'enc' })],
    })
    expect(c.encoder?.name).toBe('Streaming-PC')
    expect(c.feedPort?.name).toBe('SDI In')
    expect(c.source?.name).toBe('ATEM Mini Extreme')
    expect(c.findings).toEqual([])
  })

  it('laeuft durch einen Konverter hindurch bis zur echten Quelle', () => {
    // Dieselbe Rueckwaertssuche wie die Label-Ableitung (ADR-001): ein
    // Durchleiter mit genau EINEM passenden Eingang ist keine Quelle.
    const mischer = eq({ id: 'atem', name: 'Mischer', outputs: [port('atem-pgm', 'Programm')] })
    const konverter = eq({
      id: 'conv',
      name: 'SDI/HDMI-Konverter',
      inputs: [port('conv-in', 'SDI In')],
      outputs: [port('conv-out', 'SDI Out')],
    })
    const encoder = eq({ id: 'enc', name: 'Encoder', inputs: [port('enc-in', 'SDI In')] })
    const chains = buildDeliveryChains({
      equipment: [mischer, konverter, encoder],
      cables: [
        cable(['atem', 'atem-pgm'], ['conv', 'conv-in']),
        cable(['conv', 'conv-out'], ['enc', 'enc-in']),
      ],
      deliveryDestinations: [ziel('YouTube', { encoderEquipmentId: 'enc' })],
    })
    expect(chains[0].source?.name).toBe('Mischer')
    expect(chains[0].source?.hops).toBeGreaterThan(0)
  })

  it('ohne Ziele gibt es keine Ketten', () => {
    expect(buildDeliveryChains({ ...aufbau(), deliveryDestinations: [] })).toEqual([])
  })
})

describe('was der Plan nicht sagt, wird nicht erfunden', () => {
  it('meldet ein Ziel ohne benanntes Geraet als Befund, nicht als leere Zelle', () => {
    const [c] = buildDeliveryChains({
      ...aufbau(),
      deliveryDestinations: [ziel('YouTube')],
    })
    expect(c.findings.map((f) => f.kind)).toEqual(['no-encoder'])
    expect(c.encoder).toBeUndefined()
  })

  it('meldet einen Zeiger auf ein geloeschtes Geraet, statt ihn still zu leeren', () => {
    // Ein stillschweigend geleertes Feld sieht aus wie „nie ausgefuellt".
    // Dann sucht niemand nach dem Geraet, das jemand geloescht hat.
    const [c] = buildDeliveryChains({
      ...aufbau(),
      deliveryDestinations: [ziel('YouTube', { encoderEquipmentId: 'weg' })],
    })
    expect(c.findings.map((f) => f.kind)).toEqual(['encoder-gone'])
  })

  it('haelt bei mehreren verkabelten Programm-Eingaengen an und nennt sie', () => {
    // Welcher der beiden das Programm fuehrt, ist eine Einsatz-Entscheidung.
    // Die falsche Antwort landet auf einem Blatt und wird am Showtag geglaubt.
    const mischer = eq({
      id: 'atem',
      name: 'Mischer',
      outputs: [port('atem-a', 'Programm'), port('atem-b', 'Aux')],
    })
    const encoder = eq({
      id: 'enc',
      name: 'Encoder',
      inputs: [port('enc-1', 'SDI 1'), port('enc-2', 'SDI 2')],
    })
    const [c] = buildDeliveryChains({
      equipment: [mischer, encoder],
      cables: [
        cable(['atem', 'atem-a'], ['enc', 'enc-1']),
        cable(['atem', 'atem-b'], ['enc', 'enc-2']),
      ],
      deliveryDestinations: [ziel('YouTube', { encoderEquipmentId: 'enc' })],
    })
    const f = c.findings.find((x) => x.kind === 'feed-ambiguous')
    expect(f?.values).toEqual(['SDI 1', 'SDI 2'])
    expect(c.source).toBeUndefined()
  })

  it('meldet einen Encoder ohne Kabel am Programm-Eingang', () => {
    const encoder = eq({ id: 'enc', name: 'Encoder', inputs: [port('enc-in', 'SDI In')] })
    const [c] = buildDeliveryChains({
      equipment: [encoder],
      cables: [],
      deliveryDestinations: [ziel('YouTube', { encoderEquipmentId: 'enc' })],
    })
    expect(c.findings.map((f) => f.kind)).toEqual(['encoder-unfed'])
  })

  it('zaehlt einen Referenz-/Steuer-Anschluss NICHT als Speisung', () => {
    // Ein Kabel am Intercom-Anschluss macht den Encoder nicht gespeist. Die
    // Abgrenzung kommt aus `labelDerivation.isReferencePort` -- eine zweite
    // Liste liefe auseinander, und dann meldete diese Kette „alles gut", weil
    // am Talkback ein Kabel haengt.
    const pult = eq({ id: 'pult', name: 'Sprechstelle', outputs: [port('pult-out', 'Intercom')] })
    const encoder = eq({
      id: 'enc',
      name: 'Encoder',
      inputs: [port('enc-in', 'SDI In'), port('enc-com', 'Intercom In')],
    })
    const [c] = buildDeliveryChains({
      equipment: [pult, encoder],
      cables: [cable(['pult', 'pult-out'], ['enc', 'enc-com'])],
      deliveryDestinations: [ziel('YouTube', { encoderEquipmentId: 'enc' })],
    })
    expect(c.findings.map((f) => f.kind)).toEqual(['encoder-unfed'])
  })
})

describe('der Ausweichweg, der keiner ist', () => {
  it('meldet ein Backup auf demselben Geraet wie sein Primaerweg', () => {
    // „nobody's thought about what happens when something fails" -- ein
    // Backup auf demselben Blech ist derselbe Weg mit zwei Zielen.
    const chains = buildDeliveryChains({
      ...aufbau(),
      deliveryDestinations: [
        ziel('Haupt', { encoderEquipmentId: 'enc' }),
        ziel('Backup', { backupOfId: 'id-Haupt', encoderEquipmentId: 'enc' }),
      ],
    })
    expect(chains[0].findings.map((f) => f.kind)).toEqual([])
    const b = chains[1]
    expect(b.role).toBe('backup')
    expect(b.backupOfName).toBe('Haupt')
    expect(b.findings.map((f) => f.kind)).toContain('backup-shares-encoder')
  })

  it('schweigt, wenn das Backup auf einem zweiten Geraet laeuft', () => {
    const basis = aufbau()
    const zweiter = eq({ id: 'enc2', name: 'Encoder 2', inputs: [port('enc2-in', 'SDI In')] })
    const chains = buildDeliveryChains({
      equipment: [...basis.equipment, zweiter],
      cables: [...basis.cables, cable(['atem', 'atem-pgm'], ['enc2', 'enc2-in'], 'zweit')],
      deliveryDestinations: [
        ziel('Haupt', { encoderEquipmentId: 'enc' }),
        ziel('Backup', { backupOfId: 'id-Haupt', encoderEquipmentId: 'enc2' }),
      ],
    })
    expect(chains[1].findings.map((f) => f.kind)).not.toContain('backup-shares-encoder')
  })
})

describe('das Blatt', () => {
  it('traegt den Befund im Klartext statt einer leeren Spalte', () => {
    const t = deliveryPathTable({
      ...aufbau(),
      deliveryDestinations: [ziel('YouTube')],
    })
    const befundSpalte = t.headers.indexOf('Befund')
    expect(String(t.rows[0][befundSpalte])).toContain('Kein Encoder')
  })

  it('laesst die Zwischenstationen LEER statt 0, wenn es keine Quelle gibt', () => {
    // Eine 0 laese sich als „direkt verkabelt" lesen. Das waere eine Aussage,
    // die niemand geprueft hat.
    const t = deliveryPathTable({
      ...aufbau(),
      deliveryDestinations: [ziel('YouTube')],
    })
    expect(t.rows[0][t.headers.indexOf('Zwischenstationen')]).toBe('')
  })

  it('traegt weder Stream-Key noch Ingest-URL', () => {
    // Ein Blatt ueber den Signalweg braucht kein Geheimnis. Die Ingest-URL
    // steht auf dem Ablaufblatt; hier waere sie nur eine zweite Kopie.
    const t = deliveryPathTable({
      ...aufbau(),
      deliveryDestinations: [ziel('YouTube', { encoderEquipmentId: 'enc' })],
    })
    const alles = JSON.stringify(t)
    expect(alles).not.toContain('rtmp://')
    expect(alles).not.toContain('stream-key')
  })

  it('nennt die Rolle, damit klar ist, was der Ausweichweg ist', () => {
    const t = deliveryPathTable({
      ...aufbau(),
      deliveryDestinations: [
        ziel('Haupt', { encoderEquipmentId: 'enc' }),
        ziel('Backup', { backupOfId: 'id-Haupt' }),
      ],
    })
    const rolle = t.headers.indexOf('Rolle')
    expect(t.rows[0][rolle]).toBe('Primaerweg')
    expect(String(t.rows[1][rolle])).toContain('Backup von Haupt')
  })
})

describe('der Befundtext auf dem Blatt bleibt kanonisch deutsch', () => {
  it('haengt an keiner Uebersetzung', () => {
    // Dieselbe Regel wie bei `deliveryIssueText`: der Stand des Blattes wird
    // aus seinem Inhalt gerechnet. Uebersetzt haette dasselbe Projekt in zwei
    // Sprachen zwei Staende, und jeder Abgleich meldete es als veraltet.
    expect(pfadQuelle).not.toContain("from './i18n")
    expect(chainFindingText({ kind: 'no-encoder' })).toBe('Kein Encoder im Plan benannt')
  })
})

describe('das Blatt hat einen Stand', () => {
  it('ist im Register gefuehrt und wird aus dem Plan gerechnet', () => {
    expect(DOCUMENT_STANDS.ausspielweg).toBeTypeOf('function')
    expect(DOCUMENT_LABELS.ausspielweg).toBeTruthy()
  })

  it('aendert sich, wenn sich der Weg aendert', () => {
    // Ein Stand, der einen Encoder-Wechsel nicht bemerkt, meldet ein
    // ueberholtes Blatt als aktuell.
    const basis = { metadata: { name: 'P' }, ...aufbau() } as never
    const ohne = DOCUMENT_STANDS.ausspielweg({
      ...(basis as object),
      deliveryDestinations: [ziel('YouTube')],
    } as never)
    const mit = DOCUMENT_STANDS.ausspielweg({
      ...(basis as object),
      deliveryDestinations: [ziel('YouTube', { encoderEquipmentId: 'enc' })],
    } as never)
    expect(ohne).not.toBe(mit)
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Der wiederkehrende Fehler in diesem Projekt ist nicht der
// falsche Rechenweg, sondern das gebaute Modul, das kein Knopf aufruft.
// ---------------------------------------------------------------------------
describe('Erreichbarkeit im Ausspiel-Dialog', () => {
  it('laesst den Encoder im Plan benennen', () => {
    expect(dialogQuelle).toContain('encoderEquipmentId: e.target.value || undefined')
    expect(dialogQuelle).toContain('encoderChoices.map(')
  })

  it('zeigt die Kette und ihre Befunde', () => {
    expect(dialogQuelle).toContain("from '../../lib/deliveryPath'")
    expect(dialogQuelle).toContain('buildDeliveryChains(project)')
    expect(dialogQuelle).toMatch(/chain\.findings\.map\(/)
    expect(dialogQuelle).toContain('chainLine(chain)')
  })

  it('bietet das Blatt mit Stempel zum Ausgeben an', () => {
    expect(dialogQuelle).toMatch(/onClick=\{exportPath\}/)
    expect(dialogQuelle).toContain('stampForRows(project, deliveryPathTable')
  })

  it('setzt die Befundtexte NICHT dynamisch zusammen', () => {
    // Ein zusammengesetzter Schluessel ist fuer den i18n-Deckungs-Guard
    // unsichtbar und faellt im EN-Betrieb still auf den nackten Slug zurueck.
    expect(dialogQuelle).not.toMatch(/t\(`delivery\.chain\./)
    for (const key of [
      'delivery.chain.noEncoder',
      'delivery.chain.encoderGone',
      'delivery.chain.encoderUnfed',
      'delivery.chain.feedAmbiguous',
      'delivery.chain.backupSharesEncoder',
      'delivery.path.title',
      'delivery.path.encoder',
      'delivery.path.noEncoder',
      'delivery.encoder.onDevice',
    ]) {
      expect(dialogQuelle).toContain(`'${key}'`)
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
