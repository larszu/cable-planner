import { describe, expect, it } from 'vitest'
import { deriveLabels, roleLabelsByPort } from '../src/renderer/lib/labelDerivation'
import {
  buildVideohubLabelTxt,
  buildVideohubRoutingDump,
} from '../src/renderer/lib/exportVideohub'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { SourceIdentity } from '../src/renderer/types/sourceIdentity'

// ───────────────────────────────────────────────────────────────────────────
// B-28 — die Rolle besitzt die Mischer- und Router-Labels.
//
// GEMESSENER AUSGANGSZUSTAND (2026-09-04, Runde 10). Ein Umbenennen der
// `SourceIdentity` aenderte den UMD-Text, die `.avsourcemap` und die
// Tally-CSV -- aber NICHT den ATEM-Lang-/Kurznamen und NICHT die
// Videohub-Labels. Beide hingen allein am Portnamen
// (`AtemDialog.tsx:132`, `exportVideohub.ts:76/163`).
//
// Warum ausgerechnet diese zwei: es sind die Systeme, in die der Name sonst
// von Hand getippt wird. Initiative 1 heisst "Rename kostet eine Aenderung";
// solange sie nicht an der Rolle hingen, kostete es drei. Die
// Bedarfs-Datenbank nennt es achtmal aus acht Berufen (P1 #5, #9): "Stop
// typing camera identity into six to eight systems."
//
// WAS DIESE DATEI PRUEFT, IST NICHT "der Name steht drin", sondern: EIN
// Umbenennen erreicht ALLE Ausgabewege -- Ableitung, Labels.txt und
// Protokoll-Dump. Ein Test je Weg waere derselbe Test dreimal; der
// Unterschied liegt darin, dass sie GEMEINSAM aus einer Aufloesung kommen.
// ───────────────────────────────────────────────────────────────────────────

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

const cable = (from: [string, string], to: [string, string]): Cable => ({
  id: `${from[1]}->${to[1]}`,
  name: `${from[1]}->${to[1]}`,
  type: 'BNC',
  length: 10,
  color: '#fff',
  fromEquipmentId: from[0],
  fromPortId: from[1],
  toEquipmentId: to[0],
  toPortId: to[1],
  notes: '',
})

/**
 * Kamera → Videohub In 1 → (Kreuzpunkt) → Videohub Out 1 → ATEM In 1.
 *
 * Bewusst MIT Router dazwischen: die Kette, um die es geht, ist nicht die
 * direkt verkabelte. Ohne gesetzten Kreuzpunkt haelt die Rueckwaertssuche am
 * Router an -- der letzte Fall unten haengt genau daran.
 */
const szenario = (opts: { rolle?: string; kreuzpunkt?: boolean } = {}) => {
  const { rolle = 'Kamera 1', kreuzpunkt = true } = opts

  const identity: SourceIdentity = { id: 'role-1', name: rolle }
  const kamera = eq({
    id: 'cam1',
    name: 'URSA Broadcast G2',
    category: 'Kameras',
    sourceIdentityId: 'role-1',
    outputs: [port('cam1-out', 'SDI Out')],
  })
  const videohub = eq({
    id: 'vh',
    name: 'Smart Videohub 12x12',
    inputs: [port('vh-in1', 'In 1', { contentLabel: 'Tippfehler' })],
    outputs: [port('vh-out1', 'Out 1')],
    ...(kreuzpunkt ? { videohubRouting: { planned: { 0: 0 } } } : {}),
  })
  const atem = eq({
    id: 'atem',
    name: 'ATEM Mini Extreme',
    inputs: [port('atem-in1', 'In 1', { contentLabel: 'Von Hand getippt' })],
  })

  return {
    equipment: [kamera, videohub, atem],
    cables: [
      cable(['cam1', 'cam1-out'], ['vh', 'vh-in1']),
      cable(['vh', 'vh-out1'], ['atem', 'atem-in1']),
    ],
    sourceIdentities: [identity],
    videohub,
  }
}

describe('roleLabelsByPort', () => {
  it('bindet den ATEM-Eingang an die Rolle — durch den Router hindurch', () => {
    const { equipment, cables, sourceIdentities } = szenario()
    const karte = roleLabelsByPort(equipment, cables, sourceIdentities)

    expect(karte.get('atem-in1')).toBe('Kamera 1')
    expect(karte.get('vh-in1')).toBe('Kamera 1')
  })

  it('laesst Ausgaenge aus — dort traegt der Kreuzpunkt das Ziel, nicht das Kabel', () => {
    const { equipment, cables, sourceIdentities } = szenario()
    const karte = roleLabelsByPort(equipment, cables, sourceIdentities)

    expect(karte.has('vh-out1')).toBe(false)
  })

  it('ohne gesetzten Kreuzpunkt endet die Kette am Router — der ATEM-Eingang bleibt ohne Rolle', () => {
    const { equipment, cables, sourceIdentities } = szenario({ kreuzpunkt: false })
    const karte = roleLabelsByPort(equipment, cables, sourceIdentities)

    // Der Router-Eingang kennt die Kamera weiterhin; der Mischer-Eingang
    // nicht. Geraten wird hier nichts -- ein Router mit 12 Eingaengen hat 12
    // gleich plausible Antworten.
    expect(karte.get('vh-in1')).toBe('Kamera 1')
    expect(karte.has('atem-in1')).toBe(false)
  })

  it('ein Geraet ohne gebundene Rolle taucht nicht auf', () => {
    const { equipment, cables } = szenario()
    const karte = roleLabelsByPort(equipment, cables, [])

    expect(karte.size).toBe(0)
  })
})

