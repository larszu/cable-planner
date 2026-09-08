import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LAUSCHER_LAGE_LABEL,
  OSC_LAUSCHER_AUS,
  alterSekunden,
  empfangsText,
  normalisiereOscLauscher,
  type OscEmpfang,
} from '../src/renderer/types/showControl'
import {
  leseOscAdresse,
  nutzlastLaenge,
  startOscListener,
  stopOscListener,
} from '../src/main/services/oscListener'

/**
 * E-23 — der eingehende OSC-Weg.
 *
 * Der Eigentuemer hat ihn unter vier Auflagen erlaubt, und eine Bedingung
 * steht ueber allen: was aus einer eingehenden Nachricht auf den Schirm
 * kommt, ist eine EMPFANGSMELDUNG und nie ein Anlagenzustand. Dieser Waechter
 * prueft genau die Saetze, die anderswo als Zusicherung stehen — in
 * `types/showControl.ts` („wer hier ein Feld `zustand` ergaenzt … dieser Test
 * sagt es") und in `tests/deviceReadSites.test.ts` („die Mitschrift erreicht
 * den Projekt-Speicher nicht"). Ohne ihn waeren beide Zeilen Behauptungen.
 */

const wurzel = join(__dirname, '..')
const lies = (p: string): string => readFileSync(join(wurzel, p), 'utf8')

/**
 * Nur der Code, ohne Kommentare.
 *
 * Ein Waechter, der die BEGRUENDUNG mitliest, wird an dem Satz rot, der ihn
 * erklaert — hier stand „die Typkennungen zu entziffern hiesse …" im
 * Kommentar, und genau danach suchte er. Er wird geaendert statt gelesen.
 */
