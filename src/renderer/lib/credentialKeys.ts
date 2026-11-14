// ---------------------------------------------------------------------------
// Geraete-Zugangsdaten: dieselbe Regel wie in `src/main/util/stripSecrets.ts`,
// nur fuer den Renderer.
//
// WARUM ZWEIMAL, obwohl genau das der Grund fuer den urspruenglichen Fehler
// war. Die beiden Prozesse teilen keinen Quellbaum: `tsconfig.app.json` sieht
// `src/renderer` + `src/viewer`, `tsconfig.main.json` sieht `src/main`, und
// der Renderer darf laut Architektur nicht in `src/main` greifen. Eine dritte,
// geteilte Datei gaebe es nur um den Preis, diese Trennung aufzuweichen.
//
// Die Kopie ist deshalb nicht das Problem — die UNGEPRUEFTE Kopie war es.
// `tests/credentialKeys.test.ts` liest BEIDE Quelldateien und faellt, sobald
// die Schluessel-Mengen auseinanderlaufen. Genau dieser Guard fehlte, als der
// Viewer-Export die Regel des Mobile-Share-Pfads nicht mitbekam.
//
// WO DIESE DATEI GILT: Ausgaenge, die der Renderer selbst baut — der
// `.avplan`-Export, der Push in die geteilte Bibliothek und der Push in den
// geteilten Sync-Ordner (`SharedSyncPanel`). Die Ausgaenge im Hauptprozess
// (Mobile-Share, Viewer-Export) benutzen weiterhin `stripSecrets` dort.
//
// DER DRITTE STAND BIS 2026-09-04 NICHT HIER — und lief auch nicht durch die
// Regel: `SharedSyncPanel.handlePush` schrieb Projekt, Bibliothek und
// Gruppen-Presets ROH in denselben Team-Ordner. Wer beim .avplan-Export
// ausdruecklich „Zugangsdaten entfernen" gewaehlt hatte, hatte sie trotzdem
// dort, sobald irgendwer Push drueckte.
//
// Diese Liste ist deshalb nicht mehr die Absicherung, sondern nur noch die
// Erklaerung. Die Absicherung ist berechnet:
// `tests/credentialExits.test.ts` sucht JEDEN Renderer-Ausgang, der
// Projekt-/Bibliotheks-Daten hinausschreibt, und verlangt, dass er die Regel
// kennt. Der vierte Ausgang faellt dort auf, ohne dass sein Autor diese Datei
// gelesen haben muss.
// ---------------------------------------------------------------------------

import { ZUGANGSCODE_PFADE, anlagenZugangscodes } from './anlagenZugangscodes'
import type { CablePlannerProject } from '../types/project'

/** Muss zeichengleich zur Menge in `src/main/util/stripSecrets.ts` sein. */
export const SECRET_KEYS = new Set([
  'password',
  'username',
  'passphrase',
  'apiKey',
  'secret',
  'token',
])

/**
 * Das Roh-Dokument der Intercom-Anlage (`basePreset`) traegt seine
 * Zugangsdaten unter Herstellernamen, die nicht in `SECRET_KEYS` stehen
 * (`AdminPassword`, `Security.Pincode` …). Im Hauptprozess geht es deshalb als
 * Ganzes nicht mit (`OPAQUE_KEYS`) — dort liest es kein Empfaenger. Eine
 * Plan-Kopie und die `.avplan` behalten es, denn der Empfaenger exportiert
 * daraus vielleicht die Anlage; nur die Codes fallen heraus, und zwar genau
 * die Pfade, die `anlagenZugangscodes` als Zugangsmittel fuehrt — EINE
 * Liste, nicht eine zweite hier (#1171).
 */
const ohneAnlagenCodes = (preset: Record<string, unknown>): Record<string, unknown> => {
  // `stripCredentials` baut jedes Objekt neu — die Kopie gehoert uns, das
  // Loeschen trifft den Plan im Speicher nicht.
  const kopie = stripCredentials(preset)
  for (const { pfad } of ZUGANGSCODE_PFADE) {
    let knoten: unknown = kopie
    for (const teil of pfad.slice(0, -1)) {
      knoten = knoten && typeof knoten === 'object' ? (knoten as Record<string, unknown>)[teil] : undefined
    }
    if (knoten && typeof knoten === 'object') delete (knoten as Record<string, unknown>)[pfad[pfad.length - 1]]
  }
  return kopie
}

const istObjekt = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

/** Rekursiv alle Felder aus `SECRET_KEYS` entfernen, dazu die Codes im
 *  Intercom-Roh-Dokument. Arrays bleiben Arrays. */
export const stripCredentials = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(stripCredentials) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k)) continue
      out[k] = k === 'basePreset' && istObjekt(v) ? ohneAnlagenCodes(v) : stripCredentials(v)
    }
    return out as T
  }
  return value
}

/**
 * Wie viele Eintraege einer Liste ueberhaupt Zugangsdaten tragen.
 *
 * Der Dialog fragt nur, wenn es etwas zu entscheiden gibt: eine Rueckfrage,
 * die bei jedem Export erscheint und meistens „nichts dabei" bedeutet, wird
 * zur Klickgewohnheit — und dann liest sie niemand mehr an dem einen Tag, an
 * dem sie zaehlt.
 */
export const countCredentialBearers = (items: readonly unknown[]): number =>
  items.filter((item) => hasCredential(item)).length

/** Traegt dieser Wert (rekursiv) irgendwo ein Feld aus `SECRET_KEYS`? */
export const hasCredential = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasCredential)
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Ein leeres Feld ist kein Geheimnis: `password: ''` heisst „nicht
      // gesetzt" und darf keine Rueckfrage ausloesen.
      if (SECRET_KEYS.has(k)) {
        if (typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null) return true
        continue
      }
      if (k === 'basePreset' && anlagenZugangscodes(v).length > 0) return true
      if (hasCredential(v)) return true
    }
  }
  return false
}

/**
 * Wie viele Eintraege eines PROJEKTS Zugangsdaten tragen: jedes Geraet mit
 * Benutzername/Passwort und die Intercom-Anlage mit ihren Codes. Die eine
 * Zaehlung fuer jeden Ausgang, der ein ganzes Projekt hinausgibt
 * (`.avplan`, Plan-Kopie) — vorher sah die `.avplan` nur die Geraete.
 */
export const projectCredentialBearers = (project: Pick<CablePlannerProject, 'equipment' | 'intercom'>): number =>
  countCredentialBearers([...(project.equipment ?? []), project.intercom])
