import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeEquipmentLayout } from '../src/renderer/lib/equipmentLayout'
import { EQUIPMENT_LAYOUT } from '../src/renderer/lib/layoutConstants'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Ein Geraet wird wieder schmal, wenn der lange Port-Name weggeht.
//
// NUTZER-MELDUNG 2026-09-11: „Wenn im Cable planner ein Gerät einen Port mit
// einem sehr langen Namen bekommt wird das Gerät sehr breit. Kürzt man dann
// den Namen, bleibt das Gerät breit. Es soll aber kürzer werden."
//
// GEMESSEN vor der Aenderung: Port „IN" -> 220 px; Port mit 37 Zeichen
// -> 671 px; Name zurueck auf „IN" -> immer noch 671 px.
//
// ─── WOGEGEN DIESER LAUF STEHT ────────────────────────────────────────────
//
// Nicht gegen das Wachsen — das ist gewollt und war nie kaputt. Gegen die
// EINBAHNSTRASSE: eine Groesse, die nur in eine Richtung geht. Sie faellt
// niemandem auf, der ein Geraet anlegt; sie faellt dem auf, der einen Tippfehler
// korrigiert und danach ein Geraet hat, das die halbe Flaeche belegt.
//
// Die Ursache war ein Feld mit zwei Bedeutungen. `eq.width` hiess im Renderer
// „so breit will es der Nutzer" (Untergrenze) und im Rueckschreiber von
// `CanvasArea` „so breit war es zuletzt" (Messwert). Weil die Messung per
// Konstruktion `max(gespeichert, intrinsisch)` ist, hat die zweite Bedeutung
// die erste aufgefressen. Es GIBT kein Nutzer-Ziehen an Geraeten —
// `NodeResizer` haengt nur am `LocationFrameNode` —, also war die
// Untergrenze von Anfang an eine Annahme ohne Deckung.
//
// ─── WAS ER NICHT KANN ────────────────────────────────────────────────────
//
// Er rechnet. Ob der Knoten im laufenden Fenster wirklich schmaler wird, misst
// `ui:overflow` an der gebauten App und der Mensch davor. Was er dafuer sicher
// sagt: die Formel kennt keinen Weg mehr, eine alte Breite festzuhalten.
// ───────────────────────────────────────────────────────────────────────────

const geraet = (portName: string, gespeichert?: { width?: number; height?: number }): EquipmentItem =>
  ({
    id: 'e1',
    name: 'Switcher',
    type: 'switcher',
    x: 0,
    y: 0,
    inputs: [{ id: 'p1', name: portName, connectorType: 'BNC' }],
    outputs: [],
    ...gespeichert,
  }) as unknown as EquipmentItem

const LANG = 'SEHR LANGER PORTNAME FUER DIE MESSUNG'

