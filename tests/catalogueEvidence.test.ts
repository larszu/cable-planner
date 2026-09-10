// ───────────────────────────────────────────────────────────────────────────
// Welche Katalog-Zeile trägt ein Datenblatt? (Initiative 11, Schritt 2/3)
//
// `INITIATIVE-11-SCOPING.md` nennt den Zweck des Schritts wörtlich:
//
//   > Step 2 alone would make a claim testable that the suite currently only
//   > asserts.
//
// Genau das ist diese Datei. Was hier geprüft wird, und warum jede Zeile davon
// nötig ist:
//
//  1. DIE 253 KOMMENTARE SIND SCHON DATEN. Der Plan hielt das für den nächsten
//     Schritt; nachgemessen ist es der vorletzte. Geprüft wird nicht die
//     Behauptung, sondern der Zustand: jeder `// Quelle:`-Kommentar steht als
//     `manufacturerUrl` im Eintrag darunter.
//
//  2. DIE ABDECKUNG WIRD GERECHNET, NICHT ERINNERT. 253 von 412. Die Zahl
//     stand als Prosa im Backlog und nirgends im Code.
//
//  3. DIE RATSCHE. Ein Katalog, der heute vollständig belegt ist, darf morgen
//     keinen unbelegten Eintrag dazubekommen — sonst sinkt die Abdeckung
//     lautlos, und die einzige Stelle, die es merkt, ist niemand.
//
//  4. „KEIN BELEG" IST EINE AUSSAGE. `unsourced` (Katalog-Eintrag ohne
//     Datenblatt) und `no-type` (Gerät aus keinem Katalog) sind verschiedene
//     Auskünfte; als leeres Feld sahen beide gleich aus.
//
//  5. DIE LISTE HIER UND DAS REGISTER LESEN DIESELBEN KATALOGE. Ein
//     sechzehnter Katalog, der nur im Register steht, hieße: die Abdeckung
//     sieht besser aus, als sie ist.
//
//  6. DERSELBE BAUM ERGIBT DENSELBEN BERICHT.
//
//  7. DER WEG IST VERDRAHTET.
// ───────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOGUES, evidenceForType, evidenceReport } from '../src/renderer/lib/catalogueEvidence'

// `__dirname` und nicht `import.meta.url`: unter vitest ist die Modul-URL
// nicht zwingend `file:`, und `readdirSync` verlangt einen Pfad. Dieselbe
// Bauform wie in `architekturAussagen.test.ts`.
const ROOT = join(__dirname, '..')
const LIB = join(ROOT, 'src', 'renderer', 'lib')

const lies = (...teile: string[]): string => readFileSync(join(ROOT, ...teile), 'utf8')

const ohneKommentare = (...teile: string[]): string =>
  lies(...teile)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

