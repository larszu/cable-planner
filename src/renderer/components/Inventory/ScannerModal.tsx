import { useEffect, useRef, useState } from 'react'
import { X, Camera } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { startCameraScan, type ScannerHandle } from '../../lib/barcodeScanner'

// Kamera-Scanner-Overlay: startet beim Öffnen die Kamera, erkennt Codes und
// meldet den ersten Treffer zurück. Schließt sich nach Erkennung. Fällt
// verständlich zurück, wenn die Kamera nicht freigegeben/verfügbar ist.
export interface ScannerModalProps {
  open: boolean
  onClose: () => void
  onDetect: (code: string) => void
}

export const ScannerModal = ({ open, onClose, onDetect }: ScannerModalProps) => {
  const t = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const handleRef = useRef<ScannerHandle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const video = videoRef.current
    if (!video) return
    startCameraScan(video, (code) => {
      onDetect(code)
      onClose()
    })
      .then((h) => {
        if (cancelled) h.stop()
        else handleRef.current = h
      })
      .catch(() => {
        if (!cancelled) setError(t('scanner.error', 'Kamera nicht verfügbar oder nicht freigegeben. Nutze die manuelle Eingabe.'))
      })
    return () => {
      cancelled = true
      handleRef.current?.stop()
      handleRef.current = null
    }
    // onDetect/onClose sind stabil genug; nur an `open` koppeln.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-cp-border bg-cp-bg shadow-2xl">
        <header className="flex items-center justify-between border-b border-cp-border-muted px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-cp-md font-semibold">
            <Camera size={16} /> {t('scanner.title', 'Code scannen')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text"
            aria-label={t('common.close', 'Schließen')}
          >
            <X size={18} />
          </button>
        </header>
        <div className="relative aspect-square bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {/* Zielrahmen */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-2/3 w-2/3 rounded-lg border-2 border-white/70" />
          </div>
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-cp-sm text-cp-text-secondary">
              {error}
            </div>
          )}
        </div>
        <div className="px-4 py-2 text-center text-cp-xs text-cp-text-muted">
          {t('scanner.hint', 'QR- oder Barcode in den Rahmen halten.')}
        </div>
      </div>
    </div>
  )
}
