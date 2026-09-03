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
// `.avplan`-Export und der Push in die geteilte Bibliothek. Die Ausgaenge im
// Hauptprozess (Mobile-Share, Viewer-Export) benutzen weiterhin `stripSecrets`
// dort.
// ---------------------------------------------------------------------------

/** Muss zeichengleich zur Menge in `src/main/util/stripSecrets.ts` sein. */
export const SECRET_KEYS = new Set([
  'password',
  'username',
  'passphrase',
  'apiKey',
  'secret',
  'token',
])

/** Rekursiv alle Felder aus `SECRET_KEYS` entfernen. Arrays bleiben Arrays. */
export const stripCredentials = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(stripCredentials) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k)) continue
      out[k] = stripCredentials(v)
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
      if (hasCredential(v)) return true
    }
  }
  return false
}
