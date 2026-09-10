// ───────────────────────────────────────────────────────────────────────────
// Kamera-Barcode-/QR-Scanner.
//
// ─── WARUM DAS NICHT MEHR NUR `BarcodeDetector` IST ────────────────────────
//
// Weil es diese API auf dem Desktop nicht gibt. Chromium implementiert
// `BarcodeDetector` nur auf Android, macOS und ChromeOS; unter Windows und
// Linux fehlt sie. Gemessen im echten Fenster dieses Repos (Electron,
// Chrome/148, Linux):
//
//     { BarcodeDetector: false, getUserMedia: true }
//
// Die Kamera war also da, der Decoder nicht. Die Oberflaeche hat das ehrlich
// gemeldet („Kamera-Scan hier nicht verfuegbar") und auf die Handeingabe
// zurueckgeschaltet — aber ehrlich zu sein ueber eine Funktion, die auf der
// haeufigsten Plattform gar nicht laeuft, ist kein Ersatz dafuer, dass sie
// laeuft. Wer im Lager 200 Etiketten abhaken will, tippt sie sonst ab.
//
// ─── DIE ZWEI WEGE, UND WARUM BEIDE ────────────────────────────────────────
//
// 1. `BarcodeDetector`, wo es sie gibt. Sie kostet nichts: kein Download,
//    keine WASM-Instanz, die Dekodierung laeuft im Browser-Prozess.
// 2. `zxing-wasm` sonst — 1,09 MB WASM, per `import()` NACHGELADEN und nicht
//    im Haupt-Chunk. Wer nie scannt, laedt es nie.
//
// Die Reihenfolge ist Absicht und keine Bequemlichkeit: die native API ist
// auf einem Telefon spuerbar sparsamer, und die Mobile-Ansicht (die ihren
// eigenen Scan-Weg hat) laeuft ohnehin auf Geraeten, die sie mitbringen.
//
// ─── OFFLINE, UND ZWAR WIRKLICH ────────────────────────────────────────────
//
// `zxing-wasm` sucht seine `.wasm` standardmaessig neben dem eigenen Skript.
// In einem Vite-Bundle waere das `/assets/zxing_reader.wasm` — eine Datei,
// die dort nicht liegt. Deshalb kommt die Adresse hier aus einem `?url`-
// Import: Vite legt die Datei mit ins Bundle und setzt den Pfad ein. Die App
// ist offline-first; ein Decoder, der beim ersten Scan ins Netz greift, ist
// im Hallen-WLAN genau dann kaputt, wenn er gebraucht wird.
// ───────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import { keepScreenAwake } from './wakeLock'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

/**
 * Ist Kamera-Scannen in dieser Umgebung moeglich?
 *
 * Seit dem WASM-Rueckfall haengt das nur noch an der KAMERA. Vorher stand
 * hier zusaetzlich `'BarcodeDetector' in window`, und das machte die Antwort
 * auf Windows und Linux zu einem Nein, obwohl die Kamera bereitstand.
 */
export const isBarcodeScannerSupported = (): boolean =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

export interface ScannerHandle {
  stop: () => void
}

/** Die Symbologien, die im Lager und auf den Etiketten vorkommen. */
const FORMATS = ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a']

/** Dieselbe Liste in der Schreibweise von zxing (`QRCode` statt `qr_code`). */
const ZXING_FORMATS = ['QRCode', 'Code128', 'Code39', 'EAN-13', 'EAN-8', 'UPC-A']

/**
 * Ein Decoder: bekommt ein Bild und gibt den ersten gefundenen Rohwert.
 *
 * Die beiden Wege unterscheiden sich in ihrer Eingabe — die native API
 * dekodiert direkt aus dem `<video>`, zxing braucht `ImageData`. Deshalb
 * nimmt diese Grenze das `<video>` und nicht das Bild: sonst muesste der
 * native Weg unnoetig ueber ein Canvas gehen.
 */
type Decoder = (video: HTMLVideoElement) => Promise<string | null>

