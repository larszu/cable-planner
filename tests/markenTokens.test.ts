import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// `?raw` liefert fuer CSS einen leeren String — Vite behandelt Stylesheets
// gesondert. Gelesen wird deshalb die Datei selbst, so wie die uebrigen
// Quell-Waechter in diesem Ordner es tun.
const css = readFileSync(resolve(__dirname, '..', 'src/renderer/index.css'), 'utf8')

// ───────────────────────────────────────────────────────────────────────────
// ADR-007 (av-planner-suite) — „die UI ist nicht konsistent. lege globale UI
// Regeln fest, die für alle Repos gelten."
//
// Die Werte stehen maschinenlesbar in `@avplan/ui` (`src/brand.ts`), aber der
// Cable-Planner hängt nicht an diesem Paket — er wird in die Suite vendoriert,
// nicht umgekehrt. Dieser Test trägt die Werte deshalb ein zweites Mal, und
// das ist Absicht: ohne ihn wäre der Rückweg nach Tailwind-`slate` eine
// Zeile, die niemandem auffällt. Er ist die Instanz, die widerspricht.
//
// Was er NICHT prüft: ob die Werte gut sind. Das entscheidet das
// Marken-Handbuch, nicht ein Test.
// ───────────────────────────────────────────────────────────────────────────

const MARKE = {
  deepNavy: '#132040',
  zumpeNavy: '#1D324F',
  offWhite: '#F6F5F0',
  eisblau: '#E1ECEF',
  stahlblau: '#8C9CB3',
  tallyRot: '#D6402E',
}

/**
 * Der Wert eines Tokens VOR dem Light-Override — also alles, was oberhalb
 * von `[data-theme="light"]` steht: die `@theme`-Bloecke (Radius, Typo) und
 * der `:root`-Block (Farben).
 */
const dark = (name: string): string => {
  const block = css.slice(0, css.indexOf('[data-theme="light"] {'))
  const m = block.match(new RegExp(`${name}:\\s*([^;]+);`))
  return m ? m[1].trim() : ''
}

describe('die Farb-Tokens zeigen auf die Marke, nicht auf Tailwind', () => {
  it('trägt Deep Navy als Grund und Zumpe Navy als Fläche', () => {
    expect(dark('--cp-bg')).toBe(MARKE.deepNavy)
    expect(dark('--cp-surface-2')).toBe(MARKE.zumpeNavy)
  })

  it('setzt Eisblau als Fließtext und Off-White als Hervorhebung', () => {
    expect(dark('--cp-text')).toBe(MARKE.eisblau)
    expect(dark('--cp-text-bright')).toBe(MARKE.offWhite)
  })

  it('nutzt Stahlblau für Gedämpftes', () => {
    expect(dark('--cp-text-muted')).toBe(MARKE.stahlblau)
  })

  it('führt kein --cp-Token mehr über die slate-Palette', () => {
    const block = css.slice(css.indexOf(':root {'), css.indexOf('[data-theme="light"] {'))
    const rueckfall = block
      .split('\n')
      .filter((z) => /^\s*--cp-(bg|surface|border|text|accent|warn|danger)/.test(z))
      .filter((z) => z.includes('var(--color-'))
    expect(rueckfall).toEqual([])
  })
})

describe('Rot ist das Signal, keine Farbe', () => {
  it('steht genau einmal — in der Definition von --cp-signal', () => {
    const treffer = css
      .split('\n')
      .filter((z) => z.toUpperCase().includes(MARKE.tallyRot))
      .map((z) => z.trim())
    expect(treffer.every((z) => z.startsWith('--cp-signal:'))).toBe(true)
  })

  it('trägt den Tastatur-Fokusring', () => {
    expect(css).toContain('outline: 2px solid var(--cp-signal)')
    expect(css).toContain('outline-offset: 3px')
  })

  it('ist nicht dasselbe wie Fehlerrot — anderer Ton, anderer Zweck', () => {
    expect(dark('--cp-danger').toUpperCase()).not.toBe(MARKE.tallyRot)
  })
})

describe('keine Rundungen, keine Verläufe', () => {
  it('setzt jede Radius-Stufe auf null', () => {
    for (const n of ['--radius-cp-control', '--radius-cp-card', '--radius-cp-modal']) {
      expect(dark(n)).toBe('0')
    }
  })

  it('kennt keinen Verlauf mehr — auch nicht auf dem Canvas-Grund', () => {
    expect(css).not.toMatch(/linear-gradient|radial-gradient/)
  })
})
