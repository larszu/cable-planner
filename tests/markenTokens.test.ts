import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import logoSrc from '../src/renderer/components/Brand/LzmLogo.tsx?raw'
import switchSrc from '../src/renderer/components/shared/ThemeSwitch.tsx?raw'
import appearanceSrc from '../src/renderer/components/Settings/tabs/AppearanceTab.tsx?raw'
import { stripComments } from './support/stripComments'

// `?raw` liefert fuer CSS einen leeren String — Vite behandelt Stylesheets
// gesondert. Gelesen wird deshalb die Datei selbst.
const css = readFileSync(resolve(__dirname, '..', 'src/renderer/index.css'), 'utf8')

// ───────────────────────────────────────────────────────────────────────────
// WARUM ES DAS GIBT (umgebaut 2026-10-13, Design-Vertrag 2026-10 und das am
// selben Tag geaenderte ADR-007 in lz-planner-suite).
//
// Der Cable-Planner haengt nicht an `@avplan/ui` — er wird in die Suite
// vendoriert, nicht umgekehrt. Dieser Test traegt die Werte deshalb ein
// zweites Mal: ohne ihn waere der Rueckweg zu Tailwind-`slate` oder zu den
// Navy-Flaechen vom September eine Zeile, die niemandem auffaellt.
//
// Bis 2026-10-13 pruefte er „Deep Navy als Grund, Eisblau als Text, Radius
// null". Der Vertrag dreht das: Flaechen NEUTRAL (Anthrazit/Fast-Weiss),
// Markenblau nur als Akzent, Rundungen und Schatten ueber Tokens. Die
// Hex-Werte der Palette bleiben unveraendert und werden weiter geprueft.
//
// Was er NICHT prueft: ob die Werte gut sind. Das entscheidet der Vertrag.
// ───────────────────────────────────────────────────────────────────────────

const MARKE = {
  deepNavy: '#132040',
  zumpeNavy: '#1D324F',
  offWhite: '#F6F5F0',
  eisblau: '#E1ECEF',
  stahlblau: '#8C9CB3',
  tallyRot: '#D6402E',
}

const LIGHT_START = css.indexOf('[data-theme="light"] {')

/** Wert eines Tokens im Dunkel-Ausgangsblock (alles vor dem Light-Override). */
const dark = (name: string): string => {
  const m = css.slice(0, LIGHT_START).match(new RegExp(`${name}:\\s*([^;]+);`))
  return m ? m[1].trim() : ''
}

/** Wert eines Tokens im `[data-theme="light"]`-Block. */
const light = (name: string): string => {
  const block = css.slice(LIGHT_START, css.indexOf('}', LIGHT_START))
  const m = block.match(new RegExp(`${name}:\\s*([^;]+);`))
  return m ? m[1].trim() : ''
}

const norm = (v: string) => v.replace(/\s+/g, '').toUpperCase()

describe('die Palette bleibt unveraendert', () => {
  it('fuehrt die fuenf Markenfarben als --cp-brand-*', () => {
    expect(dark('--cp-brand-deep-navy')).toBe(MARKE.deepNavy)
    expect(dark('--cp-brand-navy')).toBe(MARKE.zumpeNavy)
    expect(dark('--cp-brand-off-white')).toBe(MARKE.offWhite)
    expect(dark('--cp-brand-eisblau')).toBe(MARKE.eisblau)
    expect(dark('--cp-brand-stahlblau')).toBe(MARKE.stahlblau)
  })
})

// Die Rollen aus dem Design-Vertrag 2026-10, in beiden Modi.
const ROLLEN: [token: string, hell: string, dunkel: string][] = [
  ['--cp-bg', '#FAFAF8', '#1E1F23'],
  ['--cp-surface-1', '#FFFFFF', '#28292E'],
  ['--cp-surface-2', '#F1F1EE', '#33343A'],
  ['--cp-surface-3', '#F4F4F1', '#19191D'],
  ['--cp-surface-raised', '#FFFFFF', '#3B3C42'],
  ['--cp-text-bright', '#16181D', '#F6F5F0'],
  ['--cp-text', '#2B2E35', '#E6E6E3'],
  ['--cp-text-muted', '#6A6E77', '#A9ACB4'],
  ['--cp-border', 'rgba(22,24,29,0.08)', 'rgba(246,245,240,0.09)'],
  ['--cp-border-strong', 'rgba(22,24,29,0.18)', 'rgba(246,245,240,0.2)'],
  ['--cp-accent', '#1D324F', '#B9C7D8'],
  ['--cp-accent-text', '#F6F5F0', '#132040'],
  ['--cp-accent-soft', 'rgba(29,50,79,0.1)', 'rgba(185,199,216,0.12)'],
  ['--cp-logo', '#1D324F', '#F6F5F0'],
  ['--cp-glow-1', 'rgba(29,50,79,0.1)', 'rgba(185,199,216,0.16)'],
]

