import { describe, expect, it } from 'vitest'
import { atemTally, type AtemStateSlice } from '../src/renderer/lib/atemTally'
import type { TallyMapRow } from '../src/renderer/lib/tallyMap'

// ───────────────────────────────────────────────────────────────────────────
// Vom Mischer-Zustand zur Tally-Anzeige.
//
// Der Mischer kennt Eingangsnummern, der Plan kennt Geräte. Die Brücke gibt
// es seit Initiative 2 (`buildTallyMap`) und wird hier BENUTZT, nicht neu
// gebaut — eine zweite Zuordnung ginge genau dann auseinander, wenn jemand
// umpatcht.
//
// Der gefährlichste Irrtum an einer Tally-Anzeige ist nicht „rot statt grün",
// sondern „gar nichts statt rot": eine Kamera, die der Mischer nicht kennt,
// darf nicht aussehen wie eine, von der bekannt ist, dass sie frei ist. Diese
// Datei liefert für sie deshalb KEINEN Eintrag — `tallyOf` macht daraus
// `null`, und die Anzeige lässt sie in Ruhe.
// ───────────────────────────────────────────────────────────────────────────

const row = (id: string, input: number | undefined, geraete = [id]): TallyMapRow => ({
  identityId: `rolle-${id}`,
  name: id.toUpperCase(),
  devices: geraete.map((g) => ({ id: g, name: g })),
  ...(input === undefined
    ? {}
    : { switcher: { equipmentId: 'atem', name: 'Mischer', input } }),
})

const state = (program?: number, preview?: number): AtemStateSlice => ({
  mixEffectStates: [{ index: 0, programInput: program, previewInput: preview }],
})

const JETZT = 5000

