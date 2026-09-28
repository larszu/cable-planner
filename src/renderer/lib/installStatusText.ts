// ───────────────────────────────────────────────────────────────────────────
// Der Betriebs-Status als Text in der Sprache der Oberfläche.
//
// Bis 2026-09-27 riefen die Eigenschaften `t(`lifecycle.status.${s}`,
// INSTALL_STATUS_LABEL[s])`. Zwei Fehler in einer Zeile: der Rückfall war
// DEUTSCH (die englische Oberfläche zeigte „Störung"), und die Schlüssel
// standen in keinem Wörterbuch — der Wächter sieht nur ausgeschriebene
// Schlüssel, ein zusammengesetzter fiel ihm nicht auf. Jetzt steht jeder
// einzeln da, mit englischer Quelle.
//
// `INSTALL_STATUS_LABEL` bleibt, was es ist: die kanonische deutsche Form
// für gestempelte Tabellen, deren Fingerabdruck nicht von der Sprache
// abhängen darf.
// ───────────────────────────────────────────────────────────────────────────

import type { InstallStatus } from '../types/lifecycle'
import type { Uebersetzen } from './druckblatt'

export const installStatusText = (s: InstallStatus, t: Uebersetzen): string => {
  switch (s) {
    case 'planned':
      return t('lifecycle.status.planned', 'Planned')
    case 'installed':
      return t('lifecycle.status.installed', 'Installed')
    case 'tested':
      return t('lifecycle.status.tested', 'Tested')
    case 'operational':
      return t('lifecycle.status.operational', 'Operational')
    case 'fault':
      return t('lifecycle.status.fault', 'Fault')
    case 'retired':
      return t('lifecycle.status.retired', 'Retired')
  }
}