describe('Ein Umbenennen erreicht alle drei Ausgabewege', () => {
  const textFuer = (targetId: string, rolle: string): string[] => {
    const { equipment, cables, sourceIdentities } = szenario({ rolle })
    return deriveLabels({ equipment, cables, sourceIdentities })
      .candidates.filter((c) => c.targetId === targetId)
      .map((c) => c.raw)
  }

  it('ATEM-Langname folgt der Rolle statt dem von Hand getippten Portnamen', () => {
    expect(textFuer('atem-input-long', 'Kamera 1')).toEqual(['Kamera 1'])
    expect(textFuer('atem-input-long', 'Moderation')).toEqual(['Moderation'])
  })

  it('ATEM-Kurzname folgt mit', () => {
    // `raw` ist der Wunschtext VOR dem Zuschnitt aufs Zielbudget -- der
    // 4-Zeichen-Schnitt passiert erst in `fitToTarget`. Geprueft wird hier
    // also, dass der Kurzname aus der ROLLE gebildet wird und nicht aus dem
    // Portnamen; wie kurz er danach wird, ist Sache des Zielsystems.
    expect(textFuer('atem-input-short', 'Kamera 1')).toEqual(['KAMERA1'])
    expect(textFuer('atem-input-short', 'Moderation')).toEqual(['MODERATION'])
  })

  it('Videohub-Eingangslabel folgt, das Ausgangslabel nicht', () => {
    const { equipment, cables, sourceIdentities } = szenario()
    const vh = deriveLabels({ equipment, cables, sourceIdentities }).candidates.filter(
      (c) => c.targetId === 'videohub-label',
    )

    expect(vh.find((c) => c.key === 'videohub-in:vh-in1')?.raw).toBe('Kamera 1')
    expect(vh.find((c) => c.key === 'videohub-out:vh-out1')?.raw).toBe('Out 1')
  })

  it('die Herkunft sagt es auch — sonst sieht der Nutzer den Vorrang nicht', () => {
    const { equipment, cables, sourceIdentities } = szenario()
    const long = deriveLabels({ equipment, cables, sourceIdentities }).candidates.find(
      (c) => c.targetId === 'atem-input-long',
    )

    expect(long?.provenance).toBe('source-identity')
    expect(long?.sourceText).toBe('Kamera 1')
  })

  it('Labels.txt und Protokoll-Dump tragen dieselbe Rolle', () => {
    const { equipment, cables, sourceIdentities, videohub } = szenario()
    const roleLabels = roleLabelsByPort(equipment, cables, sourceIdentities)

    const txt = buildVideohubLabelTxt(videohub, { roleLabels })
    const dump = buildVideohubRoutingDump(videohub, { roleLabels })

    expect(txt).toContain('Input, 1, 1 Kamera 1')
    expect(dump).toContain('0 1 Kamera 1')
    // Der Ausgang bleibt beim Portnamen -- in beiden Formaten.
    expect(txt).toContain('Output, 1, 1 Out 1')
    expect(dump).toContain('OUTPUT LABELS:')
  })

  it('ohne Karte verhalten sich beide Exporter exakt wie vorher', () => {
    const { videohub } = szenario()

    // Gegenprobe zur Zeile darueber: die Rolle darf nicht auf einem anderen
    // Weg hereinkommen. Ohne `roleLabels` gewinnt weiterhin `contentLabel`.
    expect(buildVideohubLabelTxt(videohub)).toContain('Input, 1, 1 Tippfehler')
    expect(buildVideohubRoutingDump(videohub)).toContain('0 1 Tippfehler')
  })
})

describe('Die Ableitung und die Exporter lesen dieselbe Aufloesung', () => {
  // WARUM DIESER TEST DER WICHTIGSTE IST. Die TREUE-REGEL am Kopf von
  // `labelDerivation.ts` verlangt, dass ein Kandidat nur behauptet, was der
  // Exporter WIRKLICH sendet. Ein Vorrang, den die Ableitung kennt und der
  // Exporter nicht, meldete Kollisionen auf Texten, die nie ein Geraet
  // erreichen -- und das ist schwerer zu bemerken als ein fehlender Name,
  // weil der Plan-Check dann gruen luegt statt still zu bleiben.
  it('derselbe Text im Kandidaten wie in der Labels.txt', () => {
    const { equipment, cables, sourceIdentities, videohub } = szenario({ rolle: 'Weitwinkel' })
    const roleLabels = roleLabelsByPort(equipment, cables, sourceIdentities)

    const ausAbleitung = deriveLabels({ equipment, cables, sourceIdentities }).candidates.find(
      (c) => c.key === 'videohub-in:vh-in1',
    )?.raw
    const ausExport = buildVideohubLabelTxt(videohub, { roleLabels })
      .split('\r\n')[0]
      .replace('Input, 1, 1 ', '')

    expect(ausAbleitung).toBe('Weitwinkel')
    expect(ausExport).toBe(ausAbleitung)
  })
})
