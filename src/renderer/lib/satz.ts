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