describe('ATEM → Tally', () => {
  it('meldet Program als rot und Preview als grün', () => {
    const t = atemTally(state(1, 2), [row('cam1', 1), row('cam2', 2)], JETZT)
    expect(t).toEqual([
      { equipmentId: 'cam1', state: 'program', at: JETZT, source: 'atem' },
      { equipmentId: 'cam2', state: 'preview', at: JETZT, source: 'atem' },
    ])
  })

  it('meldet NICHTS für eine Kamera, die auf keinem der beiden liegt', () => {
    // Kein `off`-Eintrag. Die Anzeige lässt sie in Ruhe, statt zu behaupten,
    // sie sei frei.
    const t = atemTally(state(1, 2), [row('cam1', 1), row('cam3', 3)], JETZT)
    expect(t.map((x) => x.equipmentId)).toEqual(['cam1'])
  })

  it('Program schlägt Preview, wenn dieselbe Quelle auf beidem steht', () => {
    // Üblich beim Vorbereiten eines Schnitts auf sich selbst. Ein grüner Ring
    // wäre hier die gefährlichere Hälfte der Wahrheit.
    const t = atemTally(state(1, 1), [row('cam1', 1)], JETZT)
    expect(t).toEqual([{ equipmentId: 'cam1', state: 'program', at: JETZT, source: 'atem' }])
  })

  it('nimmt beide Geräte einer Rolle — Haupt und Backup hängen am selben Eingang', () => {
    const t = atemTally(state(1), [row('rolle', 1, ['haupt', 'backup'])], JETZT)
    expect(t.map((x) => x.equipmentId).sort()).toEqual(['backup', 'haupt'])
    expect(t.every((x) => x.state === 'program')).toBe(true)
  })

  it('überspringt Rollen ohne Mischer-Anschluss', () => {
    expect(atemTally(state(1), [row('cam1', undefined)], JETZT)).toEqual([])
  })

  it('meldet nichts ohne Mischer-Zustand', () => {
    expect(atemTally(null, [row('cam1', 1)], JETZT)).toEqual([])
    expect(atemTally({}, [row('cam1', 1)], JETZT)).toEqual([])
    expect(atemTally({ mixEffectStates: [] }, [row('cam1', 1)], JETZT)).toEqual([])
  })

  it('nimmt nur Mix-Effect 1 und verodert nicht', () => {
    // Ein Mischer mit zwei ME hat zwei Programme. Beide zu verodern zeigte
    // eine Kamera rot, die auf keinem Ausspielweg liegt.
    const zwei: AtemStateSlice = {
      mixEffectStates: [
        { index: 0, programInput: 1 },
        { index: 1, programInput: 2 },
      ],
    }
    const t = atemTally(zwei, [row('cam1', 1), row('cam2', 2)], JETZT)
    expect(t.map((x) => x.equipmentId)).toEqual(['cam1'])
  })

  it('stempelt den Zeitpunkt, den der Aufrufer nennt', () => {
    // Die Rechnung bleibt rein; das Alter entscheidet spaeter ueber den
    // Rueckfall aufs Schema.
    expect(atemTally(state(1), [row('cam1', 1)], 12345)[0].at).toBe(12345)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Die Verdrahtung — an der Quelle geprüft, weil `vitest` hier nicht rendert.
//
// Die Zusicherung ist nicht „der Ring ist rot", sondern die Regel darunter:
// eine Beobachtung, die wir nicht mehr bekommen, wird nicht als letzter Stand
// weitergezeigt. Ein eingefrorener Mischer-Zustand sieht aus wie ein stabiler
// — und das ist die Falschaussage, gegen die der ganze Rückfall gebaut ist.
// ───────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const quelle = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8')

describe('Der Mischer-Einspeiser', () => {
  // Ohne Kommentare: der Kopfkommentar der Datei NENNT `verbindungWeg`, um zu
  // erklaeren, was sie tut. Ein Waechter, der Begruendungen mitliest, macht
  // die Begruendung zum Fehler — derselbe Griff daneben wie beim Live-Store.
  const feed = quelle('src/renderer/hooks/useAtemTallyFeed.ts')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  // Die Zusicherung ist „er wirft den Stand weg", nicht „er ruft
  // `verbindungWeg()` ohne Argument". Der erste Anlauf pinnte die leere
  // Klammer und wurde rot, als die Funktion ein Argument bekam (welche
  // Haelfte) — eine RICHTIGE Aenderung. Ein Waechter, der daran rot wird,
  // wird geaendert statt gelesen.
  it('wirft den Stand weg, sobald der Mischer nicht mehr verbunden ist', () => {
    expect(feed).toContain('if (!status.connected)')
    expect(feed).toMatch(/if \(!status\.connected\) \{\s*verbindungWeg\(/)
  })

  it('wirft den Stand auch bei einem Fehlschlag weg', () => {
    // Erreichbar heisst nicht antwortend.
    expect(feed).toMatch(/catch \{[\s\S]*verbindungWeg\(/)
  })

  it('raeumt dabei NUR seine eigene Haelfte', () => {
    // Ein toter Mischer ist kein toter Router. Das ist die Aussage, die das
    // Argument traegt — deshalb steht sie hier als eigene Zeile und nicht
    // als Klammerinhalt in den beiden darueber.
    expect(feed).toContain("verbindungWeg('tally')")
    expect(feed).not.toMatch(/verbindungWeg\(\)/)
  })

  it('stempelt jede Meldung mit der Zeit', () => {
    // Ohne Zeitstempel koennte die Rueckfall-Regel nicht greifen.
    expect(feed).toContain('Date.now()')
  })

  it('rechnet die Zuordnung aus dem Plan und fuehrt keine zweite Karte', () => {
    expect(feed).toContain('buildTallyMap')
  })

  it('laeuft nicht ohne Desktop-Bruecke', () => {
    expect(feed).toContain('if (!hasDesktopBridge) return')
  })
})

describe('Der Tally-Ring am Geraet', () => {
  const node = quelle('src/renderer/components/Canvas/EquipmentNode.tsx')

  it('faerbt nur bei bekanntem Zustand', () => {
    // Kein Zweig fuer `null`: was nicht gemeldet ist, bleibt ungefaerbt.
    expect(node).toContain("tally === 'program'")
    expect(node).toContain("tally === 'preview'")
    expect(node).not.toContain("tally === 'off'")
  })

  it('legt den Ring NEBEN die Rahmenfarbe, nicht darueber', () => {
    // Der Rahmen traegt Geraetefarbe und Auswahl; zwei Aussagen an einer
    // Stelle streiten sich.
    expect(node).toContain('boxShadow: [')
    expect(node).toMatch(/border: `1px solid \$\{selected \? '#38bdf8'/)
  })
})
