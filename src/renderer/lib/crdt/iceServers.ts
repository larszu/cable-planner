// ───────────────────────────────────────────────────────────────────────────
// ICE-/TURN-Server für die WebRTC-Kollaboration.
//
// WARUM ES DAS GIBT. `docs/self-hosted-relay.md` erklaert seit jeher die
// coturn-Installation und weist den Nutzer dann an, die Zugangsdaten „in der
// App unter Zusammenarbeit -> ICE-Server (bzw. via `iceServers`-Feld)"
// einzutragen. Beides gab es nicht: `iceServers` kam im gesamten `src/` nicht
// vor, und `attachWebrtcProvider` reichte an y-webrtc nur `signaling` und
// `password` durch. Wer der Anleitung folgte, hatte einen laufenden
// TURN-Server, den nichts benutzte — und keinen Hinweis, warum die Verbindung
// zwischen zwei Standorten trotzdem scheiterte (B-37).
//
// Die Seite existiert fuer genau den Fall, in dem STUN nicht reicht: zwei
// Netze hinter symmetrischem NAT. Dort ist TURN nicht Komfort, sondern die
// Bedingung dafuer, dass ueberhaupt eine Verbindung zustande kommt.
//
// EINGABEFORMAT. Eine Zeile je Server:
//
//   stun:stun.example.com:3478
//   turn:turn.example.com:3478|benutzer|geheim
//   turns:turn.example.com:5349|benutzer|geheim
//
// Trennzeichen ist `|` und nicht `:` oder `@`: TURN-Passwoerter aus
// `lt-cred-mech` enthalten regelmaessig beides, und ein Format, das an einem
// gueltigen Passwort zerbricht, ist schlimmer als eines, das haesslich
// aussieht.
//
// WAS HIER NICHT PASSIERT: Die Zugangsdaten wandern weder in den
// Einladungslink noch in die mDNS-Ankuendigung der Session. Ein Einladungslink
// wird in einen Chat gepastet; ein TURN-Passwort, das dort mitfaehrt, ist
// damit veroeffentlicht. Jeder Teilnehmer traegt seinen eigenen Server ein —
// das steht so auch in `docs/self-hosted-relay.md`.
// ───────────────────────────────────────────────────────────────────────────

/** Schemata, die ein ICE-Server-URL tragen darf. Alles andere ist ein Tippfehler. */
const ERLAUBTE_SCHEMATA = ['stun:', 'stuns:', 'turn:', 'turns:']

export interface IceServerConfig {
  urls: string
  username?: string
  credential?: string
}

/**
 * Liest das Eingabefeld in eine `RTCIceServer`-Liste.
 *
 * Bewusst tolerant gegenueber Leerzeilen und Rand-Leerraum, bewusst streng
 * gegenueber unbekannten Schemata: eine stillschweigend verworfene Zeile sieht
 * im Feld genauso aus wie eine akzeptierte, und der Nutzer sucht den Fehler
 * dann in coturn statt in seinem Tippfehler. Deshalb meldet
 * `pruefeIceServers` die verworfenen Zeilen namentlich zurueck.
 */
export const parseIceServers = (raw: string): IceServerConfig[] => gelesen(raw).server

/** Zeilen, die kein bekanntes Schema tragen — fuer die Anzeige im Panel. */
export const ungueltigeIceZeilen = (raw: string): string[] => gelesen(raw).ungueltig

const gelesen = (raw: string): { server: IceServerConfig[]; ungueltig: string[] } => {
  const server: IceServerConfig[] = []
  const ungueltig: string[] = []
  for (const zeile of (raw ?? '').split(/\r?\n/)) {
    const text = zeile.trim()
    if (!text) continue
    const [url, benutzer, passwort] = text.split('|').map((t) => t.trim())
    if (!url || !ERLAUBTE_SCHEMATA.some((s) => url.toLowerCase().startsWith(s))) {
      ungueltig.push(text)
      continue
    }
    // Ein TURN-Server ohne Zugangsdaten weist jede Allocation ab. Das ist kein
    // Tippfehler im Schema, aber es ist auch kein brauchbarer Eintrag — als
    // ungueltig melden statt ihn scheinbar zu uebernehmen.
    const brauchtZugang = url.toLowerCase().startsWith('turn')
    if (brauchtZugang && !(benutzer && passwort)) {
      ungueltig.push(text)
      continue
    }
    server.push(benutzer && passwort ? { urls: url, username: benutzer, credential: passwort } : { urls: url })
  }
  return { server, ungueltig }
}
