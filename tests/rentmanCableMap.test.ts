import { describe, expect, it } from 'vitest'
import type { CablePlannerProject } from '../src/renderer/types/project'
import { withSentQty, type RentmanCableMap } from '../src/renderer/lib/rentmanCableMap'
import dialogSrc from '../src/renderer/components/Rentman/RentmanCableExportDialog.tsx?raw'

// ADR-003 (Bestaetigter Zustand statt gesendeter Befehl), Inkrement 1.
//
// Der Zaehler hinter der Spalte "Bereits gesendet" hiess `lastSyncedQty` und
// wurde beim Import mit der im Dialog editierbaren *Planmenge* vorbelegt. Beides
// zusammen behauptete eine Abstimmung mit Rentman, die nie stattgefunden hat.
// Getestet wird deshalb genau das, was ein Projektfile ueberlebt: dass der alte
// Schluessel uebernommen und entsorgt wird und der Wert dabei nicht kippt.

const project = (
  map: Record<string, unknown> | undefined,
): CablePlannerProject =>
  ({
    metadata: {
      name: 'T',
      description: '',
      createdAt: '',
      updatedAt: '',
      ...(map ? { rentmanCableMap: map } : {}),
    },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

const loadAndRead = async (map: Record<string, unknown> | undefined) => {
  const { useProjectStore } = await import('../src/renderer/store/projectStore')
  useProjectStore.getState().loadProject(project(map))
  return useProjectStore.getState().project.metadata.rentmanCableMap
}

describe('rentmanCableMap — Migration lastSyncedQty -> lastSentQty (ADR-003)', () => {
  it('uebernimmt den alten Schluessel und entsorgt ihn', async () => {
    const healed = await loadAndRead({
      'BNC|10': { rentmanEquipmentId: 'r1', lastSyncedQty: 12 },
    })
    expect(healed?.['BNC|10']).toEqual({ rentmanEquipmentId: 'r1', lastSentQty: 12 })
    expect('lastSyncedQty' in (healed?.['BNC|10'] ?? {})).toBe(false)
  })

  it('laesst einen bereits neuen Eintrag unveraendert', async () => {
    const healed = await loadAndRead({
      'BNC|10': { rentmanEquipmentId: 'r1', lastSentQty: 7 },
    })
    expect(healed?.['BNC|10']).toEqual({ rentmanEquipmentId: 'r1', lastSentQty: 7 })
  })

  it('behaelt den neuen Wert, wenn ein Projekt beide traegt', async () => {
    // Kann nur entstehen, wenn eine neuere Version geschrieben und eine
    // aeltere danach nichts mehr angefasst hat — der neue Wert ist der
    // juengere.
    const healed = await loadAndRead({
      'BNC|10': { rentmanEquipmentId: 'r1', lastSentQty: 7, lastSyncedQty: 12 },
    })
    expect(healed?.['BNC|10']).toEqual({ rentmanEquipmentId: 'r1', lastSentQty: 7 })
  })

  it('haelt eine Zuordnung ohne Menge mengenlos statt sie auf 0 zu setzen', async () => {
    // 0 hiesse "nichts gesendet" und wuerde die naechste Differenz auf die
    // volle Menge stellen. Kein Wert heisst "unbekannt" — der Export-Dialog
    // faellt selbst auf 0 zurueck, aber das Projektfile behauptet es nicht.
    const healed = await loadAndRead({ 'BNC|10': { rentmanEquipmentId: 'r1' } })
    expect(healed?.['BNC|10']).toEqual({ rentmanEquipmentId: 'r1' })
  })

  it('wirft kaputte Eintraege weg, statt am Load zu scheitern', async () => {
    const healed = await loadAndRead({
      'BNC|10': null,
      'BNC|20': { rentmanEquipmentId: 'r2', lastSyncedQty: Number.NaN },
    })
    expect(healed?.['BNC|10']).toBeUndefined()
    expect(healed?.['BNC|20']).toEqual({ rentmanEquipmentId: 'r2' })
  })

  it('laesst ein Projekt ohne Zuordnung in Ruhe', async () => {
    expect(await loadAndRead(undefined)).toBeUndefined()
  })
})

describe('rentmanCableMap — die Migration verwirft nichts Fremdes (ADR-005)', () => {
  // Die Migration baute jeden Eintrag aus den zwei Schluesseln neu auf, die sie
  // kennt. Solange es nur diese zwei gab, war das folgenlos — deshalb stand der
  // Befund im Audit als "kosmetisch". Mit `mergedEquipmentIds` gibt es einen
  // dritten, und damit wird aus der Kosmetik ein Datenverlust: es genuegt EIN
  // altes Projektfile mit `lastSyncedQty`, damit `changed` greift und der
  // Neuaufbau die Zusammenfassung mitnimmt.

  it('haelt mergedEquipmentIds, waehrend es den alten Mengen-Schluessel migriert', async () => {
    const healed = await loadAndRead({
      'BNC|10': {
        rentmanEquipmentId: 'r1',
        lastSyncedQty: 12,
        mergedEquipmentIds: ['r1', 'r2'],
      },
    })
    expect(healed?.['BNC|10']).toEqual({
      rentmanEquipmentId: 'r1',
      lastSentQty: 12,
      mergedEquipmentIds: ['r1', 'r2'],
    })
  })

  it('haelt auch einen Schluessel, den diese Version noch gar nicht kennt', async () => {
    // Der eigentliche Punkt: die Regel gilt nicht nur fuer das Feld, das wir
    // gerade hinzufuegen. Ein aelterer Build, der eine neuere Datei laedt,
    // darf sie nicht beschneiden.
    const healed = await loadAndRead({
      'BNC|10': { rentmanEquipmentId: 'r1', lastSyncedQty: 3, zukunftsFeld: { tief: [1] } },
    })
    expect(healed?.['BNC|10']).toEqual({
      rentmanEquipmentId: 'r1',
      lastSentQty: 3,
      zukunftsFeld: { tief: [1] },
    })
  })

  it('entsorgt den alten Mengen-Schluessel trotzdem', async () => {
    // Bewahren heisst nicht alles behalten: der migrierte Schluessel muss weg,
    // sonst traegt die Datei zwei Wahrheiten ueber dieselbe Menge.
    const healed = await loadAndRead({
      'BNC|10': { rentmanEquipmentId: 'r1', lastSyncedQty: 12, mergedEquipmentIds: ['r1', 'r2'] },
    })
    expect('lastSyncedQty' in (healed?.['BNC|10'] ?? {})).toBe(false)
  })

  it('haelt mergedEquipmentIds auch dann, wenn gar keine Menge da ist', async () => {
    const healed = await loadAndRead({
      'BNC|10': { rentmanEquipmentId: 'r1', mergedEquipmentIds: ['r1', 'r2'], lastSyncedQty: 'kaputt' },
    })
    expect(healed?.['BNC|10']).toEqual({
      rentmanEquipmentId: 'r1',
      mergedEquipmentIds: ['r1', 'r2'],
    })
  })
})

// ───────────────────────────────────────────────────────────────────────────
// ADR-005, Inkrement 4 — „Alle senden" buchte doppelt.
//
// Bis hierher ging es um die Migration des Zaehlers (ADR-003). Ab hier um das
// Fortschreiben: der Export-Dialog schrieb die Karte in einer Schleife und las
// jede Runde `project.metadata.rentmanCableMap` aus der Render-Closure. Die
// aendert sich waehrend der Schleife nicht, also schrieb Runde 2
// `{ ...alteKarte, [key2]: … }` und loeschte den Zaehler aus Runde 1.
//
// Folge: nach „Alle senden" ueber N Eimer stand nur der LETZTE `lastSentQty`
// in der Datei. Die uebrigen behielten ihren alten Zaehler, ihr Delta blieb
// positiv, und der naechste Versand buchte dieselbe Menge ein zweites Mal
// nach Rentman — reale Kabel auf einem realen Lieferschein.
//
// Der Kommentar im Dialog behauptete das Gegenteil: „updates project metadata
// after each push so the next iteration sees the fresh sentQty value."
// ───────────────────────────────────────────────────────────────────────────

const base: RentmanCableMap = {
  'BNC|10': { rentmanEquipmentId: 'rm-1', lastSentQty: 4 },
  'BNC|20': { rentmanEquipmentId: 'rm-2', lastSentQty: 0 },
  'XLR|5': { rentmanEquipmentId: 'rm-3', lastSentQty: 2 },
}

describe('withSentQty — Fortschreibung der Rentman-Kabel-Zuordnung', () => {
  it('haelt ALLE Eimer, wenn nacheinander gesendet wird', () => {
    // Die Schleife aus sendAll: das Ergebnis der vorigen Runde ist die
    // Eingabe der naechsten. Genau das tat der Dialog vorher NICHT.
    let acc: RentmanCableMap | undefined = base
    acc = withSentQty(acc, 'BNC|10', 'rm-1', 12)
    acc = withSentQty(acc, 'BNC|20', 'rm-2', 7)
    acc = withSentQty(acc, 'XLR|5', 'rm-3', 9)

    expect(acc['BNC|10'].lastSentQty).toBe(12)
    expect(acc['BNC|20'].lastSentQty).toBe(7)
    expect(acc['XLR|5'].lastSentQty).toBe(9)
  })

  it('zeigt, was der Fehler war: gegen einen festen Stand ueberlebt nur der letzte', () => {
    // Kein Test der Funktion, sondern des Missbrauchs — er haelt fest, WARUM
    // der Rueckgabewert durchgereicht werden muss. Faellt dieser Test, ist
    // die Fortschreibung nicht mehr abhaengig von der Eingabe, und der erste
    // Test oben ist wertlos geworden.
    const a = withSentQty(base, 'BNC|10', 'rm-1', 12)
    const b = withSentQty(base, 'BNC|20', 'rm-2', 7) // wieder von `base`!

    expect(a['BNC|10'].lastSentQty).toBe(12)
    expect(b['BNC|20'].lastSentQty).toBe(7)
    // ... aber b kennt die 12 nicht mehr: der Zaehler aus Runde 1 ist weg,
    // das Delta bleibt positiv, Rentman bucht doppelt.
    expect(b['BNC|10'].lastSentQty).toBe(4)
  })

  it('schreibt den Eintrag fort statt ihn neu zu bauen (Regel 1)', () => {
    // mergedEquipmentIds ist der Hinweis darauf, dass mehrere
    // Rentman-Stammartikel in denselben Eimer gefallen sind. Wer den
    // Eintrag neu baut, loescht ihn — und zwar genau beim Senden, wo er
    // am ehesten gebraucht wird.
    const withMerged: RentmanCableMap = {
      'BNC|10': {
        rentmanEquipmentId: 'rm-1',
        lastSentQty: 4,
        mergedEquipmentIds: ['rm-9', 'rm-8'],
      },
    }
    const out = withSentQty(withMerged, 'BNC|10', 'rm-1', 12)
    expect(out['BNC|10'].mergedEquipmentIds).toEqual(['rm-9', 'rm-8'])
    expect(out['BNC|10'].lastSentQty).toBe(12)
  })

  it('legt einen unbekannten Eimer an, ohne die uebrigen anzufassen', () => {
    const out = withSentQty(base, 'CAT|30', 'rm-neu', 3)
    expect(out['CAT|30']).toEqual({ rentmanEquipmentId: 'rm-neu', lastSentQty: 3 })
    expect(out['BNC|10']).toEqual(base['BNC|10'])
    expect(Object.keys(out).sort()).toEqual(['BNC|10', 'BNC|20', 'CAT|30', 'XLR|5'])
  })

  it('kommt mit einer noch leeren Karte klar', () => {
    expect(withSentQty(undefined, 'BNC|10', 'rm-1', 5)).toEqual({
      'BNC|10': { rentmanEquipmentId: 'rm-1', lastSentQty: 5 },
    })
  })

  it('fasst die Eingabe nicht an', () => {
    const before = JSON.stringify(base)
    withSentQty(base, 'BNC|10', 'rm-1', 99)
    expect(JSON.stringify(base)).toBe(before)
  })
})

describe('der Dialog reicht die Karte durch, statt sie neu zu lesen', () => {
  // OFFEN GESAGT: die Tests oben pruefen den neuen Helfer — der existierte am
  // alten Stand nicht, sie koennen den Fehler also nicht gefangen haben. Der
  // Fehler sass im AUFRUFMUSTER des Dialogs, und das ist eine React-Komponente;
  // diese Suite deckt bewusst nur Logik ab (vitest.config.ts). Bleibt der Weg,
  // den auch mobileShareWriteBack.test.ts geht: die Form im Quelltext festnageln.
  //
  // Das ist schwaecher als ein Verhaltenstest und soll nicht so aussehen. Es
  // faengt genau eine Sache — dass jemand die Schleife wieder gegen einen
  // festen Ausgangsstand laufen laesst — und die war der ganze Fehler.

  it('sendAll faedelt das Ergebnis jeder Runde in die naechste', () => {
    const sendAll = dialogSrc.slice(dialogSrc.indexOf('const sendAll'))
    const body = sendAll.slice(0, sendAll.indexOf('\n  }'))
    // Der Rueckgabewert muss zurueck in den Akkumulator, sonst ist die
    // Schleife wieder zustandslos.
    expect(body).toMatch(/acc\s*=\s*await\s+sendBucket\(bucket,\s*acc\)/)
  })

  it('sendBucket liest ohne Akkumulator frisch aus dem Store, nicht aus der Closure', () => {
    // `project` in der Closure kann zwischen Render und Klick veraltet sein.
    const send = dialogSrc.slice(dialogSrc.indexOf('const sendBucket'))
    const body = send.slice(0, send.indexOf('\n  /**'))
    expect(body).toContain('baseMap ?? useProjectStore.getState().project.metadata.rentmanCableMap')
    expect(body).not.toContain('project.metadata.rentmanCableMap ?? {}')
  })

  it('der alte, falsche Kommentar steht nicht mehr da', () => {
    expect(dialogSrc).not.toContain('sees the fresh sentQty value.\n      await sendBucket(bucket)')
  })
})