const nurCode = (p: string): string =>
  lies(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((z) => !z.trim().startsWith('//'))
    .join('\n')

const paket = (adresse: string, nutzlast = 0): Uint8Array => {
  const belegt = Math.ceil((adresse.length + 1) / 4) * 4
  const bytes = new Uint8Array(belegt + nutzlast)
  for (let i = 0; i < adresse.length; i += 1) bytes[i] = adresse.charCodeAt(i)
  return bytes
}

describe('Aus dem Paket kommt die Adresse — und sonst nichts', () => {
  it('liest die Adresse und meldet die Nutzlast als Laenge', () => {
    const p = paket('/cue/12/go', 8)
    const adresse = leseOscAdresse(p)
    expect(adresse).toBe('/cue/12/go')
    expect(nutzlastLaenge(p, adresse!)).toBe(8)
  })

  it('raet nicht, wenn das Paket keine Adresse hergibt', () => {
    // Ein Bundle beginnt mit `#bundle` — das ist keine Adresse.
    const bundle = new Uint8Array([0x23, 0x62, 0x75, 0x6e, 0x64, 0x6c, 0x65, 0x00])
    expect(leseOscAdresse(bundle)).toBeUndefined()
    expect(leseOscAdresse(new Uint8Array(0))).toBeUndefined()
    // Ein Steuerzeichen mitten in der Adresse heisst: hier steht keine.
    const kaputt = new Uint8Array([0x2f, 0x61, 0x07, 0x62, 0x00])
    expect(leseOscAdresse(kaputt)).toBeUndefined()
  })

  it('macht aus den Argumenten keine Werte', () => {
    // Die Kern-Auflage aus E-23, und sie ist im Code pruefbar: es gibt keine
    // Funktion, die Typkennungen entziffert oder aus fremden Bytes Zahlen
    // liest. Eine falsch gelesene Zahl saehe aus wie eine Messung — dieselbe
    // Ueberlegung wie bei Invariante 23 (EDID).
    const quelle = nurCode('src/main/services/oscListener.ts')
    expect(quelle).not.toMatch(/readInt32|readFloat|readDouble|readUInt|getFloat|getInt/)
    // Auch die Typkennungs-Zeichenkette wird nicht ausgewertet.
    expect(quelle).not.toMatch(/typeTag|typkennung/i)
  })
})

describe('Eine Meldung ist ein Empfang, kein Zustand', () => {
  it('traegt kein Feld, das nach Anlagenzustand klingt', () => {
    // Die Zusicherung steht als Satz in `types/showControl.ts`. Hier wird sie
    // eingeloest — an der Form des Typs, nicht an einem Beispielwert.
    const eintrag: OscEmpfang = {
      adresse: '/cue/12/go',
      empfangenAm: '2026-09-08T14:22:07.000Z',
      absender: '10.0.0.9:53311',
      nutzlastBytes: 8,
    }
    expect(Object.keys(eintrag).sort()).toEqual([
      'absender',
      'adresse',
      'empfangenAm',
      'nutzlastBytes',
    ])
    const quelle = lies('src/renderer/types/showControl.ts')
    const feld = quelle.slice(
      quelle.indexOf('export interface OscEmpfang'),
      quelle.indexOf('/** Was der Lauscher tun soll'),
    )
    for (const verboten of ['zustand', 'status', 'bereit', 'ok:', 'gesund', 'live']) {
      expect(feld.toLowerCase()).not.toContain(verboten)
    }
  })

  it('sagt jede Meldung mit ihrem Alter an', () => {
    const eintrag: OscEmpfang = {
      adresse: '/cue/12/go',
      empfangenAm: '2026-09-08T14:22:07.000Z',
      absender: '10.0.0.9:53311',
      nutzlastBytes: 8,
    }
    expect(alterSekunden(eintrag.empfangenAm, '2026-09-08T14:22:17.000Z')).toBe(10)
    const text = empfangsText(eintrag, '2026-09-08T16:22:07.000Z')
    // Zwei Stunden alt — und der Satz sagt es, statt auszusehen wie von eben.
    expect(text).toContain('14:22:07')
    expect(text).toContain('7200')
    expect(text).toContain('10.0.0.9:53311')
  })

  it('zeigt die Mitschrift ohne Ampelfarben', () => {
    // Gruen/rot ueber einer Empfangsliste waere die Entwarnung durch die
    // Hintertuer: es saehe aus wie eine Aussage ueber die Anlage.
    const panel = lies('src/renderer/components/ShowControl/OscEmpfangPanel.tsx')
    expect(panel).not.toMatch(/cp-(ok|good|success)|text-green|bg-green|text-emerald/)
  })

  it('erreicht den Projekt-Speicher nicht', () => {
    // Die Zusicherung aus `tests/deviceReadSites.test.ts`, hier eingeloest.
    // Der Plan traegt die KONFIGURATION des Lauschers (`oscLauscher`) — was
    // hereinkam, traegt er nie. Sonst stuende die Mitschrift eines Abends im
    // Projekt-File und saehe beim naechsten Oeffnen aus wie ein Befund.
    const store = lies('src/renderer/store/projectStore.ts')
    const projektTyp = lies('src/renderer/types/project.ts')
    for (const quelle of [store, projektTyp]) {
      expect(quelle).not.toMatch(/OscEmpfang|oscMeldungen|empfangenAm/)
    }
    const slices = lies('src/renderer/store/slices/conductorSlice.ts')
    expect(slices).not.toMatch(/OscEmpfang|oscMeldungen/)
  })
})

describe('Der Lauscher ist aus, bis jemand ihn einschaltet', () => {
  it('ist als Vorgabe aus und ohne Adresse', () => {
    // Auflagen 1 und 2. `0.0.0.0` waere eine Entscheidung, die niemand
    // getroffen hat — sie lauscht auch auf der Schnittstelle im Kundennetz.
    expect(OSC_LAUSCHER_AUS.aktiv).toBe(false)
    expect(OSC_LAUSCHER_AUS.adresse).toBe('')
    expect(OSC_LAUSCHER_AUS.adresse).not.toBe('0.0.0.0')
  })

  it('glaubt einer fremden Projektdatei keine Adresse', () => {
    // Auflage 3 gilt auch fuer eine `.avplan` von einem anderen Rechner: dort
    // steht eine Adresse, die es HIER nicht gibt. Ohne Adresse ist der
    // Lauscher aus — nicht „an, aber ungebunden".
    expect(normalisiereOscLauscher({ aktiv: true, adresse: '', port: 9000 }).aktiv).toBe(false)
    expect(normalisiereOscLauscher({ aktiv: true, adresse: '  ', port: 9000 }).aktiv).toBe(false)
    const echt = normalisiereOscLauscher({ aktiv: true, adresse: '127.0.0.1', port: 9001 })
    expect(echt).toEqual({ aktiv: true, adresse: '127.0.0.1', port: 9001 })
    expect(normalisiereOscLauscher(undefined)).toEqual(OSC_LAUSCHER_AUS)
    expect(normalisiereOscLauscher({ aktiv: true, adresse: '127.0.0.1', port: 0 }).port).toBe(
      OSC_LAUSCHER_AUS.port,
    )
  })

  it('meldet sich auch dann, wenn nicht gebunden werden konnte', async () => {
    // Auflage 4, die wichtigste: ein stiller Nicht-Empfang sieht aus wie
    // „keine Cues". `startOscListener` gibt IMMER einen Zustand zurueck.
    const ohneAdresse = await startOscListener({ aktiv: true, adresse: '', port: 9000 })
    expect(ohneAdresse.lage).toBe('nicht-gebunden')
    expect(ohneAdresse.grund).toBeTruthy()

    const falscherPort = await startOscListener({ aktiv: true, adresse: '127.0.0.1', port: 0 })
    expect(falscherPort.lage).toBe('nicht-gebunden')
    expect(falscherPort.grund).toBeTruthy()

    const aus = await startOscListener({ aktiv: false, adresse: '127.0.0.1', port: 9000 })
    expect(aus.lage).toBe('aus')
    stopOscListener()
  })

  it('hat fuer jede Lage ein Wort', () => {
    expect(Object.keys(LAUSCHER_LAGE_LABEL).sort()).toEqual(['aus', 'lauscht', 'nicht-gebunden'])
  })
})

describe('Die Typ-Kopie im Hauptprozess ist wirklich dieselbe', () => {
  it('haelt die vier Felder von OscEmpfang in beiden Fassungen gleich', () => {
    // Der Hauptprozess baut gegen eine eigene tsconfig und darf nicht in den
    // Renderer-Baum hineinreichen (Praezedenz: `switcherControl/types.ts`).
    // Die Kopie ist damit erlaubt — aber nur, solange jemand sie festhaelt.
    const felder = (quelle: string, name: string): string[] => {
      const start = quelle.indexOf(`export interface ${name} {`)
      expect(start).toBeGreaterThanOrEqual(0)
      const ende = quelle.indexOf('\n}', start)
      return quelle
        .slice(start, ende)
        .split('\n')
        .map((z) => z.trim())
        .filter((z) => /^[a-zA-Z]+\??:/.test(z))
        .map((z) => z.split(/[?:]/)[0])
        .sort()
    }
    const renderer = lies('src/renderer/types/showControl.ts')
    const main = lies('src/main/services/oscListener.ts')
    for (const name of ['OscEmpfang', 'OscLauscherConfig', 'LauscherZustand']) {
      expect(felder(main, name)).toEqual(felder(renderer, name))
    }
  })
})
