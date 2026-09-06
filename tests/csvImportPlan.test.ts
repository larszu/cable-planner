import { describe, expect, it } from 'vitest'
import { carriedNotes, mapHeader, planCsvImport } from '../src/renderer/lib/csvImportPlan'
import { parseCsv } from '../src/renderer/lib/csvParse'
import dialogQuelle from '../src/renderer/components/Import/CsvImportDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Kein stiller Verlust beim Import (Bedarf 29, P1).
//
//   > Silent data loss on import/export must be impossible -- the columns the
//   > production office added are the ones that vanish. […] Loss is discovered
//   > by whoever needed the column, when they needed it.
//
// Der CSV-Import hatte drei stille Verluste: unbekannte Spalten fielen weg,
// namenlose Zeilen wurden ungezaehlt uebersprungen, und die Erfolgsmeldung
// zaehlte uebersprungene (weil vorhandene) Namen als „hinzugefuegt".
//
// Geprueft wird deshalb nicht, dass der Import funktioniert -- das tat er --,
// sondern dass er SAGT, was er nicht mitnimmt, und dass die Zahlen stimmen.
// ---------------------------------------------------------------------------

const csv = (text: string) => parseCsv(text)

describe('was nicht erkannt wird, hat einen Namen', () => {
  it('nennt jede Spalte, die auf kein Feld zeigt', () => {
    const { unmapped } = mapHeader(['Name', 'Kategorie', 'Verantwortlich', 'Kundennotiz'])
    expect(unmapped.map((c) => c.header)).toEqual(['Verantwortlich', 'Kundennotiz'])
  })

  it('nennt die zweite Spalte auf dasselbe Feld, statt sie zu verschlucken', () => {
    // Zwei „Name"-Spalten sind ein echter Fall (Export aus zwei Systemen
    // zusammengeklebt). Die erste gewinnt -- aber die zweite darf nicht
    // wortlos verschwinden.
    const { mapping, duplicates } = mapHeader(['Name', 'Bezeichnung'])
    expect(mapping.name).toBe(0)
    expect(duplicates).toEqual([{ index: 1, header: 'Bezeichnung', field: 'name' }])
  })

  it('gibt einer Spalte ohne Ueberschrift ihre Nummer', () => {
    // Sonst stuende in der Notiz „: Wert" und niemand faende die Spalte wieder.
    expect(carriedNotes(['x'], [{ index: 0, header: '' }])).toBe('Spalte 1: x')
  })
})

describe('was nicht erkannt wird, geht trotzdem nicht verloren', () => {
  it('traegt unbekannte Spalten mit ihrer Ueberschrift in die Notizen', () => {
    const plan = planCsvImport(
      csv('Name;Verantwortlich;Kundennotiz\nATEM;Lars;bitte vorher testen'),
      [],
      'Importiert',
    )
    expect(plan.fresh[0].notes).toBe('Verantwortlich: Lars\nKundennotiz: bitte vorher testen')
  })

  it('traegt AUCH die verlorene Doppelspalte in die Notizen', () => {
    // Die Oberflaeche sagt „wird zur Notiz". Sie darf das nur sagen, wenn es
    // hier auch passiert -- sonst waere der Hinweis schlimmer als keiner.
    const plan = planCsvImport(csv('Name;Bezeichnung\nATEM;ATEM Mini Extreme'), [], 'Importiert')
    expect(plan.carried.map((c) => c.header)).toEqual(['Bezeichnung'])
    expect(plan.fresh[0].notes).toBe('Bezeichnung: ATEM Mini Extreme')
  })

  it('haelt die Notiz-Zeilen in DATEIREIHENFOLGE', () => {
    // `[...unmapped, ...duplicates]` unsortiert saehe fuer den Leser wie eine
    // andere Datei aus als die, die er geschickt hat.
    const plan = planCsvImport(
      csv('Bezeichnung;Name;Verantwortlich\nATEM Mini;ATEM;Lars'),
      [],
      'Importiert',
    )
    // „Bezeichnung" ist selbst ein Name-Alias und steht VORNE, gewinnt also
    // das Feld; die spaetere Spalte „Name" wird zur Notiz. Genau daran haengt
    // die Reihenfolge-Zusage: Notiz-Zeile 1 kommt aus Spalte 2, nicht aus der
    // Reihenfolge „erst unmapped, dann duplicates".
    expect(plan.fresh[0].name).toBe('ATEM Mini')
    expect(plan.fresh[0].notes).toBe('Name: ATEM\nVerantwortlich: Lars')
  })

  it('schreibt keine leeren Notiz-Zeilen', () => {
    // „Verantwortlich:" ohne Wert ist kein bewahrter Inhalt, sondern Rauschen.
    const plan = planCsvImport(csv('Name;Verantwortlich\nATEM;'), [], 'Importiert')
    expect(plan.fresh[0].notes).toBeUndefined()
  })

  it('legt gar keine Notiz an, wenn jede Spalte erkannt wurde', () => {
    const plan = planCsvImport(csv('Name;Kategorie\nATEM;Mischer'), [], 'Importiert')
    expect(plan.fresh[0].notes).toBeUndefined()
  })
})

