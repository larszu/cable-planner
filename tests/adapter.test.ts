import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ADAPTER_RICHTUNGEN,
  ADAPTER_RICHTUNG_LABEL,
  ADAPTER_SPEISUNGEN,
  ADAPTER_SPEISUNG_LABEL,
  adapterBezeichnung,
  beurteileAdapter,
  normalisiereAdapter,
  normalisiereKann,
  vergleicheStandard,
  type AdapterSpec,
} from '../src/renderer/types/adapter'
import { ALL_CONNECTOR_TYPES } from '../src/renderer/types/equipment'
import { DEFAULT_CONNECTOR_TYPE_COLORS } from '../src/renderer/lib/cableColors'
import { MODEL_FIELDS } from '../src/renderer/lib/modelFields'
import { PASS_THROUGH_LABEL } from '../src/renderer/lib/signalChain'

// ---------------------------------------------------------------------------
// B-46 — der Adapter als eigenes Objekt.
//
// Rueckmeldung des Eigentuemers, 2026-09-08: „Ebenso fehlen Steck und
// Kabeladapter wie zum Beispiel Micro HDMI auf HDMI Adapter oder USB C auf
// DisplayPort."
//
// GEMESSEN, bevor gebaut wurde — und mit einer BERICHTIGUNG zum ersten
// Befund im Backlog:
//   • Adapter waren NICHT ganz abwesend. `planDemandExtras.ts` leitet seit
//     Bedarf 17 Adapter-Zeilen fuer die Kommissionierliste ab.
//   • Was fehlte, ist der Adapter als DING: `Micro-HDMI` gab es nicht einmal
//     als Steckertyp (nur in einem Kommentar in `mediaStationCatalog.ts`),
//     und in `src/renderer/types/` kam „adapter" NULL mal vor.
//   • Der Unterschied ist der aus ADR-002: die abgeleitete Zeile ist aus dem
//     MANGEL gebaut („diese beiden Stecker passen nicht"), nicht aus einer
//     Angabe. Sie kann Richtung, Grenze und Voraussetzung nicht kennen.
// ---------------------------------------------------------------------------

const HDMI_AUF_MICRO: AdapterSpec = {
  von: 'Micro-HDMI',
  nach: 'HDMI',
  richtung: 'beidseitig',
  speisung: 'passiv',
}

const USBC_AUF_DP: AdapterSpec = {
  von: 'USB-C',
  nach: 'DisplayPort',
  richtung: 'einweg',
  speisung: 'aktiv-aus-quelle',
  setztVoraus: 'DisplayPort Alternate Mode',
}

