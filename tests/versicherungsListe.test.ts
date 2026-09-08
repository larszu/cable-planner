import { describe, expect, it } from 'vitest'
import {
  NICHT_ANGEGEBEN,
  carnetDatenblatt,
  eingabeAusGeld,
  geldAusEingabe,
  versicherungsListe,
  versicherungsTabelle,
} from '../src/renderer/lager/lib/insuranceSchedule'
import dialogQuelle from '../src/renderer/lager/ui/InventoryDialog.tsx?raw'
import storeQuelle from '../src/renderer/lager/store/inventoryStore.ts?raw'
import modulQuelle from '../src/renderer/lager/lib/insuranceSchedule.ts?raw'
import type { InventoryItem, InventoryUnit } from '../src/renderer/lager/types/inventory'

// ───────────────────────────────────────────────────────────────────────────
// Bedarf 118 — die Wert-Haelfte des Kit-Registers.
//
// Die gefaehrliche Zahl ist die SUMME. Eine Versicherungssumme ueber einen
// Bestand, in dem die Haelfte der Einheiten keinen Wert traegt, ist die Zahl,
// mit der jemand unterversichert in einen Schadensfall geht — und sie sieht
// aus wie eine Auskunft. Die meisten Tests hier pruefen genau das: dass die
// Summe ihre Luecke MITTRAEGT.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Kommentarzeilen weg.
 *
 * Ohne das liest ein Waechter PROSA: die Modul-Kopfzeile erklaert ausfuehrlich,
 * warum es KEINEN Umrechnungskurs und KEINEN Zeitwert gibt — und genau diese
 * Woerter suchen die Tests unten. Die ersten Fassungen wurden daran rot, ohne
 * dass am Code etwas falsch war. Derselbe Helfer steht schon in
 * `circuitFromProject.test.ts`; hier ist er noetiger als dort.
 */
const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

const modulCode = ohneKommentare(modulQuelle)

const einheit = (id: string, over: Partial<InventoryUnit> = {}): InventoryUnit => ({
  id,
  itemId: 'i1',
  condition: 'ok',
  history: [],
  createdAt: 't',
  updatedAt: 't',
  ...over,
})

const eur = (cent: number) => ({ betrag: { cent, waehrung: 'EUR' } })

const modell = () => 'Kamera'

describe('Die Summe kommt nie allein', () => {
  it('fuehrt die Einheiten ohne Wert namentlich', () => {
    const liste = versicherungsListe(
      [
        einheit('a', { serial: 'SN-1', versicherungswert: eur(180000) }),
        einheit('b', { serial: 'SN-2' }),
        einheit('c', { serial: 'SN-3' }),
      ],
      modell,
    )
    expect(liste.summen).toEqual([{ waehrung: 'EUR', cent: 180000, einheiten: 1 }])
    // Nicht bloss die Zahl 2: wer die Liste vervollstaendigen will, braucht zu
    // wissen WELCHE fehlen.
    expect(liste.ohneWert.map((z) => z.serial)).toEqual(['SN-2', 'SN-3'])
  })

  it('traegt die Luecke auch in der CSV — dort steht die Anwendung nicht daneben', () => {
    const tabelle = versicherungsTabelle(
      versicherungsListe([einheit('a', { versicherungswert: eur(5000) }), einheit('b')], modell),
    )
    const alsText = tabelle.rows.map((r) => r.join('|')).join('\n')
    expect(alsText).toContain('Summe (1 Einheiten)')
    expect(alsText).toContain('1 Einheiten ohne angegebenen Versicherungswert')
  })

  it('sagt die Null-Luecke ausdruecklich', () => {
    // „0 Einheiten ohne angegebenen Wert" ist eine Aussage; ihr Fehlen waere
    // keine — der Leser wuesste nicht, ob geprueft wurde.
    const tabelle = versicherungsTabelle(
      versicherungsListe([einheit('a', { versicherungswert: eur(5000) })], modell),
    )
    expect(tabelle.rows.map((r) => String(r[0]))).toContain(
      '0 Einheiten ohne angegebenen Versicherungswert',
    )
  })
})

describe('Zwei Waehrungen sind keine Summe', () => {
  it('summiert je Waehrung getrennt', () => {
    const liste = versicherungsListe(
      [
        einheit('a', { versicherungswert: eur(100000) }),
        einheit('b', { versicherungswert: { betrag: { cent: 200000, waehrung: 'USD' } } }),
        einheit('c', { versicherungswert: eur(50000) }),
      ],
      modell,
    )
    expect(liste.summen).toEqual([
      { waehrung: 'EUR', cent: 150000, einheiten: 2 },
      { waehrung: 'USD', cent: 200000, einheiten: 1 },
    ])
  })

  it('rechnet nicht um', () => {
    // Ein Umrechnungskurs waere ein Wert ohne Fundstelle. Wer je eine
    // Gesamtsumme einbaut, faellt hier durch.
    expect(modulCode).not.toMatch(/kurs|Kurs|umrechn|Umrechn/i)
  })
})

