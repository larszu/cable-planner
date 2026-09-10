import { describe, expect, it } from 'vitest'
import { ALL_CONNECTOR_TYPES } from '../src/renderer/types/equipment'
import { DEFAULT_CONNECTOR_TYPE_COLORS } from '../src/renderer/lib/cableColors'
import { detectLayerForConnector } from '../src/renderer/lib/cableLayers'
import {
  balanceForConnector,
  connectorsAreDirectlyMating,
  connectorsShareFamily,
} from '../src/renderer/types/cableSpec'
import {
  LEGACY_CONNECTOR_RENAMES,
  heileSteckertyp,
} from '../src/renderer/lib/connectorRenames'
import { CONNECTOR_CATALOG } from '../src/renderer/lib/connectorCatalog'
import type { ConnectorType } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// #832 — „Und auch klinke aufteilen in Mono (trs) Trrs usw. Und 3,5mm und
// 6,3mm usw." (Meldung des Eigentümers, 2026-09-10)
//
// GEMESSEN, bevor gebaut wurde: es gab die Klinke ZWEIMAL im Repo, in zwei
// getrennten Sprachen, und keine der beiden nannte die Größe.
//
//   `Klinke`                         die Eigenschaften-Leiste (Union-Wert)
//   `TS Jack` / `TRS Jack` /
//   `Mini Jack`                      der Patchblenden-Dialog (freie Strings
//                                    aus `connectorCatalog.ts`)
//
// Dieselbe Buchse, zwei Werte — und weder Farb-Legende noch Kabel-Abgleich
// noch Stückliste brachten sie zusammen.
// ---------------------------------------------------------------------------

const KLINKEN = ALL_CONNECTOR_TYPES.filter((c) => c.startsWith('Jack '))

