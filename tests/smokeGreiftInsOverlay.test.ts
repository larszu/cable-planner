import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ───────────────────────────────────────────────────────────────────────────
// Der UI-Smoke sucht seinen Abweisen-Knopf IM Overlay — und im obersten.
//
// GEMESSEN am 2026-09-11 (cable#852): `npm run ui:smoke` fiel mit „2
// Backdrop(s) offen" aus, ausgeloest von einer Aenderung, die kein Overlay
// anfasst. Zwei schwebende Leisten des Plans bekamen einen Schliessen-Knopf,
// beschriftet „Close toolbar …" und „Close search …". Die Abweisungs-Liste
// im Smoke enthaelt `Close`; `getByRole` suchte im GANZEN Fenster und
// `.first()` traf ab da die neuen Knoepfe. Der Lauf machte Leisten zu, die
// nicht im Weg standen, und liess das Overlay stehen.
//
// ─── WOGEGEN DIESER LAUF STEHT ────────────────────────────────────────────
//
// Nicht gegen die beiden Knoepfe. Gegen die Form: ein Abweisen-Klick, der
// IRGENDEINEN Knopf mit passender Beschriftung im Fenster trifft, prueft
// nicht das Overlay, sondern den Wortschatz der ganzen App — und der waechst
// mit jeder Schaltflaeche, die „Close" oder „Schliessen" heisst.
//
// Und gegen die zweite Haelfte davon: das Overlay nach DOM-Reihenfolge
// auszuwaehlen. Beim Erststart stehen drei gleichzeitig, und die
// DOM-Reihenfolge sagt nicht, welches oben liegt (gemessen: z=50 / z=60 /
// z=50). Ein Klick ins untere laeuft in einen Timeout, weil das obere davor
// liegt — sechs Runden lang, ohne dass irgendetwas davon in der Fehlermeldung
// steht.
//
// ─── WAS ER NICHT KANN ────────────────────────────────────────────────────
//
// Er liest Quelltext. Ob der Smoke durchkommt, misst der Smoke selbst —
// `npm run ui:smoke`, in CI im Job `ui-smoke`. Dieser Lauf hier ist der
// schnelle Vorposten: er faellt in Sekunden statt nach einem Electron-Build.
// ───────────────────────────────────────────────────────────────────────────

const smoke = readFileSync(resolve(__dirname, '..', 'scripts/ui-smoke.mjs'), 'utf8')

/** Der Block, in dem das Erststart-Overlay weggeklickt wird. */
const block = smoke.slice(smoke.indexOf('const overlayWeg'), smoke.indexOf('await overlayWeg()'))

describe('der Abweisen-Klick bleibt im Overlay', () => {
  it('der Block ist ueberhaupt da', () => {
    // Sonst pruefen alle folgenden Zusicherungen gegen den leeren String:
    // `toContain` waere rot aus dem falschen Grund, `not.toContain` still
    // gruen.
    expect(block.length).toBeGreaterThan(200)
    expect(block).toContain('getByRole')
  })

  it('gesucht wird unter einem .cp-modal-backdrop, nicht auf der Seite', () => {
    expect(block).toContain(".locator('.cp-modal-backdrop')")
    expect(
      /win\.getByRole\(\s*'button'/.test(block),
      'sucht den Abweisen-Knopf im ganzen Fenster statt im Overlay',
    ).toBe(false)
  })

  it('das Overlay wird nach z-index gewaehlt, nicht nach DOM-Reihenfolge', () => {
    expect(block).toContain('zIndex')
    // `.first()`/`.last()` auf der Backdrop-Liste waere genau die
    // DOM-Reihenfolge, gegen die dieser Lauf steht. Auf dem KNOPF ist
    // `.first()` in Ordnung — dort ist die Liste schon auf ein Overlay
    // eingegrenzt.
    expect(/cp-modal-backdrop'\)\.(first|last)\(\)/.test(block), 'waehlt nach DOM-Reihenfolge').toBe(
      false,
    )
  })

  it('es gibt mehr Runden als gleichzeitig stehende Overlays', () => {
    // Gemessen stehen beim Erststart drei, und das Abweisen des
    // Welcome-Dialogs startet die Tour erst danach. Wer die Rundenzahl
    // wieder auf die alten sechs setzt, hat keine Reserve mehr.
    const runden = block.match(/runde\s*<\s*(\d+)/)
    expect(runden, 'keine Rundenschleife gefunden').not.toBeNull()
    expect(Number(runden![1])).toBeGreaterThanOrEqual(8)
  })

  it('der Lauf scheitert laut, statt still weiterzulaufen', () => {
    // Ohne das folgt ein 30-Sekunden-Timeout beim ersten Menue-Klick, und
    // der sagt nichts ueber die Ursache.
    expect(smoke).toContain('Erststart-Overlay liess sich nicht schliessen')
  })
})
