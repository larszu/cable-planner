import { describe, expect, it } from 'vitest'
import dictSrc from '../src/renderer/lib/i18n/dicts.ts?raw'
import deSrc from '../src/renderer/lib/i18n/de.ts?raw'

// Das deutsche Woerterbuch enthielt englische Texte -- und zwar nicht
// irgendwo, sondern bei den Kabel-Notizen. Die landen NICHT nur in der
// Oberflaeche: `CableDialog.tsx` loest `t(spec.notesKey, '')` auf und schreibt
// das Ergebnis in `Cable.notes`, also in die Projektdatei. Ein deutscher
// Nutzer bekam damit englische Notizen in seine eigenen Daten geschrieben.
//
// Es waren 11 Eintraege, und alle elf waren WOERTLICHE Kopien der englischen
// Fassung -- jemand hat sie beim Anlegen des de-Dicts uebernommen und nie
// uebersetzt. Eine Wortlisten-Heuristik fand davon nur 8; die restlichen drei
// kamen erst heraus, als dieser Test de gegen en verglich statt gegen eine
// Liste englischer Woerter. Deshalb steht hier der Vergleich und nicht die
// Heuristik.
//
// Dieser Test rechnet das aus dem Quelltext, statt es zu behaupten: kein
// Wert im de-Dict darf mit seinem en-Gegenstueck identisch sein, es sei denn,
// er steht ausdruecklich auf der Ausnahmeliste.

// SEIT E-28 (2026-09-09) liegen Quelle und Uebersetzung in ZWEI Dateien:
// `dicts.ts` traegt die englische Quellsprache, `i18n/de.ts` die deutsche
// Uebersetzung. Vorher standen beide untereinander in `dicts.ts`, und dieser
// Test schnitt sie an der Zeile `export const de` auseinander. Die Frage
// bleibt dieselbe — sie wird nur ueber zwei Dateien gestellt.
const lines = dictSrc.split('\n')
const deLines = deSrc.split('\n')

/** Sammelt Schluessel -> Wert aus einem Abschnitt (Wert darf in der naechsten Zeile stehen). */
const parse = (region: string[]): Map<string, string> => {
  const out = new Map<string, string>()
  for (let i = 0; i < region.length; i += 1) {
    const m = /^(\s*)'([\w.\-]+)':\s*(.*)$/.exec(region[i])
    if (!m) continue
    let raw = m[3].trim()
    if (raw === '') raw = (region[i + 1] ?? '').trim()
    raw = raw.replace(/,$/, '').trim()
    if (raw.startsWith("'") && raw.endsWith("'")) out.set(m[2], raw.slice(1, -1))
  }
  return out
}

/**
 * Werte, die in beiden Sprachen absichtlich gleich sind -- Eigennamen,
 * Einheiten, Protokollnamen. Wer hier etwas eintraegt, sagt: das ist auf
 * Deutsch wirklich dasselbe Wort.
 */
const GLEICH_ERLAUBT = new Set<string>([])

/** Nur die Katalog-Schluessel — siehe die Begruendung im Test unten. */
const nurKatalog = (m: Map<string, string>) =>
  new Map([...m].filter(([k]) => k.startsWith('catalog.')))

describe('das deutsche Woerterbuch ist deutsch', () => {
  it('findet beide Woerterbuecher (sonst prueft der Test nichts)', () => {
    expect(parse(lines).size, 'Quell-Woerterbuch leer').toBeGreaterThan(20)
    expect(parse(deLines).size, 'de-Woerterbuch leer').toBeGreaterThan(20)
  })

  it('kein deutscher Wert ist eine woertliche Kopie des englischen', () => {
    const en = parse(lines)
    const de = nurKatalog(parse(deLines))

    // NUR DIE KATALOG-SCHLUESSEL, und das ist seit E-28 eine Einschraenkung
    // und keine Nachlaessigkeit.
    //
    // Vorher war das deutsche Woerterbuch eine kurze UEBERSCHREIBUNGS-Liste
    // von 49 Eintraegen — fast alle `catalog.*`. Ein Wert darin, der mit dem
    // englischen uebereinstimmte, war zwangslaeufig eine vergessene
    // Uebersetzung; genau so lagen elf Kabel-Notizen auf Englisch in den
    // Projektdateien deutscher Nutzer.
    //
    // Seit der Drehung ist `de` die VOLLSTAENDIGE Uebersetzung mit 4576
    // Eintraegen, und dort ist Gleichheit oft richtig: „CIDR", „Adapter",
    // „Build", „Repository", „DisplayPort Alternate Mode" heissen in beiden
    // Sprachen so. Ohne diese Einschraenkung meldete der Test tausende
    // Fachbegriffe — und ein Test, der bei richtigen Zeilen anschlaegt, wird
    // abgeschaltet.
    //
    // Der Schaden, gegen den er gebaut ist, sitzt weiterhin genau hier: was
    // unter `catalog.` steht, schreibt `CableDialog.tsx` ueber
    // `t(spec.notesKey, '')` in `Cable.notes` — also in die Projektdatei des
    // Nutzers und nicht nur auf den Schirm.
    const kopien: string[] = []
    for (const [key, deVal] of de) {
      if (GLEICH_ERLAUBT.has(key)) continue
      const enVal = en.get(key)
      if (enVal !== undefined && enVal === deVal && deVal.trim().length > 0) {
        kopien.push(`${key}: "${deVal.slice(0, 60)}"`)
      }
    }
    expect(kopien, `unuebersetzt im de-Dict:\n  ${kopien.join('\n  ')}`).toEqual([])
  })

  it('die Kabel-Notizen sind auf Deutsch — sie landen in der Projektdatei', () => {
    // `CableDialog` schreibt das aufgeloeste `notesKey`-Ergebnis in
    // `Cable.notes`. Was hier steht, steht spaeter im .cableplan des Nutzers.
    const de = parse(deLines)
    const notizen = [...de].filter(([k]) => /^catalog\.cable\..*\.notes$/.test(k))
    expect(notizen.length).toBeGreaterThan(5)
    for (const [k, v] of notizen) {
      expect(/\b(the|with|for|and|Use|use|required|needs|limited)\b/.test(v), `${k} klingt englisch: ${v}`).toBe(false)
    }
  })
})