describe('Das Beispiel des Eigentuemers laesst sich ueberhaupt benennen', () => {
  it('Micro-HDMI ist ein Steckertyp', () => {
    // Vorher gab es `HDMI` (Typ A) und `Mini-HDMI` (Typ C), aber nicht Typ D
    // — an jeder kleinen Kamera und jedem Pi sitzt genau der.
    expect(ALL_CONNECTOR_TYPES).toContain('Micro-HDMI')
  })

  it('und er hat eine Farbe wie jeder andere', () => {
    // `Record<ConnectorType, string>` erzwingt das ohnehin beim Uebersetzen.
    // Die Zusicherung steht hier fuer den Fall, dass jemand den Typ des
    // Tabellen-Literals lockert.
    expect(DEFAULT_CONNECTOR_TYPE_COLORS['Micro-HDMI']).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('Der Adapter liegt im Weg, nicht daneben', () => {
  it('der Signalweg kennt ihn als eigene Station', () => {
    // Und NICHT als `converter`: auf dem Blatt stuende sonst „Wandler" an
    // einer Stelle, an der ein Steckadapter sitzt — wer den Weg abgeht,
    // sucht dann ein Geraet mit Netzteil.
    expect(PASS_THROUGH_LABEL).toHaveProperty('adapter')
    expect(PASS_THROUGH_LABEL.adapter).not.toBe(PASS_THROUGH_LABEL.converter)
  })

  it('und er ist eine Modell-Eigenschaft, keine des Exemplars', () => {
    // Ein „Micro-HDMI auf HDMI, einweg, passiv" ist in jedem Plan derselbe.
    // Im Exemplar muesste man ihn bei jedem Herausziehen aus der Bibliothek
    // neu eintragen — und wer das vergisst, bekommt `unbekannt` und damit
    // keinen Befund dort, wo einer hingehoert.
    expect(MODEL_FIELDS).toContain('adapter')
    expect(MODEL_FIELDS).toContain('kann')
  })
})

describe('Die Angaben sind erklaert und nicht aus den Steckern geraten', () => {
  it('jede Richtung hat eine Beschriftung', () => {
    for (const r of ADAPTER_RICHTUNGEN) expect(ADAPTER_RICHTUNG_LABEL[r]).toBeTruthy()
  })

  it('jede Speisungsart hat eine Beschriftung', () => {
    for (const s of ADAPTER_SPEISUNGEN) expect(ADAPTER_SPEISUNG_LABEL[s]).toBeTruthy()
  })

  it('die Oberflaeche leitet die Richtung NICHT aus den Steckertypen ab', () => {
    // Der gefaehrliche Bequemlichkeits-Griff: „USB-C auf DisplayPort? Das ist
    // sicher einweg." Aus der Steckerpaarung folgt das nicht — es haengt am
    // Bauteil. Eine geratene Vorbelegung saehe in der Maske aus wie eine
    // Angabe des Nutzers, und der Plan-Check zeigte darauf einen Haken.
    const src = readFileSync(
      resolve(__dirname, '..', 'src', 'renderer', 'components', 'Properties', 'sections', 'AdapterSection.tsx'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    // Die Vorgabe beim Anhaken steht auf 'unbekannt' — und auf nichts sonst.
    expect(src).toMatch(/richtung:\s*'unbekannt'/)
    expect(src).not.toMatch(/richtung:\s*'einweg'/)
    expect(src).not.toMatch(/richtung:\s*'beidseitig'/)
    expect(src).toMatch(/speisung:\s*'unbekannt'/)
  })
})

describe('Drei Urteile, nicht zwei', () => {
  it('erklaert und passend: passt', () => {
    expect(
      beurteileAdapter(HDMI_AUF_MICRO, {
        quelleSteckt: 'Micro-HDMI',
        senkeSteckt: 'HDMI',
      }).art,
    ).toBe('passt')
  })

  it('mechanisch falsch: passt-nicht', () => {
    const u = beurteileAdapter(HDMI_AUF_MICRO, { quelleSteckt: 'XLR', senkeSteckt: 'BNC' })
    expect(u.art).toBe('passt-nicht')
    expect(u.text).toContain('Micro-HDMI')
  })

  it('ein Einweg-Adapter verkehrt herum: passt-nicht', () => {
    // Der Fall, der auf dem Blatt am teuersten ist: der Adapter LIEGT da, er
    // passt mechanisch, und es kommt trotzdem nichts an.
    const u = beurteileAdapter(
      { ...USBC_AUF_DP, setztVoraus: undefined },
      { quelleSteckt: 'DisplayPort', senkeSteckt: 'USB-C' },
    )
    expect(u.art).toBe('passt-nicht')
  })

  it('ein beidseitiger Adapter verkehrt herum: passt', () => {
    expect(
      beurteileAdapter(HDMI_AUF_MICRO, { quelleSteckt: 'HDMI', senkeSteckt: 'Micro-HDMI' }).art,
    ).toBe('passt')
  })

  it('ueber der erklaerten Grenze: passt-nicht', () => {
    const u = beurteileAdapter(
      { ...HDMI_AUF_MICRO, hoechsterStandard: 'HDMI-1.4' },
      { quelleSteckt: 'Micro-HDMI', senkeSteckt: 'HDMI', verlangt: 'HDMI-2.1' },
    )
    expect(u.art).toBe('passt-nicht')
    expect(u.text).toContain('HDMI-1.4')
  })

  it('unter der erklaerten Grenze: passt', () => {
    expect(
      beurteileAdapter(
        { ...HDMI_AUF_MICRO, hoechsterStandard: 'HDMI-2.1' },
        { quelleSteckt: 'Micro-HDMI', senkeSteckt: 'HDMI', verlangt: 'HDMI-1.4' },
      ).art,
    ).toBe('passt')
  })
})

describe('Was nicht erklaert ist, bekommt keinen gruenen Haken', () => {
  it('die Voraussetzung an der Quelle ist NICHT bestaetigt: offen', () => {
    // Genau der Fall aus dem Wunsch des Eigentuemers. Zwei USB-C-Buchsen
    // sehen gleich aus; nur eine traegt ein Bild.
    const u = beurteileAdapter(USBC_AUF_DP, {
      quelleSteckt: 'USB-C',
      senkeSteckt: 'DisplayPort',
    })
    expect(u.art).toBe('offen')
    expect(u.text).toContain('DisplayPort Alternate Mode')
  })

  it('erst die ERKLAERUNG am Quellgeraet macht daraus ein passt', () => {
    expect(
      beurteileAdapter(USBC_AUF_DP, {
        quelleSteckt: 'USB-C',
        senkeSteckt: 'DisplayPort',
        quelleKann: ['DisplayPort Alternate Mode'],
      }).art,
    ).toBe('passt')
  })

  it('und ein Merkmal mit anderer Schreibung zaehlt trotzdem', () => {
    expect(
      beurteileAdapter(USBC_AUF_DP, {
        quelleSteckt: 'USB-C',
        senkeSteckt: 'DisplayPort',
        quelleKann: ['  displayport alternate MODE '],
      }).art,
    ).toBe('passt')
  })

  it('eine fehlende Richtung ist kein passt', () => {
    expect(
      beurteileAdapter(
        { von: 'HDMI', nach: 'DisplayPort', richtung: 'unbekannt', speisung: 'unbekannt' },
        { quelleSteckt: 'HDMI', senkeSteckt: 'DisplayPort' },
      ).art,
    ).toBe('offen')
  })

  it('ein Befund geht der fehlenden Angabe VOR', () => {
    // Sonst verdeckte eine fehlende Richtung einen Adapter, der mechanisch
    // gar nicht passt — und der Nutzer sieht „nicht erklaert" statt „falsch".
    expect(
      beurteileAdapter(
        { von: 'HDMI', nach: 'DisplayPort', richtung: 'unbekannt', speisung: 'unbekannt' },
        { quelleSteckt: 'XLR', senkeSteckt: 'BNC' },
      ).art,
    ).toBe('passt-nicht')
  })
})

describe('Standards werden nur innerhalb ihrer Familie verglichen', () => {
  it('innerhalb: geordnet', () => {
    expect(vergleicheStandard('HDMI-1.4', 'HDMI-2.1')).toBe('unterhalb')
    expect(vergleicheStandard('SDI-12G', 'SDI-3G')).toBe('oberhalb')
    expect(vergleicheStandard('DP-1.4', 'DP-1.4')).toBe('gleich')
  })

  it('ueber Familien hinweg: nicht vergleichbar, statt geraten', () => {
    // „Ist HDMI-2.0 mehr als DP-1.4?" hat keine Antwort, die stimmt. Eine
    // Zahl dafuer waere erfunden, und sie stuende dann in einem Befund.
    expect(vergleicheStandard('HDMI-2.0', 'DP-1.4')).toBe('nicht-vergleichbar')
    expect(vergleicheStandard('SDI-3G', 'Dante')).toBe('nicht-vergleichbar')
  })

  it('und eine unvergleichbare Grenze ergibt offen, nicht passt', () => {
    const u = beurteileAdapter(
      { ...HDMI_AUF_MICRO, hoechsterStandard: 'HDMI-2.0' },
      { quelleSteckt: 'Micro-HDMI', senkeSteckt: 'HDMI', verlangt: 'DP-1.4' },
    )
    expect(u.art).toBe('offen')
  })
})

describe('Ein halber Datensatz ergibt keinen gruenen Haken', () => {
  it('ohne Richtung wird auf unbekannt heruntergesetzt, nicht durchgelassen', () => {
    // DIE GEFAEHRLICHE RICHTUNG. Ohne Heilung ist `spec.richtung ===
    // 'unbekannt'` schlicht `false`, und die Beurteilung faellt bis ans Ende
    // durch — auf `passt`. Ein fehlendes Feld ergaebe einen gruenen Haken.
    const geheilt = normalisiereAdapter({ von: 'HDMI', nach: 'DisplayPort' })
    expect(geheilt?.richtung).toBe('unbekannt')
    expect(geheilt?.speisung).toBe('unbekannt')
    expect(
      beurteileAdapter(geheilt!, { quelleSteckt: 'HDMI', senkeSteckt: 'DisplayPort' }).art,
    ).toBe('offen')
  })

  it('ein unbekannter Wert wird nicht uebernommen', () => {
    const geheilt = normalisiereAdapter({
      von: 'HDMI',
      nach: 'HDMI',
      richtung: 'irgendwas',
      speisung: 42,
    })
    expect(geheilt?.richtung).toBe('unbekannt')
    expect(geheilt?.speisung).toBe('unbekannt')
  })

  it('ohne Steckerseite faellt der Datensatz ganz weg', () => {
    // „Adapter undefined ↔ undefined" auf einem Blatt ist schlimmer als kein
    // Eintrag: es sieht aus wie eine Angabe.
    expect(normalisiereAdapter({ nach: 'HDMI' })).toBeUndefined()
    expect(normalisiereAdapter({ von: 'HDMI' })).toBeUndefined()
    expect(normalisiereAdapter(null)).toBeUndefined()
    expect(normalisiereAdapter('Adapter')).toBeUndefined()
  })

  it('leere Merkmale werden zu undefined und nicht zu []', () => {
    // Beide bedeuten „nicht erklaert". Zwei Schreibweisen fuer dieselbe
    // Aussage liessen jeden Vergleich zweimal danach fragen.
    expect(normalisiereKann([])).toBeUndefined()
    expect(normalisiereKann(['  ', ''])).toBeUndefined()
    expect(normalisiereKann(['a', 1, ' b '])).toEqual(['a', 'b'])
    expect(normalisiereKann('a')).toBeUndefined()
  })
})

describe('Der Adapter steht genau einmal auf der Packliste', () => {
  it('ein erklaerter Adapter verdraengt die geratene Zeile', () => {
    // `zwei-rechnungen` in Reinform, und der Schaden ist konkret: die
    // Kommissionierung packt zwei, oder sie sieht zwei Zeilen und streicht
    // die falsche. Die geratene Zeile ist die SCHWAECHERE Aussage — sie ist
    // aus einem Mangel gebaut — und weicht deshalb.
    const src = readFileSync(
      resolve(__dirname, '..', 'src', 'renderer', 'lib', 'planDemandExtras.ts'),
      'utf8',
    )
    expect(src).toContain('adapterPortIds')
    expect(src).toMatch(
      /if \(adapterPortIds\.has\(c\.fromPortId\) \|\| adapterPortIds\.has\(c\.toPortId\)\) continue/,
    )
  })

  it('und die Bezeichnung kommt aus EINER Quelle', () => {
    // Zwei Fassungen desselben Namens waeren dieselbe Sorte Fehler: auf der
    // Kiste stuende ein anderer als im Plan.
    expect(adapterBezeichnung(USBC_AUF_DP)).toBe('Adapter USB-C auf DisplayPort')
    expect(adapterBezeichnung(HDMI_AUF_MICRO)).toBe('Adapter Micro-HDMI ↔ HDMI')
  })
})