describe('Initiative 11 — trägt diese Katalog-Zeile ein Datenblatt?', () => {
  it('1. jeder `// Quelle:`-Kommentar steht auch als Feld', () => {
    const dateien = readdirSync(LIB).filter((f) => f.endsWith('Catalog.ts'))
    expect(dateien.length).toBeGreaterThan(10)

    let kommentare = 0
    for (const datei of dateien) {
      const roh = lies('src', 'renderer', 'lib', datei)
      const quellen = [...roh.matchAll(/\/\/\s*Quelle:\s*(\S+)/g)].map((m) => m[1])
      const felder = new Set([...roh.matchAll(/manufacturerUrl:\s*'([^']+)'/g)].map((m) => m[1]))
      kommentare += quellen.length
      // Ein Beleg, der nur im Kommentar steht, ist zur Laufzeit keiner.
      for (const q of quellen) {
        expect(felder.has(q), `${datei}: ${q} steht nur im Kommentar`).toBe(true)
      }
    }
    // Die Zahl aus dem Scoping-Papier — gegen den Baum gehalten, nicht geglaubt.
    // 253 + 1 + 31: `mediaStationCatalog` trug EINEN belegten Eintrag bei (die
    // Medien-Station als Plan-Endpunkt; ihr Beleg ist das Repo der Station
    // selbst). blackmagic ist 2026-09 mit 31 Belegen dazugekommen — der
    // Smartscope Duo 4K bleibt als einziger unbelegt (eingestellt, keine
    // Live-Produktseite).
    expect(kommentare).toBe(285)
  })

  it('2. die Abdeckung wird gerechnet', () => {
    const bericht = evidenceReport()
    // Die Summen stammen aus derselben Rechnung wie die Zeilen.
    expect(bericht.entries).toBe(bericht.perCatalogue.reduce((s, c) => s + c.entries, 0))
    expect(bericht.sourced + bericht.unsourced).toBe(bericht.entries)
    expect(bericht.sourced).toBe(285)
    expect(bericht.entries).toBe(413)

    // Die fünf Kataloge ohne Beleg sind genau die, die B-11 nennt — und die
    // Liste wird GERECHNET, nicht aufgezählt: trägt einer von ihnen morgen
    // Belege nach, fällt er von selbst heraus.
    const ohne = bericht.perCatalogue.filter((c) => c.sourced === 0).map((c) => c.name)
    expect(ohne).toEqual(['camera', 'greengo', 'misc', 'monitor', 'ubiquiti'])
    expect(bericht.perCatalogue.filter((c) => c.sourced === 0)
      .reduce((s, c) => s + c.entries, 0)).toBe(127)
  })

  it('3. die Ratsche: ein vollständig belegter Katalog bleibt es', () => {
    // Wer heute vollständig ist, ist es namentlich. Ein neuer Eintrag ohne
    // Datenblatt in einem dieser Kataloge macht diese Zeile rot — und genau
    // das ist der Zweck: die Abdeckung soll nicht lautlos sinken koennen.
    const vollstaendig = [
      'aja', 'audio', 'avNetwork', 'broadcastTools', 'lynx',
      'mediaStation', 'mic', 'ross', 'switcher', 'wirelessAudio',
    ]
    const bericht = evidenceReport()
    for (const name of vollstaendig) {
      const k = bericht.perCatalogue.find((c) => c.name === name)
      expect(k, `${name} fehlt in der Rechnung`).toBeDefined()
      expect(k!.unsourced, `${name} hat einen Eintrag ohne Datenblatt dazubekommen`).toBe(0)
    }
    // Und die Gesamtzahl der unbelegten steigt nicht. Sinken darf sie —
    // dann ist diese Zeile die Erinnerung, die Zahl nachzuziehen.
    expect(bericht.unsourced).toBeLessThanOrEqual(159)
  })

  it('4. „kein Beleg" ist eine eigene Auskunft', () => {
    const mitBeleg = CATALOGUES.find((c) => c.name === 'aja')!.entries[0]
    // Der Smartscope Duo 4K ist der einzige blackmagic-Eintrag ohne Beleg
    // (eingestellt) — genau darum taugt er als „unsourced"-Beispiel.
    const ohneBeleg = CATALOGUES.find((c) => c.name === 'blackmagic')!.entries.find(
      (e) => !e.template.manufacturerUrl,
    )!

    const a = evidenceForType(mitBeleg.deviceTypeId)
    expect(a.kind).toBe('sourced')
    if (a.kind === 'sourced') {
      expect(a.url).toBe(mitBeleg.template.manufacturerUrl)
      expect(a.catalogue).toBe('aja')
    }

    const b = evidenceForType(ohneBeleg.deviceTypeId)
    expect(b.kind).toBe('unsourced')
    if (b.kind === 'unsourced') expect(b.catalogue).toBe('blackmagic')

    // Kein Katalog-Typ ist etwas ANDERES als ein Typ ohne Beleg.
    expect(evidenceForType('gibt-es-nicht').kind).toBe('no-type')
    expect(evidenceForType(undefined).kind).toBe('no-type')

    // Leerraum ist kein Beleg.
    const leer = [{
      name: 'test',
      entries: [{ deviceTypeId: 'x', template: { name: 'X', manufacturerUrl: '   ' } }],
    }]
    expect(evidenceForType('x', leer).kind).toBe('unsourced')
    expect(evidenceReport(leer).sourced).toBe(0)
  })

  it('5. Rechnung und Register lesen dieselben Kataloge', () => {
    const katalogImporte = (...teile: string[]): string[] =>
      [...ohneKommentare(...teile).matchAll(/from '\.\/(\w+Catalog)'/g)].map((m) => m[1]).sort()

    const imRegister = katalogImporte('src', 'renderer', 'lib', 'deviceTypeRegistry.ts')
    const inDerRechnung = katalogImporte('src', 'renderer', 'lib', 'catalogueEvidence.ts')
    expect(imRegister.length).toBeGreaterThan(10)
    expect(inDerRechnung).toEqual(imRegister)
    expect(CATALOGUES).toHaveLength(imRegister.length)
  })

  it('6. derselbe Baum ergibt denselben Bericht', () => {
    expect(evidenceReport()).toEqual(evidenceReport())

    // Die feste Ordnung wird an einer UNSORTIERTEN Eingabe geprueft. Gegen
    // `CATALOGUES` allein waere die Zusicherung wertlos: die Liste steht
    // ohnehin alphabetisch, also saehe ein Bericht ohne jede Sortierung
    // genauso aus. Eine Gegenprobe, die den `sort` ausbaut, blieb damit
    // gruen — nachgemessen, nicht vermutet.
    const durcheinander = [
      { name: 'zeta', entries: [] },
      { name: 'alpha', entries: [] },
      { name: 'mitte', entries: [] },
    ]
    expect(evidenceReport(durcheinander).perCatalogue.map((c) => c.name))
      .toEqual(['alpha', 'mitte', 'zeta'])

    const namen = evidenceReport().perCatalogue.map((c) => c.name)
    expect(namen).toEqual([...namen].sort())
  })

  it('7. der Weg ist verdrahtet', () => {
    const panel = ohneKommentare(
      'src', 'renderer', 'components', 'Properties', 'sections', 'OptionalFieldsSection.tsx',
    )
    expect(panel).toMatch(/evidenceForType\(equipment\.deviceTypeId\)/)
    // Der fehlende Beleg wird genannt — und NUR er: `no-type` bleibt still,
    // sonst stuende an jedem von Hand angelegten Geraet eine Meldung ohne
    // Anlass.
    expect(panel).toMatch(/typBeleg\.kind === 'unsourced'/)
    expect(panel).toMatch(/manufacturerUrlNoSource/)
    expect(panel).not.toMatch(/typBeleg\.kind === 'no-type'/)
  })
})