describe('Ein Wert ohne Waehrung ist kein Wert', () => {
  it('zaehlt einen Betrag ohne Waehrungskuerzel nicht mit', () => {
    const liste = versicherungsListe(
      [einheit('a', { versicherungswert: { betrag: { cent: 99900, waehrung: '  ' } } })],
      modell,
    )
    expect(liste.summen).toEqual([])
    expect(liste.ohneWert).toHaveLength(1)
  })

  it('macht aus einer Eingabe ohne Waehrung keinen Betrag', () => {
    expect(geldAusEingabe('1234,50', '')).toBeUndefined()
    expect(geldAusEingabe('1234,50', 'eur')).toEqual({ cent: 123450, waehrung: 'EUR' })
    expect(geldAusEingabe('', 'EUR')).toBeUndefined()
    expect(geldAusEingabe('keine Zahl', 'EUR')).toBeUndefined()
    expect(geldAusEingabe('-5', 'EUR')).toBeUndefined()
  })

  it('kommt aus dem Eingabefeld wieder heraus, was hineinging', () => {
    const b = geldAusEingabe('1234,50', 'EUR')
    expect(eingabeAusGeld(b)).toBe('1234.50')
    expect(eingabeAusGeld(undefined)).toBe('')
  })

  it('laesst ein NaN nicht in die Summe', () => {
    // Ein `NaN` auf einem Blatt sieht aus wie ein Fehler der Anwendung, nicht
    // wie eine fehlende Angabe — und es faerbte die GANZE Summe.
    const liste = versicherungsListe(
      [
        einheit('a', { versicherungswert: eur(1000) }),
        einheit('b', { versicherungswert: { betrag: { cent: Number.NaN, waehrung: 'EUR' } } }),
      ],
      modell,
    )
    expect(liste.summen).toEqual([{ waehrung: 'EUR', cent: 1000, einheiten: 1 }])
  })
})

describe('Es gibt keinen Zeitwert', () => {
  it('setzt die Anschaffung NICHT als Versicherungswert ein', () => {
    // Der teuerste denkbare Fehler dieses Bedarfs: aus dem Kaufpreis einen
    // Versicherungswert machen. Nach welcher Regel abgeschrieben wird,
    // entscheidet der Versicherer.
    const liste = versicherungsListe([einheit('a', { anschaffung: eur(249900) })], modell)
    expect(liste.summen).toEqual([])
    expect(liste.ohneWert).toHaveLength(1)
    expect(liste.zeilen[0].wert).toBeUndefined()
  })

  it('rechnet nirgends eine Abschreibung', () => {
    expect(modulCode).not.toMatch(/zeitwert|abschreib/i)
  })
})

describe('Das Carnet-Datenblatt beliefert, es baut nicht', () => {
  const artikel: InventoryItem = {
    id: 'i1',
    model: 'FX9',
    manufacturer: 'Sony',
    quantity: 1,
    dimensions: { weightKg: 2.5 },
    ursprungsland: 'JP',
    createdAt: 't',
    updatedAt: 't',
  }

  it('traegt die Spalten, die eine Carnet-Position braucht', () => {
    const tabelle = carnetDatenblatt([einheit('a', { serial: 'SN-1', anschaffung: eur(1290000) })], () => artikel)
    expect(tabelle.headers).toEqual([
      'Beschreibung',
      'Herstellernummer',
      'Gewicht (kg)',
      'Anschaffungspreis',
      'Währung',
      'Ursprungsland',
    ])
    expect(tabelle.rows[0]).toEqual(['Sony FX9', 'SN-1', 2.5, '12900.00', 'EUR', 'JP'])
  })

  it('schreibt „nicht angegeben" statt einer leeren Zelle', () => {
    // Eine leere Zelle sieht auf einem Ausdruck aus wie „nichts zu melden".
    // Genau das ist der Zweck des Blattes: zu zeigen, was noch fehlt, BEVOR
    // jemand am Zoll steht.
    const tabelle = carnetDatenblatt([einheit('a')], () => undefined)
    expect(tabelle.rows[0]).toEqual([
      NICHT_ANGEGEBEN,
      NICHT_ANGEGEBEN,
      NICHT_ANGEGEBEN,
      NICHT_ANGEGEBEN,
      '',
      NICHT_ANGEGEBEN,
    ])
  })

  it('nennt die Wert-Spalte so, wie sie gefuellt ist', () => {
    // „Wert" waere neutral und damit unklar: welcher von beiden der Zoll sehen
    // will, entscheidet nicht diese Anwendung.
    expect(carnetDatenblatt([], () => undefined).headers).toContain('Anschaffungspreis')
    expect(carnetDatenblatt([], () => undefined).headers).not.toContain('Wert')
  })
})

