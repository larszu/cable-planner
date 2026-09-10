// ---------------------------------------------------------------------------
// Das Uebersetzer-Werk fuer die NEBEN-Eintrittspunkte (`src/mobile`,
// `src/viewer`) — ohne Woerterbuch und ohne Store.
//
// Ein einziger Import steht seit 2026-09-10 doch hier: `lib/platzhalter.ts`.
// Die Datei hat selbst keine Importe und kein Woerterbuch — sie traegt nur die
// Einsetz-Regel, die vorher zweimal dastand (hier und in `lib/i18n.ts`). Der
// Grund fuer die Trennung der beiden Werke bleibt unberuehrt: `lib/i18n.ts`
// zoege `de.ts` nach (316 KB), `platzhalter.ts` zieht gar nichts nach.
//
// ─── WOFUER DAS DA IST, UND WOFUER NICHT ───────────────────────────────────
//
// NICHT fuer die Desktop-App. Die nutzt `lib/i18n.ts`: Registry, `de.ts`,
// `useTranslation()` am Zustand-Store. Wer im Renderer diese Datei hier
// importiert, umgeht das Woerterbuch der App und bekommt fuer jeden
// Schluessel den Fallback — `tests/i18nEintrittspunkte.test.ts` sagt es ihm.
//
// SONDERN fuer die beiden Seiten, die ueber einen eigenen Vite-Entry laufen
// und ihr eigenes, kleines Woerterbuch haben: die Mobile-Ansicht am Telefon
// im Hallen-WLAN und den read-only Viewer auf GitHub Pages. Beide koennen
// `lib/i18n.ts` nicht nutzen, weil die Datei `de.ts` STATISCH importiert —
// 316 KB und 5276 Schluessel, von denen keiner auf diesen Seiten vorkommt.
// Gemessen: der Mobile-Chunk ist 57 KB gross.
//
// ─── WARUM DAS WERK HIER STEHT UND NICHT ZWEIMAL ───────────────────────────
//
// Weil `spracheAusBrowser()` und `format()` in beiden Seiten dieselbe Frage
// beantworten — und zwei Fassungen derselben Regel sind die Defektform, die
// `scripts/quellsprache.mjs` in ihrem Kopf beschreibt: die eine wird
// nachgezogen, die andere nicht, und ab da messen sie Verschiedenes.
//
// Was NICHT hierher gehoert, sind die Woerterbuecher. Die sind je Seite
// verschieden (das ist der ganze Punkt) und stehen bei ihr: `mobile/i18n.ts`,
// `viewer/i18n.ts`.
// ---------------------------------------------------------------------------

/** Quellsprache ist `en` (E-28); jede weitere Sprache ist ein Eintrag mehr. */
import { einsetzen } from './platzhalter'

export type Sprache = 'en' | 'de'

/**
 * Die Sprache des GERAETS, auf zwei Buchstaben gekuerzt.
 *
 * Nicht die des Desktops. Wer eine dieser Seiten liest, steht mit seinem
 * eigenen Geraet im Aufbau oder sitzt an einem fremden Rechner; welche
 * Sprache in der Regie eingestellt ist, sagt darueber nichts.
 * `navigator.language` ist die einzige Angabe, die wirklich der Person
 * gehoert, die auf den Schirm schaut.
 *
 * Faellt sie aus (aeltere WebViews liefern `undefined`), bleibt es bei der
 * Quellsprache.
 */
export const spracheAusBrowser = (): Sprache => {
  const roh = typeof navigator === 'undefined' ? '' : (navigator.language ?? '')
  return roh.slice(0, 2).toLowerCase() === 'de' ? 'de' : 'en'
}

/**
 * Baut `t(key, 'English source')` ueber einem Satz Woerterbuecher.
 *
 * Die englische Quelle steht im Aufruf und ist zugleich der Fallback: ein
 * fehlender Schluessel zeigt sie an, statt die Oberflaeche leer zu lassen.
 * Eine Luecke im Woerterbuch kann hier also nie einen leeren Knopf ergeben —
 * hoechstens einen englischen.
 */
export const macheUebersetzer =
  (woerterbuecher: Partial<Record<Sprache, Record<string, string>>>) =>
  (sprache: Sprache = spracheAusBrowser()) => {
    const dict = woerterbuecher[sprache]
    return (key: string, quelle: string): string => dict?.[key] ?? quelle
  }

/**
 * Werte in einen uebersetzten Satz einsetzen: `format(t('k', '{n} m'), {n: 5})`.
 *
 * Dieselbe Form wie `format()` in `lib/i18n.ts` — und absichtlich eine eigene
 * Die Regel selbst steht in `lib/platzhalter.ts` und wird von dort geholt —
 * NICHT aus `lib/i18n.ts`: der Import zoege `de.ts` nach und braechte das
 * ganze Desktop-Woerterbuch auf ein Telefon im Hallen-WLAN.
 *
 * Ein unbekannter Platzhalter bleibt sichtbar stehen (`{foo}`) statt leer zu
 * werden. Eine Uebersetzung, die einen Platzhalter falsch schreibt, faellt
 * damit im Bild auf, statt still ein Wort zu verschlucken.
 */
export const format = einsetzen
