import { describe, expect, it } from 'vitest'
import deSrc from '../src/renderer/lib/i18n/de.ts?raw'
import { cableCatalog } from '../src/renderer/types/cableSpec'
import { VIDEO_FORMATS } from '../src/renderer/types/videoFormat'

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

// SEIT E-28 (2026-09-09) liegen Quelle und Uebersetzung getrennt. Erst in
// zwei Dateien (`dicts.ts` englisch, `i18n/de.ts` deutsch), seit #829 gar
// nicht mehr in einem Woerterbuch: die englische Quelle der Katalog-Notizen
// steht als `notesSource` NEBEN ihrem Schluessel im Katalog selbst.
//
// Der Grund war ein Defekt, kein Umbau: `CableDialog` loeste
// `t(spec.notesKey, '')` mit LEEREM Rueckfall auf, und weil Englisch seit
// E-28 bewusst nicht in der Registry steht, bekam jede Sprache ausser
// Deutsch dort nichts — geschrieben in `Cable.notes`, also in die
// Projektdatei. Die Frage dieses Tests bleibt dieselbe; sie wird nur an der
// Stelle gestellt, an der die Quelle jetzt wirklich liegt.
const deLines = deSrc.split('\n')

/** Die englische Quelle je Katalog-Schluessel — aus dem Katalog, nicht aus
 *  einem Woerterbuch. */
const quelle = new Map<string, string>(
  [...cableCatalog, ...VIDEO_FORMATS]
    .filter((e) => e.notesKey && e.notesSource)
    .map((e) => [e.notesKey as string, e.notesSource as string]),
)

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
  it('findet Quelle und Uebersetzung (sonst prueft der Test nichts)', () => {
    expect(quelle.size, 'Keine Katalog-Quelltexte gefunden').toBeGreaterThan(20)
    expect(parse(deLines).size, 'de-Woerterbuch leer').toBeGreaterThan(20)
  })

  it('kein deutscher Wert ist eine woertliche Kopie des englischen', () => {
    const en = quelle
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
    // `t(spec.notesKey, spec.notesSource)` in `Cable.notes` — also in die
    // Projektdatei des Nutzers und nicht nur auf den Schirm.
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
