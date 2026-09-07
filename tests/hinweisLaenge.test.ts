import { describe, expect, it } from 'vitest'
import ts from 'typescript'

// ── Lange Erklaersaetze stehen hinter „mehr" ───────────────────────────────
//
// Nutzer-Rueckmeldung 2026-09-07: „Auch viele schriftliche Informationen die
// ueberladen wirken aus Enduser-Ansicht." `PanelHint` ist die Antwort darauf:
// der erste Satz bleibt sichtbar, die Begruendung steht hinter „mehr". Ohne
// Guard waere das eine einmalige Aufraeumaktion — der naechste lange Absatz
// entstuende wieder als blankes `<p>`, und niemand faellt darueber.
//
// GEPRUEFT WIRD NUR, WAS DAUERHAFT IM WEG STEHT. Ein Leerzustand („Kein ATEM
// im Plan …") ist der GANZE Inhalt des Fensters; ihn zu kuerzen macht ein
// leeres Blatt noch leerer. Er wird deshalb erkannt (zentriert gesetzt oder
// mit „Kein"/„Keine"/„Noch kein" beginnend) und ausgenommen.

const roh = import.meta.glob('../src/renderer/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Ab hier gilt ein Absatz als lang. Gemessen am laengsten Text-Literal. */
const GRENZE = 140

/**
 * Absaetze, die aus mehreren Teilen bestehen — Text plus `<code>`, `<strong>`
 * oder ein zweiter `t()`-Aufruf. `PanelHint` nimmt EINEN String; sie
 * zusammenzuziehen hiesse, die Hervorhebung zu verlieren. Wer hier etwas
 * eintraegt, sagt: dieser Absatz traegt Auszeichnung im Text.
 */
const ZUSAMMENGESETZT = new Set([
  'components/Import/GraphmlImportDialog.tsx',
  'components/Inventory/InventoryDialog.tsx',
  'components/Print/PrintDialog.tsx',
])

interface Fund {
  datei: string
  zeile: number
  laenge: number
  text: string
}

const suche = (): { funde: Fund[]; absaetze: number } => {
  const funde: Fund[] = []
  let absaetze = 0
  for (const [pfad, src] of Object.entries(roh)) {
    const kurz = pfad.replace(/^.*\/src\/renderer\//, '')
    if (!/<p[\s>]/.test(src)) continue
    const sf = ts.createSourceFile(kurz, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const lauf = (node: ts.Node): void => {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === 'p') {
        absaetze += 1
        let text = ''
        const sammle = (k: ts.Node): void => {
          if (
            (ts.isStringLiteral(k) || ts.isNoSubstitutionTemplateLiteral(k)) &&
            k.text.length > text.length
          ) {
            text = k.text
          }
          if (ts.isJsxText(k) && k.text.trim().length > text.length) text = k.text.trim()
          ts.forEachChild(k, sammle)
        }
        ts.forEachChild(node, sammle)
        const eltern = node.parent?.getText ? node.parent.getText(sf).slice(0, 200) : ''
        const leerzustand =
          /text-center|m-auto/.test(eltern) || /^(Kein|Keine|Noch kein)/.test(text)
        if (text.length >= GRENZE && !leerzustand && !ZUSAMMENGESETZT.has(kurz)) {
          funde.push({
            datei: kurz,
            zeile: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            laenge: text.length,
            text: text.slice(0, 60),
          })
        }
      }
      ts.forEachChild(node, lauf)
    }
    lauf(sf)
  }
  return { funde, absaetze }
}

describe('lange Erklaersaetze benutzen PanelHint', () => {
  it('sieht ueberhaupt Absaetze (sonst prueft dieser Test nichts)', () => {
    const { absaetze } = suche()
    expect(absaetze).toBeGreaterThan(100)
  })

  it('findet kein blankes <p> mit mehr als 140 Zeichen', () => {
    const { funde } = suche()
    const liste = funde.map((f) => `${f.datei}:${f.zeile} (${f.laenge}): ${f.text}`)
    expect(liste, `Absaetze ohne PanelHint: ${liste.join(' | ')}`).toEqual([])
  })
})
