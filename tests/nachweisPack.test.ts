import { describe, expect, it } from 'vitest'
import {
  OHNE_ANGABE,
  OHNE_DATEI,
  laeuftBaldAb,
  nachweisDeckblatt,
  nachweisLage,
  nachweisPaket,
  tageBisFrist,
} from '../src/renderer/lib/nachweisPack'
import { NACHWEIS_LAGE_LABEL } from '../src/renderer/types/nachweis'
import type { Nachweis } from '../src/renderer/types/nachweis'
import modulQuelle from '../src/renderer/lib/nachweisPack.ts?raw'
import storeQuelle from '../src/renderer/store/nachweisStore.ts?raw'
import tabQuelle from '../src/renderer/components/Settings/tabs/NachweiseTab.tsx?raw'
import bodyQuelle from '../src/renderer/components/Settings/SettingsBody.tsx?raw'
import projektTypQuelle from '../src/renderer/types/project.ts?raw'

// ───────────────────────────────────────────────────────────────────────────
// Bedarf 120 — der portable Nachweis-Pack.
//
// DIE EINE GEFAEHRLICHE STELLE: ein abgelaufener oder fristloser Nachweis,
// der gueltig aussieht. Wer diese Liste einem Kunden gibt, sagt damit „das ist
// mein Stand" — und „keine Frist angegeben" ist etwas anderes als
// „unbefristet". Die meisten Tests hier pruefen genau diese Unterscheidung.
// ───────────────────────────────────────────────────────────────────────────

const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

const modulCode = ohneKommentare(modulQuelle)

const n = (over: Partial<Nachweis> = {}): Nachweis => ({
  id: 'n1',
  art: 'qualifikation',
  bezeichnung: 'Sachkundenachweis',
  ...over,
})

const HEUTE = '2026-09-08'

describe('Ohne Frist ist nicht gueltig', () => {
  it('kennt drei Lagen, nicht zwei', () => {
    expect(nachweisLage(n({ gueltigBis: '2027-01-01' }), HEUTE)).toBe('in-frist')
    expect(nachweisLage(n({ gueltigBis: '2020-01-01' }), HEUTE)).toBe('abgelaufen')
    // Der Fall, um den es geht: kein Datum ist keine Zusage.
    expect(nachweisLage(n(), HEUTE)).toBe('ohne-frist')
    expect(nachweisLage(n({ gueltigBis: '   ' }), HEUTE)).toBe('ohne-frist')
  })

  it('macht aus einem unlesbaren Datum kein „abgelaufen"', () => {
    // Aus „das kann ich nicht lesen" ein „das ist vorbei" zu machen waere eine
    // Behauptung ueber fremde Angaben — und andersherum waere es die
    // Entwarnung.
    expect(nachweisLage(n({ gueltigBis: 'demnaechst' }), HEUTE)).toBe('ohne-frist')
  })

  it('zaehlt den letzten Tag noch als gueltig', () => {
    // So steht es auf jedem Papier: „gueltig bis".
    expect(nachweisLage(n({ gueltigBis: HEUTE }), HEUTE)).toBe('in-frist')
    expect(tageBisFrist(n({ gueltigBis: HEUTE }), HEUTE)).toBe(0)
  })

  it('hat die fristlose Lage eine eigene Beschriftung', () => {
    // Sie darf nicht „gueltig" heissen und auch nicht leer sein.
    expect(NACHWEIS_LAGE_LABEL['ohne-frist']).toBe('keine Frist angegeben')
    expect(NACHWEIS_LAGE_LABEL['ohne-frist']).not.toBe(NACHWEIS_LAGE_LABEL['in-frist'])
  })

  it('faerbt die fristlose Lage nicht gruen', () => {
    // Gruen waere die Entwarnung durch die Hintertuer — der Nutzer liest die
    // Farbe, bevor er den Text liest.
    const ton = tabQuelle.slice(tabQuelle.indexOf('const LAGE_TON'), tabQuelle.indexOf('type FormState'))
    expect(ton).toMatch(/'ohne-frist': '[^']*amber[^']*'/)
    expect(ton).not.toMatch(/'ohne-frist': '[^']*emerald[^']*'/)
  })
})

