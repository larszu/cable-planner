// ───────────────────────────────────────────────────────────────────────────
// Der Befund der Plan-Pruefung — als TYP, ohne Rechenwerk daneben.
//
// Er stand bis 2026-09-10 in `lib/drawingChecks.ts`, und das war eine Zeile zu
// viel Naehe: `labelDerivation.ts` liefert Befunde und holte den Typ von dort.
// Ein `import type` ist zur Laufzeit nichts — der IMPORTGRAPH kennt den
// Unterschied aber nicht, und `tests/i18nEintrittspunkte.test.ts` folgt ihm.
// Ueber `documentRegistry` -> `postHandover` -> `labelDerivation` haette die
// MOBILE-Ansicht damit `drawingChecks.ts` und darueber `lib/i18n.ts` mit
// `de.ts` (316 KB) geladen — auf ein Telefon im Hallen-WLAN, fuer einen Typ.
//
// Hier steht deshalb nur die Form. Wer rechnet, ist `drawingChecks.ts`; wer
// beschriftet, ist die Oberflaeche.
// ───────────────────────────────────────────────────────────────────────────
import type { Platzhalterwerte } from '../lib/platzhalter'

export type CheckSeverity = 'error' | 'warning' | 'info'

export interface CheckFinding {
  /** Stabile ID (Check-Typ + betroffenes Element) — als React-key nutzbar. */
  id: string
  severity: CheckSeverity
  /** Kurzer Check-Typ als Gruppen-Label, z.B. "Doppelte IP". */
  category: string
  /** Menschlich lesbare Beschreibung des konkreten Fundes. */
  message: string
  /**
   * Schluessel und Werte, wo der Befund aus einem SPRACHFREIEN Modul kommt
   * (`labelDerivation`, das ueber `postHandover` im Importgraphen der
   * Mobile-Ansicht liegt und `lib/i18n.ts` deshalb nicht anfassen darf).
   * `message` traegt dann den englischen Satz mit eingesetzten Werten; wer
   * uebersetzen kann, ruft `format(tr(f.schluessel, f.message), f.werte)`.
   */
  schluessel?: string
  werte?: Platzhalterwerte
  /** Klick-Ziel: selektiert dieses Gerät bzw. Kabel auf dem Canvas. */
  equipmentId?: string
  cableId?: string
}