describe('Der Lieferschein wird nicht ein zweites Mal gebaut', () => {
  it('erzeugt dieses Modul keinen Ausgabeschein', () => {
    // Er existiert seit Bedarf 15/16/136 als `checkoutSheet` +
    // `handoverSignatureTable`. Eine zweite Fassung waere `zwei-rechnungen`
    // mit einem Beleg.
    expect(modulCode).not.toMatch(/checkoutSheet|handoverSignature|Ausgabeschein/)
  })
})

describe('Der Weg ist verdrahtet', () => {
  it('haengen beide Blaetter im Bestandsdialog', () => {
    expect(dialogQuelle).toContain("'versicherungsliste.csv'")
    expect(dialogQuelle).toContain('versicherungsTabelle(')
    expect(dialogQuelle).toContain("'carnet-datenblatt.csv'")
    expect(dialogQuelle).toContain('carnetDatenblatt(units')
  })

  it('sind die beiden Werte im Formular pflegbar', () => {
    // Ohne Eingabefelder waeren die Blaetter leer und der Bedarf nicht
    // erfuellt — die Felder allein sind kein Feature.
    expect(dialogQuelle).toContain('inventory.insuredValue')
    expect(dialogQuelle).toContain('inventory.purchase')
    expect(dialogQuelle).toContain('inventory.origin')
  })

  it('reicht die Bearbeitung einer bestehenden Einheit die Werte durch', () => {
    // `updateUnit` ist der einzige Weg, Stammfelder zu aendern. Fehlen die
    // Werte in seinem Aufruf, liessen sie sich anlegen, aber nie korrigieren.
    //
    // DER ANKER IST DER AUFRUF, nicht `if (form.id)`: den gibt es in jedem
    // Reiter des Dialogs, und die erste Fundstelle ist der Artikel-Reiter. Die
    // erste Fassung schnitt deshalb einen Bereich heraus, der das
    // `payload`-Literal noch enthielt — und blieb gruen, als die Gegenprobe
    // die Zeile aus dem `updateUnit`-Aufruf loeschte.
    const anfang = dialogQuelle.indexOf('updateUnit(form.id, {')
    expect(anfang).toBeGreaterThan(0)
    const speichern = dialogQuelle.slice(anfang, dialogQuelle.indexOf('})', anfang))
    expect(speichern).toContain('anschaffung')
    expect(speichern).toContain('versicherungswert')
  })

  it('ueberleben die Werte das Laden', () => {
    // `healUnit` baut jede Einheit Feld fuer Feld neu auf. Ein hier vergessenes
    // Feld ist beim naechsten Start still weg — und die Versicherungsliste
    // kennte den halben Bestand nicht mehr, ohne dass jemand etwas gesagt hat.
    const heilung = storeQuelle.slice(
      storeQuelle.indexOf('const healUnit'),
      storeQuelle.indexOf('const load ='),
    )
    expect(heilung).toContain('anschaffung: healAnschaffung(r.anschaffung)')
    expect(heilung).toContain('versicherungswert: healVersicherungswert(r.versicherungswert)')
  })

  it('ueberlebt das Ursprungsland das Laden', () => {
    // Dieselbe Falle eine Ebene hoeher, und sie war beim ersten Durchgang
    // ungeprueft: `healItem` baut auch den Artikel Feld fuer Feld neu auf. Ohne
    // diese Zeile stuende im Carnet-Datenblatt „nicht angegeben" fuer ein Land,
    // das der Nutzer eingetragen hat — und er saehe es erst am Zoll.
    const heilung = storeQuelle.slice(
      storeQuelle.indexOf('const healItem'),
      storeQuelle.indexOf('const NODE_KINDS'),
    )
    expect(heilung).toContain('ursprungsland:')
  })
})

describe('Das Modul bleibt rein', () => {
  it('hat weder Uhr noch Store noch IO', () => {
    expect(modulCode).not.toContain('Date.now')
    expect(modulCode).not.toContain('new Date(')
    expect(modulCode).not.toContain('useInventoryStore')
    expect(modulCode).not.toContain('window.')
  })
})
