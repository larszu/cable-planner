import { de } from '../../src/renderer/lib/i18n/de'
import { satzText, type Satz } from '../../src/renderer/lib/satz'

/**
 * Ein Befundsatz so, wie ein deutscher Nutzer ihn liest (#1142).
 *
 * Die Tests pruefen die Aussage eines Befunds am deutschen Wortlaut, der vor
 * der Umstellung auf `satz()` im Modul stand. `de` enthaelt KANONISCH_DE
 * bereits (gespreizt), also gilt dasselbe fuer Blatt-Saetze.
 */
export const deutsch = (s: Satz | string | undefined): string =>
  s === undefined ? '' : typeof s === 'string' ? s : satzText(s, (k, en) => de[k] ?? en)

/** Dieselbe Aussage in der englischen Quelle — fuer Vergleiche mit den Label-Maps. */
export const quelle = (s: Satz | string | undefined): string =>
  s === undefined ? '' : typeof s === 'string' ? s : satzText(s, (_k, en) => en)
