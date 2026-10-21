// ───────────────────────────────────────────────────────────────────────────
// Ein Befundsatz, der in zwei Sprachen ankommen muss (#1142).
//
// Befunde der reinen Module landen an zwei Stellen: auf dem Bildschirm (in
// der App-Sprache) und im gestempelten Blatt (kanonisch deutsch, damit Datei
// und Stand nicht mit der Sprache wechseln). Ein fertiger String kann nur
// eins von beiden sein. Deshalb traegt der Befund den SATZ — Schluessel,
// englische Quelle, Werte — und erst der Leser entscheidet die Sprache:
//
//   satzText(s, t)      Bildschirm (t aus useTranslation, oder tr)
//   satzKanonisch(s)    Blatt (KANONISCH_DE, sonst die Quelle)
//
// Werte duerfen selbst Saetze sein — ein Label im Satz („Profil {profil}")
// wird dann in derselben Sprache aufgeloest wie der Satz drumherum.
//
// REIN: kein Store, kein i18n-Import (die Mobile-Ansicht erreicht diese
// Module ueber `documentRegistry`).
// ───────────────────────────────────────────────────────────────────────────

import { kanonisch } from './kanonisch'
import { einsetzen } from './platzhalter'

export interface Satz {
  key: string
  en: string
  werte?: Readonly<Record<string, string | number | Satz>>
}

export type Uebersetzer = (key: string, fallback: string) => string

export const satz = (key: string, en: string, werte?: Satz['werte']): Satz =>
  werte ? { key, en, werte } : { key, en }

const istSatz = (v: unknown): v is Satz =>
  typeof v === 'object' && v !== null && 'key' in v && 'en' in v

/** Der Satz in der Sprache von `tx`. */
export const satzText = (s: Satz, tx: Uebersetzer): string => {
  const werte: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(s.werte ?? {})) werte[k] = istSatz(v) ? satzText(v, tx) : v
  return einsetzen(tx(s.key, s.en), werte)
}

/** Der Satz fuer ein gestempeltes Blatt: kanonisch deutsch. */
export const satzKanonisch = (s: Satz): string => satzText(s, kanonisch)

/** Die englische Quelle, fertig eingesetzt (Logs, Tests, Vergleiche). */
export const satzQuelle = (s: Satz): string => satzText(s, (_k, en) => en)

/**
 * Der Text eines Befunds fuer den Bildschirm. Befunde tragen `text`
 * kanonisch deutsch (Blatt, Stand, Tests) und daneben den `satz`; der
 * Bildschirm nimmt den Satz in der App-Sprache, sonst den Text.
 */
export const befundText = (f: { text?: string; satz?: Satz }, tx: Uebersetzer): string =>
  f.satz ? satzText(f.satz, tx) : (f.text ?? '')

/** `{ satz, text }` fuer einen Befund: der Satz und sein kanonischer Text. */
export const befund = (s: Satz): { satz: Satz; text: string } => ({ satz: s, text: satzKanonisch(s) })

/**
 * „a und b und c" als Satz — die Konjunktion gehoert zur Sprache. Gebaut als
 * Kette (a und (b und c)), damit das kanonische Deutsch genau dem frueheren
 * `join(' und ')` entspricht.
 */
export const undListe = (teile: ReadonlyArray<string | number | Satz>): Satz => {
  if (teile.length <= 1) return satz('list.one', '{a}', { a: teile[0] ?? '' })
  const [a, ...rest] = teile
  return satz('list.and', '{a} and {b}', { a, b: rest.length === 1 ? rest[0] : undListe(rest) })
}

/** „a, b, c" aus Saetzen — wie `join(', ')`, nur dass jedes Glied in der Sprache des Lesers bleibt. */
export const kommaListe = (teile: ReadonlyArray<string | number | Satz>): Satz => {
  if (teile.length <= 1) return satz('list.one', '{a}', { a: teile[0] ?? '' })
  const [a, ...rest] = teile
  return satz('list.comma', '{a}, {b}', { a, b: rest.length === 1 ? rest[0] : kommaListe(rest) })
}

/**
 * Wie `befund`, fuer Befunde, deren Textfeld anders heisst (`message`,
 * `grund`, `reason`): `{ satz, [feld]: kanonischer Text }`.
 */
export const befundAls = <F extends string>(feld: F, s: Satz): { satz: Satz } & Record<F, string> =>
  ({ satz: s, [feld]: satzKanonisch(s) }) as { satz: Satz } & Record<F, string>