describe('die Breite folgt dem Namen in BEIDE Richtungen', () => {
  it('ein langer Port-Name macht das Geraet breiter', () => {
    // Die Gegenrichtung zuerst: waere das hier gleich, pruefte der Test
    // unten gegen zwei identische Zahlen und waere still gruen.
    const schmal = computeEquipmentLayout(geraet('IN')).width
    const breit = computeEquipmentLayout(geraet(LANG)).width
    expect(breit).toBeGreaterThan(schmal)
  })

  it('das Kuerzen macht es wieder schmal — auch mit alter Breite im Feld', () => {
    const schmal = computeEquipmentLayout(geraet('IN')).width
    const breit = computeEquipmentLayout(geraet(LANG)).width
    // Genau das schreibt `CanvasArea` nach dem Messen zurueck.
    const nachDemKuerzen = computeEquipmentLayout(geraet('IN', { width: breit })).width
    expect(nachDemKuerzen).toBe(schmal)
  })

  it('dasselbe fuer die Hoehe, wenn Ports verschwinden', () => {
    // Derselbe Fehler auf der anderen Achse: `eq.height` war ebenso
    // Untergrenze. Ports zu loeschen liess das Geraet hoch stehen.
    const vieleP = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `IN ${i}`, connectorType: 'BNC' }))
    const hoch = computeEquipmentLayout({ ...geraet('IN'), inputs: vieleP } as EquipmentItem).height
    const niedrig = computeEquipmentLayout(geraet('IN')).height
    expect(hoch).toBeGreaterThan(niedrig)
    expect(computeEquipmentLayout(geraet('IN', { height: hoch })).height).toBe(niedrig)
  })

  it('die Groesse rastet weiter aufs Raster ein', () => {
    // Die Aenderung nimmt `Math.max(...)` weg — nicht das `snapUp`. Faellt
    // das mit, sitzen Kabel-Enden neben ihren Handles (#501).
    for (const name of ['IN', LANG, 'Ein mittellanger Name']) {
      const { width, height } = computeEquipmentLayout(geraet(name))
      expect(width % EQUIPMENT_LAYOUT.GRID_SIZE, `Breite ${width} nicht auf dem Raster`).toBe(0)
      expect(height % EQUIPMENT_LAYOUT.GRID_SIZE, `Hoehe ${height} nicht auf dem Raster`).toBe(0)
    }
  })

  it('unter die Vorgabebreite faellt es nicht', () => {
    expect(computeEquipmentLayout(geraet('')).width).toBeGreaterThanOrEqual(
      EQUIPMENT_LAYOUT.DEFAULT_WIDTH,
    )
  })
})

describe('es gibt nur noch EINE Stelle, die entscheidet', () => {
  const lies = (p: string): string => readFileSync(resolve(__dirname, '..', p), 'utf8')
  const node = lies('src/renderer/components/Canvas/EquipmentNode.tsx')
  const layout = lies('src/renderer/lib/equipmentLayout.ts')

  /** Zeilenkommentare weg — der Rest ist, was laeuft. */
  const ohneKommentare = (t: string): string =>
    t
      .split('\n')
      .filter((z) => {
        const s = z.trimStart()
        return !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*')
      })
      .join('\n')

  it('weder Renderer noch Layout lesen die gespeicherte Groesse als Untergrenze', () => {
    // Der Kommentar in beiden Dateien NENNT die alte Form, weil er erklaert,
    // warum sie weg ist — ohne das Streichen faende diese Pruefung genau die
    // Erklaerung, gegen die sie geschrieben ist.
    for (const [name, datei] of Object.entries({ node, layout })) {
      const code = ohneKommentare(datei)
      expect(/Math\.max\(\s*snapUp\((data|eq)\.width/.test(code), `${name}: alte Untergrenze`).toBe(
        false,
      )
      expect(/Math\.max\(\s*snapUp\((data|eq)\.height/.test(code), `${name}: alte Untergrenze`).toBe(
        false,
      )
    }
  })

  it('Gegenprobe: die Begruendung steht weiterhin im Quelltext', () => {
    // Sonst haette das Streichen der Kommentare oben eine zweite Wirkung,
    // die keiner wollte: die Erklaerung koennte verschwinden und der Lauf
    // bliebe gruen. Die Zeile selbst sieht harmlos aus; erst der Grund
    // verhindert, dass jemand die Untergrenze „zur Sicherheit" zurueckbaut.
    // Die Begruendung lebt an EINER Stelle — dort, wo auch die Formel lebt.
    // `NodeResizer` ist das entscheidende Wort: es haengt nur am
    // `LocationFrameNode`, und deshalb war die Untergrenze eine Annahme ohne
    // Deckung.
    expect(layout).toContain('NodeResizer')
    // Der Renderer wiederholt sie nicht, sondern verweist — sonst stuenden
    // zwei Fassungen derselben Begruendung da, und eine davon veraltet.
    expect(node).toContain('lib/equipmentLayout.ts')
  })

  it('die gelesenen Dateien sind wirklich da', () => {
    for (const [name, inhalt] of Object.entries({ node, layout })) {
      expect(inhalt.length, `${name} ist leer`).toBeGreaterThan(1000)
    }
  })
})
