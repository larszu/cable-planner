// ───────────────────────────────────────────────────────────────────────────
// Die Erststart-Overlays wegklicken — EINMAL, fuer alle Laeufe, die die
// gebaute App starten.
//
// ─── WARUM DAS EINE DATEI IST UND NICHT VIER ──────────────────────────────
//
// Dieselbe Schleife stand am 2026-09-11 in SECHS Laeufen: `ui-smoke.mjs`,
// `ui-labels.mjs`, `ui-overflow.mjs`, `ui-targets.mjs`, `screenshots.mjs`
// und `drag-test.mjs` — sechs Abschriften derselben Regel, die meisten mit
// dem Kommentar „dieselbe Schleife wie in ui-smoke.mjs, und aus demselben
// Grund". Das ist die Defektform `zwei-rechnungen`, nur sechsmal: wer die
// Regel verbessert, verbessert eine Kopie, und die anderen fuenf bleiben
// falsch, ohne dass jemand es merkt.
//
// Und sie waren nicht einmal gleich. `screenshots.mjs` trug eine eigene,
// kuerzere Abweisungs-Liste; `drag-test.mjs` klickte zwei Regexe
// hintereinander ohne Schleife und ohne Blick auf den Backdrop, fasste
// also nicht nach, wenn das Abweisen des Welcome-Dialogs erst die Tour
// startet. Sechs Abschriften, mindestens drei verschiedene Regeln.
//
// Aufgefallen ist es an einer Aenderung am Plan (cable#852), die zwei
// schwebenden Leisten je einen Schliessen-Knopf gab. Der Lauf, der zuerst
// darueber stolperte, wurde repariert — die fuenf anderen Abschriften
// trugen den Fehler weiter, und der naechste faellt in CI und nicht hier.
//
// ─── WAS DIE REGEL SAGT, UND WARUM SIE SO AUSSIEHT ────────────────────────
//
// 1. GESUCHT WIRD IM OVERLAY, NICHT IM GANZEN FENSTER.
//    Ein `getByRole('button', { name: ABWEISUNGEN })` ueber die Seite trifft
//    JEDEN Knopf mit passender Beschriftung. Gemessen: die neuen „Close
//    toolbar …"/„Close search …" der schwebenden Leisten kamen in
//    DOM-Reihenfolge vor dem „End tour" der Tour, und `.first()` machte
//    Leisten zu, die nicht im Weg standen. Die Abweisungs-Liste prueft damit
//    nicht das Overlay, sondern den Wortschatz der ganzen App — und der
//    waechst mit jeder Schaltflaeche, die „Close" oder „Schliessen" heisst.
//    Jeder Dialog traegt seinen Abweisen-Knopf im `.cp-modal-backdrop`
//    (`ModalShell`), also verliert die Suche dort nichts.
//
// 2. GEWAEHLT WIRD NACH z-index, NICHT NACH DOM-REIHENFOLGE.
//    Beim Erststart stehen DREI Overlays gleichzeitig, und die
//    DOM-Reihenfolge sagt nicht, welches oben liegt (gemessen 2026-09-11):
//
//      DOM 0  z=50  „Getting-started tour · step 1 / 7"
//      DOM 1  z=60  „Welcome to Cable Planner"
//      DOM 2  z=50  „Welcome — what do you use Cable Planner for?"
//
//    Ein `.last()` greift den Segment-Dialog, dessen Knoepfe unter dem
//    Welcome-Dialog liegen: Runde um Runde Klick-Timeout, und in der
//    Fehlermeldung steht davon nichts. Ein `.first()` greift die Tour —
//    dieselbe Lage, andere Ecke. Bei Gleichstand gewinnt das spaetere im
//    DOM, so malt der Browser.
//
// 3. GESCHLEIFT WIRD AUF DEN ZUSTAND, NICHT AUF EINE FESTE ZAHL VERSUCHE.
//    Das Abweisen des Welcome-Dialogs startet die Tour erst — ein Overlay,
//    das spaeter dazukommt, muss auch erwischt werden. Acht Runden fuer drei
//    Overlays ist die Reserve dafuer.
//
// 4. GESCHEITERT WIRD LAUT.
//    Sonst folgt ein 30-Sekunden-Timeout beim ersten Menue-Klick, und der
//    sagt nichts ueber die Ursache.
//
// ─── WAS DIESE DATEI NICHT KANN ───────────────────────────────────────────
//
// Sie klickt weg, was sich wegklicken laesst. Ob ein Overlay ueberhaupt
// haette erscheinen sollen, misst sie nicht — dafuer ist der jeweilige Lauf
// zustaendig, der sie aufruft.
// ───────────────────────────────────────────────────────────────────────────

/** Beschriftungen, mit denen sich ein Erststart-Overlay abweisen laesst. */
export const ABWEISUNGEN =
  /End tour|Tour beenden|Beenden|Skip|Überspringen|Fertig|Decide later|Später|Schließen|Close/i

/**
 * Klickt die Erststart-Overlays (Welcome-Dialog, Segment-Frage, Tour) weg.
 *
 * @param {import('playwright-core').Page} win  Fenster der gestarteten App.
 * @param {{ runden?: number, lautScheitern?: boolean }} [opt]
 *   `lautScheitern: false` gibt statt eines Wurfs die Zahl der stehen
 *   gebliebenen Backdrops zurueck — fuer Aufrufer, die selbst entscheiden.
 * @returns {Promise<number>} Zahl der noch stehenden Backdrops (0 = frei).
 */
export const erststartOverlayWeg = async (win, opt = {}) => {
  const { runden = 8, lautScheitern = true } = opt

  /** Index des obersten Backdrops nach gerechnetem z-index, -1 wenn keines. */
  const oberstes = () =>
    win.evaluate(() =>
      [...document.querySelectorAll('.cp-modal-backdrop')]
        .map((el, i) => ({ i, z: Number.parseInt(getComputedStyle(el).zIndex, 10) || 0 }))
        .reduce((a, b) => (b.z >= a.z ? b : a), { i: -1, z: -Infinity }).i,
    )

  for (let runde = 0; runde < runden; runde++) {
    const oben = await oberstes()
    if (oben < 0) return 0
    const knopf = win
      .locator('.cp-modal-backdrop')
      .nth(oben)
      .getByRole('button', { name: ABWEISUNGEN })
    if (await knopf.count()) await knopf.first().click({ timeout: 1500 }).catch(() => {})
    await win.keyboard.press('Escape').catch(() => {})
    await win.waitForTimeout(400)
  }

  const rest = await win.locator('.cp-modal-backdrop').count()
  if (rest > 0 && lautScheitern) {
    throw new Error(
      `Erststart-Overlay liess sich nicht schliessen (${rest} Backdrop(s) offen). ` +
        'Screenshot 01-launch.png zeigt, was steht.',
    )
  }
  return rest
}
