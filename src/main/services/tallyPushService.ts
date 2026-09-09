/**
 * B-6 / E-7 — DER DIREKTWEG ZUM TALLY-PI.
 *
 * Der Befund, gegen den das hier steht: `ExportDialog` erzeugt eine
 * Download-Datei, die jemand von Hand nach `/opt/pi-guide/tally.json`
 * kopiert. Genau der Medienbruch, gegen den dieses Programm angetreten ist.
 *
 * E-7 (2026-09-08, vom Eigentuemer bestaetigt) sagt BEIDES, mit Rangfolge:
 * die Datei bleibt der Vorgabeweg, der Direktweg kommt als ausdruecklich
 * einzuschaltendes Ziel dazu. Wer ohne Netz zum Pi plant — und das ist der
 * Normalfall im Vorlauf —, merkt von diesem Modul nichts.
 *
 * ===========================================================================
 * WARUM DAS IM MAIN-PROZESS LIEGT
 * ===========================================================================
 *
 * `guide_server.py` schickt keine CORS-Kopfzeilen (nachgesehen: weder
 * `Access-Control-*` noch ein OPTIONS-Zweig). Ein `fetch` aus dem Renderer
 * scheiterte am Preflight oder waere — mit `mode: 'no-cors'` — abgeschickt,
 * aber unlesbar. Ein Schreibvorgang, dessen Ergebnis man nicht erfaehrt, ist
 * SCHLIMMER als keiner: der Nutzer glaubt, die Karte sei auf dem Pi. Node
 * kennt keine Same-Origin-Regel und liefert die echte Antwort samt Status.
 *
 * Ausserdem gilt die Repo-Regel: Adress- und Pfad-Pruefung passiert immer in
 * main, nie im Renderer. Die Pruefung steht deshalb HIER und nicht im Dialog.
 *
 * ===========================================================================
 * GESCHICKT WIRD NUR `devices` — UND DAS IST KEIN GEIZ
 * ===========================================================================
 *
 * Der Pi besitzt die VERDRAHTUNG (ATEM-Adresse, GPIO-Pins, Trigger-Modi), der
 * Plan besitzt die ROLLENLISTE (Id, Name, Mischer-Eingang). `tallyMap.ts`
 * laesst `out_gpio`, `out_trigger` und `me` ausdruecklich weg — „eine
 * erfundene Pin-Nummer waere schlimmer als ein fehlendes Feld".
 * `merge_tally_config` drueben behaelt jedes Feld, das der Post nicht nennt.
 *
 * GERAETE dagegen, die der Post nicht nennt, verschwinden — und das ist die
 * richtige Semantik (der Plan besitzt die Liste) und trotzdem eine Wirkung,
 * die niemand ungefragt ausloesen soll. Deshalb gibt es `lesen` und
 * `schreiben` EINZELN: erst lesen und vergleichen, dann schreiben.
 *
 * ===========================================================================
 * KEIN TOKEN — UND DAS STEHT HIER, STATT VORGETAEUSCHT ZU WERDEN
 * ===========================================================================
 *
 * Das DoD zu B-6 nannte „Token-geschuetzt wie der Mobile-Share". Nachgesehen
 * (2026-09-09): `guide_server.py` prueft NICHTS — kein `Authorization`, kein
 * eigener Kopf, an keinem seiner Schreib-Endpunkte. Und seine eigene
 * Bedienseite (`setup-guide.html`, vom selben Server ausgeliefert) schreibt
 * ueber dieselben offenen Endpunkte.
 *
 * Einen Kopf mitzuschicken, den niemand prueft, waere die schlechteste der
 * moeglichen Antworten: das Feld im Einstellungs-Dialog behauptete einen
 * Schutz, den es nicht gibt, und wer es ausfuellt, hielte den Weg fuer
 * gesichert. Deshalb schickt dieses Modul keinen — und der Schutz des Pi ist
 * als eigener Punkt im Backlog vermerkt, wo er hingehoert: er ist eine
 * Entscheidung ueber die ganze HTTP-Flaeche des Pi und nicht ueber diesen
 * einen Aufruf.
 */
import http from 'node:http'

/** Nach dieser Zeit ohne Antwort gilt der Pi als nicht erreichbar. */
const ANFRAGE_FRIST_MS = 6000

/** Groesster Rumpf, den wir lesen — ein Pi antwortet mit wenigen Kilobyte. */
const RUMPF_GRENZE = 256 * 1024

export interface PiAntwort {
  ok: boolean
  status?: number
  /** Der geparste Rumpf, wenn es JSON war. */
  json?: unknown
  /** Der Rumpf als Text, gekuerzt. Bei einem Fehler steht dort die Begruendung des Pi. */
  text?: string
  /** Immer gesetzt, wenn `ok` false ist. Nie leer, nie `undefined`. */
  error?: string
}