describe('Die Vorwarnzeit wird angegeben, nicht vorausgesetzt', () => {
  const liste = [
    n({ id: 'a', gueltigBis: '2026-09-20' }),
    n({ id: 'b', gueltigBis: '2027-06-01' }),
    n({ id: 'c' }),
  ]

  it('meldet ohne Angabe NICHTS', () => {
    // Eine Vorgabe waere eine Meinung darueber, wie lange eine Verlaengerung
    // in diesem Geschaeft dauert — dieselbe Haltung wie bei
    // `CostPlan.tolerancePercent`.
    expect(laeuftBaldAb(liste, HEUTE, undefined)).toEqual([])
  })

  it('meldet mit Angabe genau die in der Frist', () => {
    expect(laeuftBaldAb(liste, HEUTE, 30).map((x) => x.id)).toEqual(['a'])
    expect(laeuftBaldAb(liste, HEUTE, 400).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('meldet nie einen schon abgelaufenen als „laeuft bald ab"', () => {
    // Der ist nicht „bald", der ist vorbei — und steht als solcher da.
    expect(laeuftBaldAb([n({ gueltigBis: '2020-01-01' })], HEUTE, 3650)).toEqual([])
  })

  it('steht die Vorgabe-Losigkeit auch im Store', () => {
    expect(storeQuelle).toMatch(/vorwarnTage\?: number/)
    // Kein hinterlegter Zahlenwert als Default.
    expect(ohneKommentare(storeQuelle)).not.toMatch(/vorwarnTage[^\n]*=\s*30/)
  })
})

describe('Das Paket laesst nichts weg', () => {
  const auswahl = [
    n({ id: 'a', bezeichnung: 'Gueltig', gueltigBis: '2027-01-01', dateiName: 'a.pdf' }),
    n({ id: 'b', bezeichnung: 'Abgelaufen', gueltigBis: '2020-01-01', dateiName: 'b.pdf' }),
    n({ id: 'c', bezeichnung: 'Fristlos' }),
  ]

  it('nimmt den abgelaufenen MIT', () => {
    // Ihn stillschweigend wegzulassen liesse den Kunden glauben, es gebe ihn
    // nicht — dabei gibt es ihn, nur abgelaufen.
    const paket = nachweisPaket(auswahl, HEUTE)
    expect(paket.zeilen.map((z) => z.nachweisId)).toEqual(['a', 'b', 'c'])
    expect(paket.abgelaufen.map((z) => z.nachweisId)).toEqual(['b'])
    expect(paket.ohneFrist.map((z) => z.nachweisId)).toEqual(['c'])
  })

  it('nennt die Eintraege ohne benannte Datei', () => {
    const paket = nachweisPaket(auswahl, HEUTE)
    expect(paket.ohneDatei.map((z) => z.nachweisId)).toEqual(['c'])
  })

  it('schreibt „keine Datei benannt" statt einer leeren Zelle', () => {
    // Eine leere Zelle liest sich auf einem Ausdruck wie „nichts weiter zu
    // sagen".
    const tabelle = nachweisDeckblatt(nachweisPaket([n({ id: 'c' })], HEUTE))
    expect(tabelle.rows[0]).toContain(OHNE_DATEI)
    expect(tabelle.rows[0]).toContain(OHNE_ANGABE)
  })

  it('traegt die Zusammenfassung im Blatt selbst', () => {
    // Das Blatt geht an einen Kunden und wird dort allein gelesen.
    const text = nachweisDeckblatt(nachweisPaket(auswahl, HEUTE))
      .rows.map((r) => String(r[0]))
      .join('\n')
    expect(text).toContain('1 abgelaufen')
    expect(text).toContain('1 ohne angegebene Frist')
    expect(text).toContain('1 ohne benannte Datei')
  })

  it('sagt auch die Nullfaelle', () => {
    // „0 abgelaufen" ist eine Aussage, ihr Fehlen waere keine.
    const text = nachweisDeckblatt(nachweisPaket([auswahl[0]], HEUTE))
      .rows.map((r) => String(r[0]))
      .join('\n')
    expect(text).toContain('0 abgelaufen')
    expect(text).toContain('0 ohne angegebene Frist')
  })
})

describe('Nachweise gehoeren der Person, nicht dem Projekt', () => {
  it('kennt der Projekt-Typ sie nicht', () => {
    // In einer `.avplan`, die an einen Kunden geht, haette die
    // Versicherungsnummer des Freiberuflers nichts zu suchen.
    expect(projektTypQuelle).not.toMatch(/nachweis/i)
  })

  it('liegen sie in einem eigenen Speicher', () => {
    expect(storeQuelle).toContain('STORAGE_KEYS.nachweise')
    expect(storeQuelle).not.toContain('useProjectStore')
  })

  it('speichert die Anwendung die Scans nicht', () => {
    // Nur der Dateiname. Fremde Personenpapiere in einen Speicher zu legen,
    // den niemand als Aktenschrank angelegt hat, waere die eigentliche
    // Zumutung — im Browser-Zweig ist es der localStorage.
    expect(modulCode).not.toMatch(/base64|blob|ArrayBuffer|FileReader/i)
    expect(ohneKommentare(storeQuelle)).not.toMatch(/base64|blob|ArrayBuffer|FileReader/i)
  })
})

describe('Der Weg ist verdrahtet', () => {
  it('haengt der Reiter in den Einstellungen', () => {
    expect(bodyQuelle).toContain("nachweise: BadgeCheck")
    expect(bodyQuelle).toContain("{section === 'nachweise' && <NachweiseTab />}")
  })

  it('erbt die Abschnitts-Pruefung die Tabelle', () => {
    // Vorher stand dort eine vierte, ungeprueffte Aufzaehlung aller
    // Abschnitte: wer sie vergass, bekam einen Tab, der sich nicht per
    // `initialSection` oeffnen liess — still.
    expect(bodyQuelle).toContain('hasOwnProperty.call(TAB_ICONS, v)')
    expect(bodyQuelle).not.toMatch(/\['project', 'modules'/)
  })

  it('gibt es das Deckblatt zum Herunterladen', () => {
    expect(tabQuelle).toContain("'nachweise-deckblatt.csv'")
    expect(tabQuelle).toContain('nachweisDeckblatt(')
  })

  it('nimmt die Anzeige EINEN Stichtag fuer alle Zeilen', () => {
    // Sonst beantworteten zwei Zeilen derselben Liste die Frage „gilt das
    // noch" an zwei verschiedenen Zeitpunkten.
    expect(tabQuelle).toMatch(/const heute = useMemo\(\(\) => new Date\(\)\.toISOString\(\)\.slice\(0, 10\), \[\]\)/)
  })
})

describe('Das Modul bleibt rein', () => {
  it('hat weder Uhr noch Store noch IO', () => {
    expect(modulCode).not.toContain('Date.now')
    expect(modulCode).not.toContain('new Date(')
    expect(modulCode).not.toContain('useNachweisStore')
    expect(modulCode).not.toContain('window.')
  })
})