describe('Flaechen sind neutral, Blau ist Akzent — in beiden Modi', () => {
  for (const [token, hell, dunkel] of ROLLEN) {
    it(`${token}: hell ${hell}, dunkel ${dunkel}`, () => {
      expect(norm(dark(token))).toBe(norm(dunkel))
      expect(norm(light(token))).toBe(norm(hell))
    })
  }

  it('Statusfarben gelten in beiden Modi', () => {
    expect(dark('--cp-ok')).toBe('#2F7D5C')
    expect(dark('--cp-warn')).toBe('#C8892B')
    expect(dark('--cp-danger')).toBe('#B04A3F')
    expect(light('--cp-ok')).toBe('')
    expect(light('--cp-warn')).toBe('')
  })

  it('kein Grund und keine Flaeche ist mehr Navy', () => {
    for (const t of ['--cp-bg', '--cp-surface-1', '--cp-surface-2', '--cp-surface-3']) {
      expect([MARKE.deepNavy, MARKE.zumpeNavy]).not.toContain(dark(t).toUpperCase())
    }
  })

  it('fuehrt kein --cp-Token mehr ueber die slate-Palette', () => {
    const block = css.slice(css.indexOf(':root {'), LIGHT_START)
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
    expect(treffer).toHaveLength(1)
    expect(treffer[0].startsWith('--cp-signal:')).toBe(true)
  })

  it('traegt den Tastatur-Fokusring', () => {
    expect(css).toContain('outline: 2px solid var(--cp-signal)')
    expect(css).toContain('outline-offset: 3px')
  })

  it('ist nicht dasselbe wie Fehlerrot — anderer Ton, anderer Zweck', () => {
    expect(dark('--cp-danger').toUpperCase()).not.toBe(MARKE.tallyRot)
  })
})

describe('das Logo traegt nur Kit-Farben', () => {
  it('das Signet faerbt sich ueber --cp-logo, der Punkt ist das Signal', () => {
    const src = stripComments(logoSrc)
    expect(src).toContain('fill="var(--cp-logo)"')
    expect(src).toContain('fill="var(--cp-signal)"')
    expect(src).not.toMatch(/cp-accent/)
  })
})

describe('Form und Tiefe kommen aus Tokens', () => {
  it('Radius-Stufen nach Vertrag: 6 · 10 · 20 · 24 · voll', () => {
    expect(dark('--radius-cp-s')).toBe('6px')
    expect(dark('--radius-cp-control')).toBe('10px')
    expect(dark('--radius-cp-card')).toBe('20px')
    expect(dark('--radius-cp-modal')).toBe('24px')
    expect(dark('--radius-cp-full')).toBe('999px')
    expect(dark('--cp-r-s')).toBe('6px')
    expect(dark('--cp-r-m')).toBe('10px')
    expect(dark('--cp-r-l')).toBe('20px')
    expect(dark('--cp-r-xl')).toBe('24px')
  })

  it('drei weiche Schatten je Modus', () => {
    expect(norm(dark('--cp-shadow-1'))).toBe(norm('0 1px 2px rgba(0, 0, 0, 0.3)'))
    expect(norm(dark('--cp-shadow-3'))).toBe(norm('0 16px 48px rgba(0, 0, 0, 0.55)'))
    expect(norm(light('--cp-shadow-1'))).toBe(norm('0 1px 2px rgba(22, 24, 29, 0.06)'))
    expect(norm(light('--cp-shadow-3'))).toBe(norm('0 16px 48px rgba(22, 24, 29, 0.14)'))
  })

  it('kein Verlauf hinter dem Canvas — der Schein ist nur fuer Leerflaechen', () => {
    const canvas = /#cable-planner-canvas\s*\{([^}]*)\}/.exec(stripComments(css))
    expect(canvas?.[1]).not.toMatch(/gradient/)
    const verlaeufe = stripComments(css).match(/radial-gradient|linear-gradient/g) ?? []
    expect(verlaeufe.length).toBe(2) // die beiden Scheine in `.cp-glow`
  })
})

describe('der Umschalter Auto · Hell · Dunkel ist sichtbar', () => {
  it('kennt alle drei Stellungen', () => {
    const src = stripComments(switchSrc)
    for (const v of ["'auto'", "'light'", "'dark'"]) expect(src).toContain(`value: ${v}`)
    expect(src).toContain('aria-pressed')
  })

  it('steht in Einstellungen → Darstellung', () => {
    expect(stripComments(appearanceSrc)).toMatch(/<ThemeSwitch\b/)
  })
})