/**
 * Die Adresse pruefen — in main, wie es die Repo-Regel verlangt.
 *
 * `http:` und sonst nichts. Nicht aus Bequemlichkeit: `file:` waere ein
 * Dateizugriff mit der Adresse als Pfad, und `https:` gaukelte eine
 * Verschluesselung vor, die `guide_server.py` gar nicht anbietet (er bindet
 * einen einfachen `HTTPServer` auf Port 8080). Wer `https://` eintraegt,
 * bekommt hier eine Absage statt einer Zeitueberschreitung ohne Grund.
 */
export const pruefeZiel = (adresse: string): { ok: true; url: URL } | { ok: false; error: string } => {
  const roh = (adresse ?? '').trim()
  if (!roh) return { ok: false, error: 'Keine Adresse für den Tally-Pi hinterlegt.' }
  let url: URL
  try {
    url = new URL(roh)
  } catch {
    return { ok: false, error: `Keine gültige Adresse: ${roh}` }
  }
  if (url.protocol !== 'http:') {
    return {
      ok: false,
      error: `Der Tally-Pi spricht http:// — eingetragen ist ${url.protocol}//`,
    }
  }
  if (!url.hostname) return { ok: false, error: `Keine gültige Adresse: ${roh}` }
  return { ok: true, url }
}

/** Eine HTTP-Anfrage an den Pi. Antwortet IMMER mit einem Objekt, wirft nie. */
const anfrage = (ziel: URL, methode: 'GET' | 'POST', koerper?: unknown): Promise<PiAntwort> =>
  new Promise((resolve) => {
    const daten = koerper === undefined ? null : Buffer.from(JSON.stringify(koerper), 'utf8')
    const req = http.request(
      {
        hostname: ziel.hostname,
        port: ziel.port || 80,
        path: `${ziel.pathname}${ziel.search}`,
        method: methode,
        timeout: ANFRAGE_FRIST_MS,
        headers: daten
          ? { 'Content-Type': 'application/json', 'Content-Length': String(daten.length) }
          : {},
      },
      (res) => {
        const stuecke: Buffer[] = []
        let laenge = 0
        res.on('data', (c: Buffer) => {
          laenge += c.length
          if (laenge <= RUMPF_GRENZE) stuecke.push(c)
        })
        res.on('end', () => {
          const text = Buffer.concat(stuecke).toString('utf8')
          let json: unknown
          try {
            json = JSON.parse(text)
          } catch {
            json = undefined
          }
          const status = res.statusCode ?? 0
          const ok = status >= 200 && status < 300
          const grund =
            (json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string'
              ? (json as { error: string }).error
              : '') || `HTTP ${status}`
          resolve({
            ok,
            status,
            json,
            // Gekuerzt mitgegeben: bei einem Fehler steht dort die
            // Begruendung des Pi, und die gehoert vor den Nutzer.
            text: text.slice(0, 2000),
            ...(ok ? {} : { error: grund }),
          })
        })
      },
    )
    req.on('timeout', () => {
      req.destroy()
      resolve({
        ok: false,
        error: `Keine Antwort von ${ziel.host} innerhalb von ${ANFRAGE_FRIST_MS / 1000} s`,
      })
    })
    // `error` kann NACH `timeout` noch kommen (das `destroy` loest ihn aus).
    // `resolve` ist dann wirkungslos — die erste Antwort gilt, und das ist die
    // mit dem brauchbaren Grund.
    req.on('error', (err: Error) => resolve({ ok: false, error: err.message }))
    if (daten) req.write(daten)
    req.end()
  })

/** Die aktuelle `tally.json` des Pi lesen — vor dem Schreiben. */
export const lesen = async (adresse: string): Promise<PiAntwort> => {
  const ziel = pruefeZiel(adresse)
  if (!ziel.ok) return { ok: false, error: ziel.error }
  return anfrage(new URL('/tally-config', ziel.url), 'GET')
}

/**
 * Die Rollenliste aus dem Plan schreiben.
 *
 * Bewusst NUR `devices`: alles andere gehoert dem Pi und wird drueben aus der
 * alten Datei ergaenzt. Wer hier ein zweites Feld hinzufuegt, loescht auf dem
 * Pi das, was er nicht mitschickt.
 */
export const schreiben = async (adresse: string, devices: unknown[]): Promise<PiAntwort> => {
  const ziel = pruefeZiel(adresse)
  if (!ziel.ok) return { ok: false, error: ziel.error }
  if (!Array.isArray(devices)) return { ok: false, error: 'Keine Rollenliste zum Senden.' }
  return anfrage(new URL('/tally-config', ziel.url), 'POST', { devices })
}
