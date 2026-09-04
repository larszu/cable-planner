import { describe, expect, it } from 'vitest'
import dictSrc from '../src/renderer/lib/i18n/dicts.ts?raw'

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

const lines = dictSrc.split('\n')
const deStart = lines.findIndex((l) => l.startsWith('export const de'))

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

describe('das deutsche Woerterbuch ist deutsch', () => {
  it('findet beide Abschnitte (sonst prueft der Test nichts)', () => {
    expect(deStart).toBeGreaterThan(0)
    expect(parse(lines.slice(deStart)).size).toBeGreaterThan(20)
  })

  it('kein deutscher Wert ist eine woertliche Kopie des englischen', () => {
    const en = parse(lines.slice(0, deStart))
    const de = parse(lines.slice(deStart))
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
    const de = parse(lines.slice(deStart))
    const notizen = [...de].filter(([k]) => /^catalog\.cable\..*\.notes$/.test(k))
    expect(notizen.length).toBeGreaterThan(5)
    for (const [k, v] of notizen) {
      expect(/\b(the|with|for|and|Use|use|required|needs|limited)\b/.test(v), `${k} klingt englisch: ${v}`).toBe(false)
    }
  })
})
