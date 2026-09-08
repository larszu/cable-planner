import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LAYER_STYLES, STANDARD_LAYERS, styleForLayer } from '../src/renderer/lib/cableLayers'

// ───────────────────────────────────────────────────────────────────────────
// „Steuerpfade getrennt einfärben" (Eigentümer-Wunsch 2026-09-08).
//
// DER BEFUND DAHINTER. Die Layer-Farben gab es seit #123 — aber nur an den
// LEGENDEN-CHIPS. Auf dem Plan selbst kam keine davon vor: die Kanten nahmen
// `cable.color` oder die Längen-Codierung. Der Plan versprach also eine
// Farbcodierung, die er nicht einlöste, und wer nach dem gelben Control-Chip
// suchte, fand auf der Fläche nichts Gelbes.
//
// WARUM ALS EIGENER MODUS UND NICHT ALS VORGABE. Wer Kabel von Hand
// eingefärbt hat, soll sie nicht beim nächsten Start anders sehen. Und
// entscheidend: der Modus färbt nur die DARSTELLUNG — `cable.color` bleibt
// stehen. Ein Modus, der die gespeicherte Farbe überschreibt, nimmt dem
// Nutzer eine Angabe weg, um eine andere zu zeigen, und beim Zurückschalten
// wäre sie fort.
// ───────────────────────────────────────────────────────────────────────────

const lies = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8')

describe('Die Layer-Legende und die Fläche zeigen dieselben Farben', () => {
  it('jeder Standard-Layer hat eine Farbe, und `styleForLayer` liefert genau die', () => {
    for (const layer of STANDARD_LAYERS) {
      expect(styleForLayer(layer).color).toBe(LAYER_STYLES[layer].color)
    }
  })

  it('ein Unter-Layer erbt die Farbe seines Gewerks', () => {
    // `video.backup` ist Video. Sonst hätte ein Plan mit Sub-Layern lauter
    // graue Kanten, und die Legende stimmte wieder nicht.
    expect(styleForLayer('video.backup').color).toBe(LAYER_STYLES.video.color)
    expect(styleForLayer('audio.foh').color).toBe(LAYER_STYLES.audio.color)
  })

  it('ein Kabel ohne Layer wird wie „other" behandelt, nicht farblos', () => {
    expect(styleForLayer(undefined).color).toBe(LAYER_STYLES.other.color)
  })

  it('Control hat eine eigene Farbe — sonst wäre der Wunsch nicht erfüllt', () => {
    // „Steuerpfade getrennt einfärben" heisst: Control unterscheidet sich von
    // Video und Audio. Eine Tabelle mit doppelten Farben sähe vollständig aus
    // und wäre wertlos.
    const farben = STANDARD_LAYERS.map((l) => LAYER_STYLES[l].color)
    expect(new Set(farben).size).toBe(STANDARD_LAYERS.length)
  })
})

describe('Der Modus färbt, ohne zu überschreiben', () => {
  const canvas = lies('src/renderer/components/Canvas/CanvasArea.tsx')

  it('nimmt im Gewerk-Modus die Layer-Farbe', () => {
    expect(canvas).toContain("cableColorMode === 'byLayer'")
    expect(canvas).toContain('styleForLayer(item.layer).color')
  })

  it('schreibt dabei NICHT an `cable.color`', () => {
    // Der Modus lebt in der `edges`-Ableitung. Ein `updateCable(... color ...)`
    // in derselben Datei waere der Weg, auf dem die gespeicherte Farbe
    // verlorenginge.
    const ableitung = canvas.slice(canvas.indexOf('const edges = useMemo'), canvas.indexOf('const edges = useMemo') + 3000)
    expect(ableitung).not.toContain('updateCable')
    expect(ableitung).not.toMatch(/color:\s*styleForLayer/)
  })

  it('ist erreichbar — Einstellungen UND Ansichts-Menü', () => {
    // Ein Modus, den niemand findet, ist keiner. Dieselbe Form wie B-35.
    expect(lies('src/renderer/components/Settings/tabs/AppearanceTab.tsx')).toContain(
      "setCableColorMode('byLayer')",
    )
    expect(lies('src/renderer/components/Layout/MenuBar.tsx')).toContain("'byLayer'")
  })

  it('bleibt NICHT die Vorgabe', () => {
    // Wer Kabel von Hand eingefaerbt hat, soll sie nicht beim naechsten Start
    // anders sehen.
    expect(lies('src/renderer/store/uiStore.ts')).toContain("cableColorMode: 'manual',")
  })
})
