/**
 * Geheimnis-tragende Felder aus einem Projekt entfernen, bevor es den
 * Rechner in Richtung einer ANDEREN Person verlaesst.
 *
 * Die Regel stand bisher nur im `mobileShareServer` und galt damit nur fuer
 * einen der Ausgaenge: „Recursively strip secret-bearing fields (device
 * passwords etc.) from a project before it leaves the desktop." Sie ist
 * richtig — aber der Viewer-Export (`.cpviewer`, ausdruecklich fuer externe
 * Reviewer) ging daran vorbei und schrieb `username`/`password` jedes
 * Geraets in die Datei. Die Variable dort hiess `safe`.
 *
 * Gefunden wurde das beim Aufzaehlen der Felder fuer den Plan-Vergleich
 * (#639): dieselben zwei Felder, dritter Ausgang. Deshalb liegt die Regel
 * jetzt an einer Stelle und wird von beiden Wegen benutzt.
 *
 * WAS HIER NICHT HINEINGEHOERT. Wege, auf denen die Datei beim EIGENTUEMER
 * bleibt (`project:save`, `project:save-as`) oder auf denen bewusst
 * gemeinsam am selben Plan gearbeitet wird (CRDT-Sync unter Planern). Wer
 * seinen eigenen Plan speichert, will seine Zugangsdaten behalten.
 *
 * `username` steht mit auf der Liste, obwohl es allein kein Passwort ist:
 * es ist Zugangsdatum, kein Konsument im Viewer oder in der Mobile-Ansicht
 * liest es (nachgesehen), und kein anderer Typ im Projekt fuehrt ein Feld
 * dieses Namens — das rekursive Streichen trifft also nichts Fremdes.
 */
export const SECRET_KEYS = new Set([
  'password',
  'username',
  'passphrase',
  'apiKey',
  'secret',
  'token',
])

/**
 * Fremde Roh-Dokumente, die als Ganzes nicht mitgehen.
 *
 * `SECRET_KEYS` streicht nach Feldnamen. Das setzt voraus, dass wir die Namen
 * kennen — bei unseren eigenen Typen tun wir das. Bei einem eingelesenen
 * Hersteller-Dokument nicht: `GreenGoConfig.basePreset` haelt die
 * Anlagen-Konfiguration unveraendert, und ihr Kopf-Kommentar sagt ausdruecklich
 * „und vor allem die PASSWOERTER der Anlage bleiben, wie sie waren".
 *
 * Sie heissen `ConfigPassword`, `AdminPassword`, `TechPincode` und
 * `Security.Pincode` — keiner dieser Namen steht in `SECRET_KEYS`. Die
 * Zugangsdaten der Geraete wurden also gestrichen, die der Intercom-Anlage
 * gingen mit: in die `.cpviewer`-Datei fuer externe Reviewer und an jedes
 * Handy in der Mobile-Ansicht. Das widerspricht der Regel im Kopf dieser
 * Datei, nicht bloss dem guten Geschmack.
 *
 * Feldnamen nachzutragen waere die schlechtere Antwort: das Dokument gehoert
 * einem Hersteller, und die naechste Firmware bringt ein Feld mit, das hier
 * niemand aufgeschrieben hat. Deshalb geht das Roh-Dokument als Ganzes nicht
 * mit — was nichts kostet, denn **kein Empfaenger liest es.** Nachgesehen:
 * weder `src/mobile/` noch `src/viewer/` kennen GreenGo ueberhaupt, und
 * `basePreset` wird nur im Renderer gelesen, auf dem Rechner des Eigentuemers.
 * Beim eigenen Speichern bleibt es unangetastet — dieselbe Grenze wie oben.
 */
export const OPAQUE_KEYS = new Set(['basePreset'])

/**
 * Rekursiv alle Felder aus `SECRET_KEYS` und `OPAQUE_KEYS` entfernen. Arrays
 * bleiben Arrays.
 */
export const stripSecrets = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripSecrets)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k) || OPAQUE_KEYS.has(k)) continue
      out[k] = stripSecrets(v)
    }
    return out
  }
  return value
}
