import { describe, expect, it } from 'vitest'
import {
  DECLARED_PROVENANCE,
  PROVENANCE_ORDER,
  provenanceOf,
  provenanceReason,
  type Provenance,
} from '../src/renderer/types/provenance'
import provenanceSrc from '../src/renderer/types/provenance.ts?raw'
import badgeSrc from '../src/renderer/components/shared/ProvenanceBadge.tsx?raw'
import equipmentTypesSrc from '../src/renderer/types/equipment.ts?raw'
import projectTypesSrc from '../src/renderer/types/project.ts?raw'
import rentmanDialogSrc from '../src/renderer/components/Rentman/RentmanCableExportDialog.tsx?raw'
import portsSectionSrc from '../src/renderer/components/Properties/sections/PortsSection.tsx?raw'

// ---------------------------------------------------------------------------
// ADR-003 Inkrement 2 — Provenienz als Vokabular, plus das geteilte Element.
//
// Der ADR hatte dieses Inkrement zurueckgestellt („eine Abstraktion auf
// Verdacht"), also wurden die Stellen vor dem Bau gemessen. Diese Tests halten
// zweierlei fest: dass die Deklarationen auf Felder zeigen, die es wirklich
// gibt (sonst kennzeichnet die Oberflaeche etwas, das nicht existiert), und
// dass das Element wirklich benutzt wird — die Lehre aus `changeImpact`, das
// ein Inkrement lang ohne Aufrufer dastand.
// ---------------------------------------------------------------------------

describe('das Vokabular', () => {
  it('kennt genau vier Herkuenfte, unsicher zuerst', () => {
    expect(Object.keys(PROVENANCE_ORDER).sort()).toEqual([
      'commanded',
      'confirmed',
      'planned',
      'unknown',
    ])
    expect(PROVENANCE_ORDER.unknown).toBeLessThan(PROVENANCE_ORDER.commanded)
    expect(PROVENANCE_ORDER.commanded).toBeLessThan(PROVENANCE_ORDER.confirmed)
  })

  it('behandelt `planned` als Normalfall, ohne es zu deklarieren', () => {
    // Wer nichts sagt, hat einen geplanten Wert. Jedes Feld einzeln als
    // `planned` einzutragen waere eine Liste, die nie vollstaendig bleibt.
    expect(provenanceOf('irgendein.feld')).toBe('planned')
    expect(provenanceReason('irgendein.feld')).toBeUndefined()
    expect(DECLARED_PROVENANCE.every((d) => d.provenance !== 'planned')).toBe(true)
  })

  it('gibt zu jeder Deklaration eine Begruendung', () => {
    // Eine Kennzeichnung ohne Grund ist im Tooltip wertlos — und der Grund
    // muss den Nutzer ueberzeugen, nicht den Autor.
    for (const d of DECLARED_PROVENANCE) {
      expect(d.reason.length, d.field).toBeGreaterThan(40)
      expect(provenanceReason(d.field)).toBe(d.reason)
    }
  })
})

describe('die Deklarationen zeigen auf Felder, die es gibt', () => {
  it('nennt fuer jedes deklarierte Feld eine reale Stelle im Modell', () => {
    // Der eigentliche Guard: laeuft ein Feld um oder faellt weg, kennzeichnet
    // die Oberflaeche sonst etwas, das nicht mehr existiert — und der Nutzer
    // sieht ein Badge ohne Wert oder gar nichts, wo eins hingehoerte.
    const sources: Record<string, string> = {
      'equipment.portsUnknown': equipmentTypesSrc,
      'metadata.rentmanCableMap.lastSentQty': projectTypesSrc,
    }
    for (const d of DECLARED_PROVENANCE) {
      const src = sources[d.field]
      expect(src, `keine Quelle fuer ${d.field} hinterlegt`).toBeDefined()
      const leaf = d.field.split('.').pop() as string
      expect(src, `${leaf} steht nicht im Modell`).toContain(`${leaf}?:`)
    }
  })
})

describe('das Element wird auch benutzt', () => {
  it('steht an beiden gemessenen Stellen', () => {
    // Die Lehre aus `changeImpact`: eine Ableitung ohne Aufrufer liefert
    // keinem Nutzer etwas, egal wie richtig sie ist.
    expect(rentmanDialogSrc).toContain('<ProvenanceBadge')
    expect(rentmanDialogSrc).toContain('metadata.rentmanCableMap.lastSentQty')
    expect(portsSectionSrc).toContain('<ProvenanceBadge')
    expect(portsSectionSrc).toContain('equipment.portsUnknown')
  })

  it('rendert bei `planned` nichts', () => {
    // Ein Badge an jedem Wert waere dasselbe wie an keinem.
    expect(badgeSrc).toContain("if (provenance === 'planned') return null")
  })
})

describe('der Zuschnitt bleibt der gemessene', () => {
  it('zieht die zweite Form ausdruecklich NICHT mit hinein', () => {
    // Gemessen wurden zwei Formen: „Wert mit Herkunft" (diese Datei) und
    // „Liste des Nichtbestimmbaren" (sourceMap.unresolved, changeImpact,
    // planDiff.unclassified — dreimal unabhaengig gebaut). Die zweite hier
    // einzusammeln waere genau die Abstraktion auf Verdacht, gegen die
    // ADR-003 das Inkrement zurueckgestellt hatte.
    expect(provenanceSrc).toContain('NUR fuer die erste Form')
    const declaredFields = DECLARED_PROVENANCE.map((d) => d.field)
    for (const fremd of ['unresolved', 'unclassified', 'documents']) {
      expect(declaredFields.some((f) => f.includes(fremd))).toBe(false)
    }
  })

  it('haelt die vier Werte des Typs und die Ordnung deckungsgleich', () => {
    // Ein fuenfter Wert im Typ ohne Eintrag in PROVENANCE_ORDER wuerde beim
    // Sortieren still zu `undefined` und damit zu NaN.
    const union = [...provenanceSrc.matchAll(/^\s{2}\| '(\w+)'$/gm)].map((m) => m[1])
    const fromType = [...new Set(union)].sort()
    expect(fromType).toEqual(Object.keys(PROVENANCE_ORDER).sort())
    for (const value of fromType) {
      expect(PROVENANCE_ORDER[value as Provenance]).toBeTypeOf('number')
    }
  })
})
