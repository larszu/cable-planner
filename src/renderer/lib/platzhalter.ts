// ───────────────────────────────────────────────────────────────────────────
// Platzhalter einsetzen — EINMAL, fuer alle drei Seiten.
//
// ─── WOFUER ────────────────────────────────────────────────────────────────
//
// `{n} cables` + `{ n: 5 }` -> `5 cables`. Mehr macht diese Datei nicht, und
// mehr darf sie auch nicht: sie hat KEINE Importe und haengt an keinem Store,
// keinem Woerterbuch, keinem React.
//
// ─── WARUM SIE EIGEN STEHT (2026-09-10, #837) ──────────────────────────────
//
// Es gab die Regel bis heute zweimal — in `lib/i18n.ts` fuer den Desktop und
// in `lib/i18nLite.ts` fuer Mobile-Ansicht und Viewer. Der zweite Ort ist
// ausdruecklich begruendet: `lib/i18n.ts` importiert `de.ts` statisch (316 KB),
// und das gehoert nicht auf ein Telefon im Hallen-WLAN.
//
// Der Grund war richtig, die Folge nicht: zwei Fassungen derselben Regel sind
// die Defektform `zwei-rechnungen`, die dieses Repo an mehreren Stellen teuer
// bezahlt hat. Beim naechsten Randfall — ein Platzhalter mit Punkt, eine
// doppelte Klammer — waere die eine nachgezogen worden und die andere nicht.
//
// Mit dieser Datei bleibt der Grund erhalten und die Doppelung faellt weg:
// beide Werke rufen `einsetzen`, und keines von beiden schleppt dabei ein
// Woerterbuch mit. Sie ist ausserdem das Stueck, das die URTEILS-Module unter
// `types/` brauchen (`adapter`, `conductor`, `displayCapability`): die duerfen
// `lib/i18n.ts` nicht anfassen, weil ein Typ-Modul im Importgraphen JEDER
// Seite liegt.
//
// Ein unbekannter Platzhalter bleibt sichtbar stehen (`{foo}`) statt leer zu
// werden. Eine Uebersetzung, die einen Platzhalter falsch schreibt, faellt
// damit im Bild auf, statt still ein Wort zu verschlucken.
// ───────────────────────────────────────────────────────────────────────────

/** Die Werte, die in eine Vorlage eingesetzt werden. */
export type Platzhalterwerte = Record<string, string | number>

export const einsetzen = (vorlage: string, werte: Platzhalterwerte): string =>
  vorlage.replace(/\{(\w+)\}/g, (_, k) => (k in werte ? String(werte[k]) : `{${k}}`))