describe('Die Klinken-Familie', () => {
  it('trennt Größe UND Beschaltung', () => {
    // Keines der beiden Merkmale reicht allein: die Größe entscheidet, ob der
    // Stecker hineinpasst, die Beschaltung, was ankommt.
    expect(KLINKEN).toContain('Jack 6.35 mm TS')
    expect(KLINKEN).toContain('Jack 6.35 mm TRS')
    expect(KLINKEN).toContain('Jack 3.5 mm TS')
    expect(KLINKEN).toContain('Jack 3.5 mm TRS')
    expect(KLINKEN).toContain('Jack 3.5 mm TRRS')
    expect(KLINKEN).toContain('Jack 2.5 mm TRS')
  })

  it('kennt den Zustand „Größe bekannt, Beschaltung nicht"', () => {
    // Genau darin sind die Datenblatt-Angaben der Kataloge: „Line Out (6.3mm)"
    // nennt die Größe und schweigt zur Beschaltung.
    expect(KLINKEN).toContain('Jack 6.35 mm')
    expect(KLINKEN).toContain('Jack 3.5 mm')
  })

  it('behält den generischen Wert `Klinke`', () => {
    // DIE WICHTIGSTE ZUSICHERUNG DIESER DATEI. Ein bestehender Plan mit
    // `Klinke` sagt „hier sitzt eine Klinke, und niemand hat gesagt, welche".
    // Ihn auf einen Untertyp zu heben wäre geraten — und die Angabe sähe
    // danach aus, als hätte jemand nachgesehen.
    expect(ALL_CONNECTOR_TYPES).toContain('Klinke')
    expect(LEGACY_CONNECTOR_RENAMES.Klinke).toBeUndefined()
    expect(heileSteckertyp('Klinke')).toBe('Klinke')
  })

  it('hat für jeden Untertyp eine Farbe', () => {
    // `Record<ConnectorType, string>` erzwingt das beim Übersetzen; diese
    // Zusicherung fängt den Fall, dass jemand den Record auf `Partial` dreht.
    for (const k of KLINKEN) {
      expect(DEFAULT_CONNECTOR_TYPE_COLORS[k], k).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('Die Untertypen sind in den Regeln angekommen', () => {
  it('liegen alle auf der Audio-Ebene', () => {
    // Ohne diese Zeile fielen sie in `other` — also in eine Ebene, in der
    // niemand ein Audiokabel sucht.
    for (const k of [...KLINKEN, 'Klinke' as ConnectorType]) {
      expect(detectLayerForConnector(k), k).toBe('audio')
    }
  })

  it('gleiche Größe steckt zusammen', () => {
    // Ein TS-Stecker geht in eine TRS-Buchse; der Ring liegt dann auf Masse.
    expect(connectorsAreDirectlyMating('Jack 6.35 mm TS', 'Jack 6.35 mm TRS')).toBe(true)
    expect(connectorsAreDirectlyMating('Jack 3.5 mm TS', 'Jack 3.5 mm TRRS')).toBe(true)
  })

  it('unterschiedliche Größe steckt NICHT zusammen', () => {
    // DIE GEGENPROBE, und der Grund für die Aufteilung. 3,5 mm passt nicht in
    // 6,3 mm — ein Werkzeug, das das durchgehen lässt, meldet eine Verbindung,
    // die im Aufbau nicht zusammengeht.
    expect(connectorsAreDirectlyMating('Jack 3.5 mm TRS', 'Jack 6.35 mm TRS')).toBe(false)
    expect(connectorsAreDirectlyMating('Jack 2.5 mm TRS', 'Jack 3.5 mm TRS')).toBe(false)
  })

  it('der generische Wert steckt mit KEINEM Untertyp direkt zusammen', () => {
    // Er sagt nicht, welche Größe gemeint ist. Ihn mit einer bestimmten
    // zusammenzustecken hieße zu raten, welche.
    for (const k of KLINKEN) {
      expect(connectorsAreDirectlyMating('Klinke', k), k).toBe(false)
    }
  })

  it('aber alle sind EINE Familie — es gibt einen Adapter', () => {
    expect(connectorsShareFamily('Jack 3.5 mm TRS', 'Jack 6.35 mm TRS')).toBe(true)
    expect(connectorsShareFamily('Klinke', 'Jack 6.35 mm TS')).toBe(true)
    expect(connectorsShareFamily('Jack 6.35 mm TS', 'XLR')).toBe(false)
  })
})

describe('Symmetrie — nur was aus der Beschaltung FOLGT', () => {
  it('TS ist unsymmetrisch, und das ist eindeutig', () => {
    expect(balanceForConnector('Jack 6.35 mm TS')).toBe('unbalanced')
    expect(balanceForConnector('Jack 3.5 mm TS')).toBe('unbalanced')
  })

  it('TRS und TRRS bleiben ohne Antwort', () => {
    // DIE GEGENPROBE gegen die naheliegende Vereinfachung. TRS ist am
    // Line-Ausgang symmetrisch und an der Kopfhörerbuchse Stereo-unsymmetrisch
    // — der Stecker sagt es nicht. Wer TRS pauschal als symmetrisch führt,
    // meldet an jeder Kopfhörerbuchse einen Symmetrie-Bruch, der keiner ist,
    // und nach dem dritten Fehlalarm liest niemand mehr die echten.
    expect(balanceForConnector('Jack 6.35 mm TRS')).toBeUndefined()
    expect(balanceForConnector('Jack 3.5 mm TRS')).toBeUndefined()
    expect(balanceForConnector('Jack 3.5 mm TRRS')).toBeUndefined()
  })

  it('und der generische Wert erst recht nicht', () => {
    expect(balanceForConnector('Klinke')).toBeUndefined()
    expect(balanceForConnector('Jack 6.35 mm')).toBeUndefined()
  })
})

describe('Die zweite Klinken-Sprache ist verschwunden', () => {
  it('der Stecker-Katalog benutzt die Union-Werte', () => {
    const ids = CONNECTOR_CATALOG.map((e) => e.id)
    expect(ids).not.toContain('TS Jack')
    expect(ids).not.toContain('TRS Jack')
    expect(ids).not.toContain('Mini Jack')
    expect(ids).toContain('Jack 6.35 mm TS')
    expect(ids).toContain('Jack 3.5 mm TRS')
  })

  it('und die alten Ids werden migriert', () => {
    expect(heileSteckertyp('TS Jack')).toBe('Jack 6.35 mm TS')
    expect(heileSteckertyp('TRS Jack')).toBe('Jack 6.35 mm TRS')
    // `Mini Jack` stand mit `poles: 3` und `mini: true` im Katalog — 3,5 mm
    // TRS folgt daraus, es ist keine Annahme.
    expect(heileSteckertyp('Mini Jack')).toBe('Jack 3.5 mm TRS')
  })

  it('jede Umbenennung zeigt auf einen Wert, den es wirklich gibt', () => {
    // Dieselbe Gegenprobe wie bei den Kategorien: eine Umbenennung ins Leere
    // schriebe bestehende Pläne auf einen toten Wert um — und sähe danach wie
    // eine gepflegte Zuordnung aus.
    const gueltig = new Set<string>(ALL_CONNECTOR_TYPES)
    for (const [alt, neu] of Object.entries(LEGACY_CONNECTOR_RENAMES)) {
      expect(gueltig.has(neu), `${alt} -> ${neu}`).toBe(true)
      expect(alt).not.toBe(neu)
    }
  })

  it('lässt einen eigenen Steckertyp des Nutzers in Ruhe', () => {
    // Ein Wert, den niemand kennt, ist eine Angabe und keine Einladung, ihn
    // zu ersetzen.
    expect(heileSteckertyp('Speakon NL4')).toBe('Speakon NL4')
    expect(heileSteckertyp(undefined)).toBeUndefined()
  })
})

describe('Kein Katalog rät eine Größe dazu', () => {
  it('nur Ports, deren NAME die Größe nennt, haben einen Untertyp', () => {
    // Die Grenze dieser Änderung, ausdrücklich festgehalten. „Line Out
    // (6.3mm)" nennt die Größe — das ist die Angabe des Datenblatts und keine
    // Annahme. „Phones" nennt sie nicht und bleibt deshalb `Klinke`, auch
    // wenn jeder weiß, was dort meist sitzt. Die Quellenlage der Presets ist
    // Aufgabe #111 und nicht dieser Änderung.
    const proben: [string, RegExp][] = [
      ['src/renderer/lib/wirelessAudioCatalog.ts', /'Monitor Phones', type: 'Klinke'/],
      ['src/renderer/lib/switcherCatalog.ts', /'Phones', type: 'Klinke'/],
    ]
    for (const [datei, muster] of proben) {
      const quelle = require('node:fs').readFileSync(datei, 'utf8')
      expect(quelle, datei).toMatch(muster)
    }
  })
})
