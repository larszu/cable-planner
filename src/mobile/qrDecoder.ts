// ───────────────────────────────────────────────────────────────────────────
// Der QR-Decoder der Mobile-Ansicht — nativ, wo es ihn gibt, sonst WASM.
//
// ─── DER BEFUND (#821) ─────────────────────────────────────────────────────
//
// Die Mobile-Ansicht hing allein an `BarcodeDetector`. Die API gibt es in
// Chromium nur auf Android, macOS und ChromeOS — auf iOS Safari und in jedem
// Desktop-Browser im LAN nicht:
//
//     Android Chrome        ja     -> Scan lief
//     iOS Safari            NEIN   -> zu, nur Handeingabe
//     Desktop-Browser (LAN) NEIN   -> zu, nur Handeingabe
//
// Die Seite sagte das ehrlich („Kamera-Scan hier nicht verfuegbar") und bot
// die Texteingabe an. Fuer jemanden mit einem iPhone im Aufbau hiess das:
// Etiketten abtippen.
//
// ─── WARUM DERSELBE DECODER WIE AM DESKTOP UND KEIN DRITTER ────────────────
//
// Das Issue stellte drei Wege nebeneinander. Gewaehlt ist der erste —
// `zxing-wasm`, dasselbe Paket, das `renderer/lib/barcodeScanner.ts` seit
// #819 benutzt. Der zweite (ein QR-only-Decoder wie `jsqr`, ~15 kB) waere
// kleiner und WAERE hier sogar ausreichend, weil diese Ansicht ohnehin nur
// QR liest. Er waere aber eine DRITTE Decoder-Bibliothek im Repo, und zwei
// Decoder, die dasselbe tun, laufen auseinander: der eine bekommt eine
// Formatliste dazu, der andere nicht, und niemand merkt es, bis im Lager ein
// Etikett nicht gelesen wird.
//
// ─── DER PREIS, UND WIE ER BEZAHLT WIRD ────────────────────────────────────
//
// Gemessen am 2026-09-10: `mobile-*.js` ist 73,9 kB (gzip 20,5 kB),
// `zxing_reader.wasm` 1093,3 kB (gzip 463,8 kB) — das 15-fache der Seite,
// ueber das Hallen-WLAN auf ein Telefon.
//
// Deshalb ist der Import DYNAMISCH: die Datei kommt erst, wenn jemand das
// Scan-Overlay oeffnet, und das ist eine bewusste Handlung und kein
// Seitenaufbau. Wer die Mobile-Ansicht nur liest, zieht sie nie. Und weil
// ein halbe-Sekunde-schwarzes-Kamerabild wie ein Defekt aussieht, meldet
// `ladeDecoder` den Ladezustand an den Aufrufer, statt ihn zu verschlucken.
// ───────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

/** Ein Decoder: bekommt das laufende `<video>` und gibt den ersten QR-Wert. */
export type QrDecoder = (video: HTMLVideoElement) => Promise<string | null>

type BarcodeDetectorLike = {
  detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike

const nativerDetector = (): BarcodeDetectorCtor | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector

/**
 * Kann diese Umgebung ueberhaupt scannen?
 *
 * Seit dem WASM-Rueckfall haengt das nur noch an SICHEREM KONTEXT und
 * KAMERA. Vorher stand hier zusaetzlich `BarcodeDetector`, und genau das
 * machte die Antwort auf jedem iPhone zu einem Nein.
 *
 * Der sichere Kontext bleibt drin und ist keine Nachlaessigkeit: `mobileShare`
 * liefert ueber `http://` aus, und dort sperrt der Browser `getUserMedia`
 * selbst. Ohne diese Bedingung boete die Seite einen Knopf an, der zuverlaessig
 * in eine Fehlermeldung laeuft.
 */
export const cameraScanSupported = (): boolean =>
  typeof window !== 'undefined' &&
  window.isSecureContext === true &&
  !!navigator.mediaDevices?.getUserMedia

/**
 * Das Zwischen-Canvas fuer den WASM-Weg — EINES, nicht eines je Bild, und
 * kleiner als das Kamerabild. Dieselbe Begruendung wie am Desktop: zxing
 * dekodiert ein 1920er Bild deutlich langsamer als ein 640er, und fuer einen
 * QR, den jemand vor die Linse haelt, aendert die Aufloesung nichts.
 */
const ZIEL_BREITE = 640

const wasmDecoder = async (): Promise<QrDecoder> => {
  const { prepareZXingModule, readBarcodes } = await import('zxing-wasm/reader')
  // `zxing-wasm` sucht seine `.wasm` sonst neben dem eigenen Skript. Der
  // `?url`-Import legt sie mit ins Bundle; `locateFile` zeigt darauf. Die
  // Mobile-Ansicht wird aus dem LAN geliefert und hat kein Netz dahinter.
  prepareZXingModule({ overrides: { locateFile: () => wasmUrl } })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    if (!ctx || !video.videoWidth) return null
    const faktor = Math.min(1, ZIEL_BREITE / video.videoWidth)
    canvas.width = Math.max(1, Math.round(video.videoWidth * faktor))
    canvas.height = Math.max(1, Math.round(video.videoHeight * faktor))
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const bild = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const treffer = await readBarcodes(bild, {
      formats: ['QRCode'] as never,
      tryHarder: true,
      maxNumberOfSymbols: 1,
    })
    const wert = treffer[0]?.text
    return wert ? wert.trim() || null : null
  }
}

const nativerWeg = (): QrDecoder | null => {
  const Detector = nativerDetector()
  if (!Detector) return null
  const detector = new Detector({ formats: ['qr_code'] })
  return async (video) => {
    const codes = await detector.detect(video)
    const wert = codes.find((c) => c.rawValue)?.rawValue
    return wert ? String(wert).trim() || null : null
  }
}

/**
 * Wie oft der WASM-Weg ein Bild ansieht.
 *
 * Nicht `requestAnimationFrame`: eine WASM-Dekodierung je Bildwiederholung
 * laestet ein Telefon aus, waehrend die Kamera daneben laeuft, und leert
 * genau den Akku, der im Aufbau reichen muss. Alle 120 ms sind fuer die Hand,
 * die einen Code vor die Linse haelt, ununterscheidbar von „sofort".
 */
export const WASM_TAKT_MS = 120

export interface DecoderErgebnis {
  decode: QrDecoder
  /** War der native Weg da? Bestimmt den Takt der Schleife. */
  nativ: boolean
}

/**
 * Den passenden Decoder besorgen — nativ ohne Wartezeit, sonst nachgeladen.
 *
 * Die Reihenfolge ist Absicht: die native API kostet keinen Download und
 * keine WASM-Instanz, und die Geraete, die sie mitbringen (Android), sind
 * genau die, auf denen die Mobile-Ansicht am haeufigsten laeuft.
 */
export const ladeDecoder = async (): Promise<DecoderErgebnis> => {
  const nativ = nativerWeg()
  if (nativ) return { decode: nativ, nativ: true }
  return { decode: await wasmDecoder(), nativ: false }
}