describe('die Zahlen im Erfolgsfenster stimmen', () => {
  it('zaehlt bestehende Namen NICHT als neu angelegt', () => {
    // Der eigentliche Fehler: `addCustomTemplates` ueberspringt bestehende
    // Namen (richtig so), und die Meldung zaehlte sie trotzdem mit. Wer
    // vierzig Zeilen einlas, von denen zwoelf schon dastanden, las „40".
    const plan = planCsvImport(
      csv('Name\nATEM\nHyperDeck\nATEM Mini'),
      ['ATEM', 'HyperDeck'],
      'Importiert',
    )
    expect(plan.fresh.map((t) => t.name)).toEqual(['ATEM Mini'])
    expect(plan.existing).toEqual(['ATEM', 'HyperDeck'])
  })

  it('zaehlt einen INNERHALB der Datei doppelten Namen nur einmal als neu', () => {
    const plan = planCsvImport(csv('Name\nATEM\nATEM'), [], 'Importiert')
    expect(plan.fresh).toHaveLength(1)
    expect(plan.existing).toEqual(['ATEM'])
  })

  it('nennt die Zeilennummern der namenlosen Zeilen so, wie sie in der Tabelle stehen', () => {
    // 1-basiert und mit Kopfzeile: die zweite Datenzeile ist Zeile 3.
    const plan = planCsvImport(csv('Name;Kategorie\nATEM;Mischer\n;Mischer'), [], 'Importiert')
    expect(plan.rowsWithoutName).toEqual([3])
  })
})

describe('leere Zellen ueberschreiben nichts', () => {
  it('legt kein Feld an, dessen Zelle leer ist', () => {
    // Die zweite Regel des Bedarfs („refuses to overwrite non-empty values
    // with empty ones") in ihrer milderen Form: gar nicht erst schreiben.
    const plan = planCsvImport(
      csv('Name;Seriennummer;IP;Leistung\nATEM;;;'),
      [],
      'Importiert',
    )
    const tpl = plan.fresh[0]
    expect(tpl.serialNumber).toBeUndefined()
    expect(tpl.ipAddress).toBeUndefined()
    expect(tpl.powerConsumptionWatts).toBeUndefined()
  })

  it('laesst einen bestehenden Namen unangetastet, statt ihn leer zu ueberschreiben', () => {
    const plan = planCsvImport(csv('Name;Leistung\nATEM;'), ['ATEM'], 'Importiert')
    expect(plan.fresh).toEqual([])
    expect(plan.existing).toEqual(['ATEM'])
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Ein Plan, den der Dialog nicht zeigt, ist kein Hinweis.
// ---------------------------------------------------------------------------
describe('Erreichbarkeit im Import-Dialog', () => {
  it('rechnet den Import gegen die BESTEHENDE Library durch', () => {
    // Ohne die Library kann die dritte Frage nicht beantwortet werden -- und
    // genau die stand vorher falsch in der Erfolgsmeldung.
    expect(dialogQuelle).toContain("from '../../lib/csvImportPlan'")
    expect(dialogQuelle).toContain('planCsvImport(')
    expect(dialogQuelle).toContain('customLibrary.map((tpl) => tpl.name)')
  })

  it('zeigt jeden der vier Befunde', () => {
    // Geprueft wird die RENDER-Bedingung (`… > 0 && (`), nicht das blosse
    // Vorkommen des Ausdrucks: derselbe Text steht auch in `etwasFaelltAuf`,
    // und eine Gegenprobe, die nur das Rendern abschaltet, blieb damit gruen.
    // Genau dieser Fehler ist schon einmal in einem Erreichbarkeits-Guard
    // passiert.
    expect(dialogQuelle).toContain('{plan.unmapped.length > 0 && (')
    expect(dialogQuelle).toContain('{plan.duplicates.length > 0 && (')
    expect(dialogQuelle).toContain('{plan.rowsWithoutName.length > 0 && (')
    expect(dialogQuelle).toContain('{plan.existing.length > 0 && (')
    // Und der Kasten selbst haengt am Sammel-Flag.
    expect(dialogQuelle).toContain('{etwasFaelltAuf && (')
  })

  it('meldet am Ende die WIRKLICH angelegte Zahl', () => {
    // Seit Bedarf 65 kommt sie aus dem BERICHT des Stores, nicht mehr aus dem
    // Plan. Der Plan ist die Vorschau VOR dem Klick; gemeldet werden muss das
    // Ergebnis. Vorher stand hier `n: plan.fresh.length` -- dieselbe Zahl,
    // aber aus der falschen Quelle: zwei parallel gefuehrte Zaehlungen ueber
    // dieselbe Operation weichen irgendwann ab, und dann stimmt die falsche.
    expect(dialogQuelle).toContain('n: bericht.added.length')
    expect(dialogQuelle).not.toContain('n: plan.fresh.length')
    // Was nur der Plan weiss, kommt weiter von ihm — die namenlosen Zeilen
    // der DATEI sieht der Store nie.
    expect(dialogQuelle).toContain('vorhanden: plan.existing.length')
    expect(dialogQuelle).toContain('ohneName: plan.rowsWithoutName.length')
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of [
      'csvImport.whatHappens',
      'csvImport.unmapped',
      'csvImport.duplicateCols',
      'csvImport.noName',
      'csvImport.existing',
    ]) {
      expect(dialogQuelle).toContain(`'${key}'`)
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
