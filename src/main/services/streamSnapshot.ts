/**
 * #946 — ein Standbild fuer die Stream-Vorschau am Canvas.
 *
 * WARUM IM MAIN-PROZESS. Die CSP des Fensters laesst Bilder nur aus `self`,
 * `data:` und `blob:` zu, und das ist richtig so: eine Projektdatei, die
 * beliebige Bild-URLs ins Fenster laedt, waere ein Kanal nach draussen. Der
 * Main-Prozess holt das Bild erst, wenn der Nutzer die Vorschau an diesem
 * Geraet einschaltet, prueft, dass es ein Bild IST, und gibt es als
 * `data:`-URI zurueck.
 *
 * WAS ES NICHT KANN. RTSP, SRT, NDI abspielen — dafuer braeuchte es einen
 * Decoder. Die meisten Kameras und Encoder bieten eine HTTP-Adresse fuer ein
 * JPEG an; die traegt der Nutzer als Vorschau-Adresse ein. Ein MJPEG-Strom
 * endet nie und scheitert hier am Zeitlimit oder an der Groesse — mit
 * Meldung, nicht mit einem haengenden Fenster.
 */

export const SNAPSHOT_TIMEOUT_MS = 5_000
export const SNAPSHOT_MAX_BYTES = 5 * 1024 * 1024

export type SnapshotResult =
  | { ok: true; dataUri: string; fetchedAt: string }
  | { ok: false; code: 'invalid-url' | 'unreachable' | 'http' | 'not-image' | 'too-large'; status?: number }

const BILDTYPEN = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function fetchSnapshot(
  raw: unknown,
  holen: typeof fetch = fetch,
  jetzt: () => Date = () => new Date(),
  /**
   * Nachtrag #946 — `Basic …` aus dem Schluesselbund, gesetzt von
   * `streamPreviewService`. Nie aus der Adresse: die Zugangsdaten darin
   * werden weiter unten verworfen.
   */
  authorization?: string,
): Promise<SnapshotResult> {
  let url: URL
  try {
    url = new URL(String(raw ?? '').trim())
  } catch {
    return { ok: false, code: 'invalid-url' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, code: 'invalid-url' }
  // Zugangsdaten in der Adresse gehen nicht mit hinaus — sie stehen auch nie
  // im Projekt (`streamUrlOhneZugang`).
  url.username = ''
  url.password = ''

  let res: Response
  try {
    res = await holen(url.toString(), {
      signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS),
      credentials: 'omit',
      // Nachtrag #946: mit Zugangsdaten keine Weiterleitung — sie gingen
      // sonst an einen Host, den niemand geprueft hat.
      redirect: authorization ? 'error' : 'follow',
      ...(authorization ? { headers: { authorization } } : {}),
    })
  } catch {
    return { ok: false, code: 'unreachable' }
  }
  if (!res.ok) return { ok: false, code: 'http', status: res.status }
  const typ = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!BILDTYPEN.has(typ)) return { ok: false, code: 'not-image' }
  const laenge = Number(res.headers.get('content-length') ?? 0)
  if (laenge > SNAPSHOT_MAX_BYTES) return { ok: false, code: 'too-large' }

  let bytes: Uint8Array
  try {
    bytes = await leseBegrenzt(res, SNAPSHOT_MAX_BYTES)
  } catch (e) {
    return { ok: false, code: e instanceof ZuGross ? 'too-large' : 'unreachable' }
  }
  return {
    ok: true,
    dataUri: `data:${typ};base64,${Buffer.from(bytes).toString('base64')}`,
    fetchedAt: jetzt().toISOString(),
  }
}

class ZuGross extends Error {}

async function leseBegrenzt(res: Response, max: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(await res.arrayBuffer())
  const reader = res.body.getReader()
  const teile: Uint8Array[] = []
  let summe = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    summe += value.byteLength
    if (summe > max) {
      await reader.cancel()
      throw new ZuGross()
    }
    teile.push(value)
  }
  const out = new Uint8Array(summe)
  let pos = 0
  for (const t of teile) {
    out.set(t, pos)
    pos += t.byteLength
  }
  return out
}