const nativerDecoder = (): Decoder | null => {
  const Detector = typeof window !== 'undefined' ? (window as any).BarcodeDetector : undefined
  if (!Detector) return null
  let detector: any = null
  return async (video) => {
    if (!detector) {
      const unterstuetzt: string[] =
        (await Detector.getSupportedFormats?.().catch(() => FORMATS)) ?? FORMATS
      detector = new Detector({ formats: FORMATS.filter((f) => unterstuetzt.includes(f)) })
    }
    const codes = await detector.detect(video)
    const wert = codes?.[0]?.rawValue
    return wert ? String(wert).trim() || null : null
  }
}

/**
 * Das Zwischen-Canvas fuer den WASM-Weg — EINES, nicht eines je Bild.
 *
 * Und kleiner als das Kamerabild: zxing dekodiert ein 1920er Bild deutlich
 * langsamer als ein 640er, und fuer einen Code, der formatfuellend vor der
 * Linse haengt, aendert die Aufloesung am Ergebnis nichts.
 */
const ZIEL_BREITE = 640

const wasmDecoder = async (): Promise<Decoder> => {
  const { prepareZXingModule, readBarcodes } = await import('zxing-wasm/reader')
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
      formats: ZXING_FORMATS as never,
      tryHarder: true,
      maxNumberOfSymbols: 1,
    })
    const wert = treffer[0]?.text
    return wert ? wert.trim() || null : null
  }
}

/**
 * Wie oft der WASM-Weg ein Bild ansieht.
 *
 * Nicht `requestAnimationFrame`: eine WASM-Dekodierung je Bildwiederholung
 * laestet einen Laptop-Kern voll aus, waehrend die Kamera daneben laeuft.
 * Alle 120 ms sind fuer die Hand, die ein Etikett vor die Linse haelt,
 * ununterscheidbar von „sofort" — der native Weg bleibt bei `rAF`, weil er
 * fast nichts kostet.
 */
const WASM_TAKT_MS = 120

/**
 * Startet die Kamera im gegebenen `<video>`, erkennt fortlaufend Codes und
 * ruft `onDetect` mit dem ersten Rohwert. Rueckgabe stoppt Kamera + Schleife.
 * Wirft, wenn die Kamera nicht verfuegbar ist (Aufrufer faengt das ab).
 */
export const startCameraScan = async (
  video: HTMLVideoElement,
  onDetect: (code: string) => void,
): Promise<ScannerHandle> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  })
  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  await video.play().catch(() => {})

  // Bedarf 69: das Telefon darf nicht mitten im Scan zugehen. Die Sperre
  // haengt am SCAN, nicht an einem Knopf — sie beginnt mit der Kamera und
  // endet mit ihr, also kann sie nicht versehentlich stehenbleiben.
  const awake = keepScreenAwake()

  let running = true
  let raf = 0
  let timer = 0

  const aufraeumen = () => {
    running = false
    cancelAnimationFrame(raf)
    window.clearTimeout(timer)
    stream.getTracks().forEach((t) => t.stop())
    video.srcObject = null
    awake.release()
  }

  const nativ = nativerDecoder()
  // Der WASM-Weg wird ERST HIER geladen, nicht beim Import dieses Moduls:
  // wer den Scanner nie oeffnet, zieht die 1,09 MB nie.
  const decoder: Decoder = nativ ?? (await wasmDecoder())
  // Der Ladevorgang kann laenger dauern als die Geduld des Aufrufers; wurde
  // in der Zwischenzeit gestoppt, faengt die Schleife gar nicht erst an.
  if (!running) return { stop: aufraeumen }

  const schritt = async () => {
    if (!running) return
    try {
      const wert = await decoder(video)
      if (wert) {
        onDetect(wert)
        return
      }
    } catch {
      /* Frame noch nicht bereit oder transienter Decode-Fehler — weiter */
    }
    if (!running) return
    if (nativ) raf = requestAnimationFrame(() => void schritt())
    else timer = window.setTimeout(() => void schritt(), WASM_TAKT_MS)
  }
  void schritt()

  return { stop: aufraeumen }
}
