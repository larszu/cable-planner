import type { ControlAction, ControlResult, SwitcherDriver } from './types.js'

/**
 * Bitfocus Companion — das Protokoll spricht ein anderer (S-4).
 *
 * Companion (MIT) hat rund fuenfhundert Hersteller-Module, jedes von Leuten
 * gepflegt, die das Geraet auf dem Tisch haben. Statt sie nachzubauen — was
 * Invariante 18 verbietet, weil ein aus dem Gedaechtnis geschriebener
 * Treiber eine ungepruefte Zusicherung an eine laufende Anlage ist —
 * schickt dieser Treiber drei HTTP-Aufrufe an eine laufende
 * Companion-Instanz.
 *
 * DIE REIHENFOLGE IST DER GANZE TREIBER. Erst die beiden Custom-Variablen
 * (Ausgang, Eingang), dann der Druck auf die eine Schaltflaeche, deren
 * Route-Aktion diese Variablen liest. Schlaegt eine Variable fehl, wird
 * ABGEBROCHEN: die Schaltflaeche feuerte sonst mit den Werten von vorhin und
 * schaltete den VORIGEN Kreuzpunkt — auf einer laufenden Anlage, und es saehe
 * aus wie ein gelungener Befehl.
 *
 * Die Schrittfolge selbst kommt fertig aus dem Renderer
 * (`lib/companionControl.ts`), wo sie geprueft ist. Dieser Treiber baut
 * keinen Pfad zusammen — ein zweiter Bauer waere die Defektform
 * `zwei-rechnungen`, und der Schauplatz waere wieder eine laufende Anlage.
 *
 * Verifiziert an `bitfocus/companion@main` (nachgesehen 2026-09-08):
 * `companion/lib/Service/HttpApi.ts` mountet unter `/api` die Routen
 * `location/:page/:row/:column/press` und `custom-variable/:name/value`;
 * `shared-lib/lib/LaunchOptions.ts` setzt `adminPort` auf 8000;
 * `companion/lib/Data/UserConfig.ts` hat `http_api_enabled: true`.
 */

const ANTWORT_FRIST_MS = 5000

const ruf = async (
  url: string,
  method: 'POST' | 'GET',
): Promise<{ ok: boolean; status: number; text: string }> => {
  const abbruch = new AbortController()
  const timer = setTimeout(() => abbruch.abort(), ANTWORT_FRIST_MS)
  try {
    const res = await fetch(url, { method, signal: abbruch.signal })
    const text = await res.text().catch(() => '')
    return { ok: res.ok, status: res.status, text: text.slice(0, 200) }
  } finally {
    clearTimeout(timer)
  }
}

export const companionDriver: SwitcherDriver = {
  protocol: 'companion',
  send: async (action: ControlAction): Promise<ControlResult> => {
    if (action.protocol !== 'companion') {
      return { ok: false, message: 'Falscher Treiber für dieses Protokoll.' }
    }
    const { host, port, schritte } = action
    if (!host || !/^[\w.\-:]+$/.test(host)) {
      return { ok: false, message: 'Ungültige Companion-Adresse' }
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { ok: false, message: 'Ungültiger Port' }
    }
    if (schritte.length === 0) {
      return { ok: false, message: 'Kein Befehl zu senden.' }
    }

    const basis = `http://${host}:${port}`
    let getan = 0
    for (const schritt of schritte) {
      try {
        const res = await ruf(`${basis}${schritt.pfad}`, schritt.method)
        if (!res.ok) {
          // ABBRUCH, und der Satz sagt WOBEI. „Companion hat abgelehnt" allein
          // liesse offen, ob schon etwas geschaltet wurde.
          return {
            ok: false,
            message: `Abgebrochen bei „${schritt.zweck}" — Companion antwortete ${res.status}${res.text ? `: ${res.text}` : ''}. ${
              getan === 0
                ? 'Es wurde nichts geschaltet.'
                : `${getan} von ${schritte.length} Aufrufen waren schon durch — der Kreuzpunkt ist womöglich halb gesetzt.`
            }`,
          }
        }
        getan += 1
      } catch (e) {
        const grund = e instanceof Error && e.name === 'AbortError'
          ? `keine Antwort binnen ${ANTWORT_FRIST_MS / 1000} s`
          : e instanceof Error
            ? e.message
            : String(e)
        return {
          ok: false,
          message: `Abgebrochen bei „${schritt.zweck}" — ${grund}. ${
            getan === 0
              ? 'Es wurde nichts geschaltet.'
              : `${getan} von ${schritte.length} Aufrufen waren schon durch.`
          }`,
        }
      }
    }
    // „Companion hat angenommen" und NICHT „das Geraet hat geschaltet": was
    // hinter der Schaltflaeche passiert, meldet Companion an dieser Stelle
    // nicht zurueck. Der Unterschied steht so auf dem Beleg.
    return {
      ok: true,
      message: `Companion hat alle ${schritte.length} Aufrufe angenommen (was das Gerät daraufhin tut, meldet Companion hier nicht zurück).`,
    }
  },
}

/**
 * Die eingerichteten Verbindungen einer Companion-Instanz.
 *
 * Reine Bequemlichkeit beim EINRICHTEN: der Nutzer sieht, welche Geraete in
 * seiner eigenen Companion schon stehen, statt den Modulnamen abzutippen.
 * Schlaegt der Aufruf fehl, ist das kein Fehler des Schaltens — deshalb
 * liefert er eine Meldung und keine Ausnahme.
 */
export const companionConnections = async (
  host: string,
  port: number,
): Promise<{ ok: boolean; message: string; connections: unknown }> => {
  if (!host || !/^[\w.\-:]+$/.test(host)) {
    return { ok: false, message: 'Ungültige Companion-Adresse', connections: [] }
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, message: 'Ungültiger Port', connections: [] }
  }
  try {
    const res = await ruf(`http://${host}:${port}/api/connections`, 'GET')
    if (!res.ok) {
      return {
        ok: false,
        message: `Companion antwortete ${res.status}. Läuft dort eine Companion-Instanz, und ist die HTTP-API eingeschaltet?`,
        connections: [],
      }
    }
    return { ok: true, message: '', connections: JSON.parse(res.text || '[]') }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
      connections: [],
    }
  }
}
