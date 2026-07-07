// ───────────────────────────────────────────────────────────────────────────
// Kamera-Barcode-/QR-Scanner — dünne Hülle um die Browser-`BarcodeDetector`-API.
//
// Funktioniert im sicheren Kontext (Electron-Renderer, localhost, HTTPS). Über
// unverschlüsseltes LAN blockieren Browser Kamera-Zugriff — dort greift die
// manuelle Code-Eingabe. Erkennt QR + gängige 1D-Symbologien (Code128/39,
// EAN). Ehrlich degradierend: ohne Support liefert `isBarcodeScannerSupported`
// false und die UI zeigt nur das Eingabefeld.
// ───────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Ist Kamera-Scannen in dieser Umgebung möglich? */
export const isBarcodeScannerSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'BarcodeDetector' in window &&
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia

export interface ScannerHandle {
  stop: () => void
}

const FORMATS = ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a']

/**
 * Startet die Kamera im gegebenen <video>, erkennt fortlaufend Codes und ruft
 * `onDetect` mit dem ersten Rohwert je Frame. Rückgabe stoppt Kamera + Loop.
 * Wirft, wenn Kamera/Detector nicht verfügbar sind (Aufrufer fängt das ab).
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

  const Detector = (window as any).BarcodeDetector
  const supported: string[] = (await Detector.getSupportedFormats?.().catch(() => FORMATS)) ?? FORMATS
  const detector = new Detector({ formats: FORMATS.filter((f) => supported.includes(f)) })

  let running = true
  let raf = 0
  const loop = async () => {
    if (!running) return
    try {
      const codes = await detector.detect(video)
      if (codes && codes.length) {
        const value = String(codes[0].rawValue ?? '').trim()
        if (value) onDetect(value)
      }
    } catch {
      /* Frame noch nicht bereit — nächster Versuch */
    }
    if (running) raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  return {
    stop: () => {
      running = false
      cancelAnimationFrame(raf)
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    },
  }
}
