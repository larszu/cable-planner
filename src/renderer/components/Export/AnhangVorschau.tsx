import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { useTranslation } from '../../lib/i18n'
import { cablePlannerApi } from '../../lib/bridge'
import { pdfRenderer } from '../../lib/grundriss/pdfRenderer'
import type { ProjektAnhang } from '../../types/anhang'

type Zustand = { art: 'laedt' } | { art: 'bild'; src: string; seiten?: number } | { art: 'nicht' }

/** Bytes als data:-URL — ohne `Blob`-URL, die sonst jemand freigeben muesste. */
const alsDataUrl = (mediaType: string, daten: Uint8Array): string => {
  let bin = ''
  for (let i = 0; i < daten.length; i += 0x8000) bin += String.fromCharCode(...daten.subarray(i, i + 0x8000))
  return `data:${mediaType};base64,${btoa(bin)}`
}

/**
 * #1186 — Vorschau eines Anhangs: ein Bild wie es ist, ein PDF als Bild der
 * ersten Seite (pdf.js, dieselbe Strecke wie beim Hallenplan). Wer mehr will,
 * oeffnet die Datei ueber „Im Ordner zeigen" mit dem eigenen Programm.
 */
export const AnhangVorschau = ({
  anhang,
  projectPath,
  onClose,
}: {
  anhang: ProjektAnhang
  projectPath?: string
  onClose: () => void
}) => {
  const t = useTranslation()
  const [z, setZ] = useState<Zustand>({ art: 'laedt' })
  useEffect(() => {
    let aktiv = true
    void (async () => {
      const r = await cablePlannerApi.attachment.preview(projectPath, anhang.datei.storedAs).catch(() => null)
      if (!r) return aktiv && setZ({ art: 'nicht' })
      if (r.mediaType === 'application/pdf') {
        const seite = await pdfRenderer(r.daten, 1, 1600).catch(() => null)
        if (aktiv) setZ(seite ? { art: 'bild', src: seite.dataUrl, seiten: seite.seiten } : { art: 'nicht' })
      } else if (aktiv) setZ({ art: 'bild', src: alsDataUrl(r.mediaType, r.daten) })
    })()
    return () => {
      aktiv = false
    }
  }, [anhang.datei.storedAs, projectPath])
  return (
    <ModalShell
      open
      onClose={onClose}
      title={anhang.titel || anhang.datei.fileName}
      titleIcon={<Icon icon={Eye} size="md" />}
      maxWidth="3xl"
      zIndex={80}
    >
      <div className="text-cp-sm">
        {z.art === 'laedt' && <p className="text-cp-text-muted">{t('attachments.previewLoading', 'Loading preview…')}</p>}
        {z.art === 'nicht' && (
          <p className="text-cp-text-muted">
            {t('attachments.previewNone', 'No preview for this file. Open it from the folder.')}
          </p>
        )}
        {z.art === 'bild' && (
          <>
            <img src={z.src} alt="" className="mx-auto max-h-[70vh] max-w-full border border-cp-border bg-white object-contain" />
            {z.seiten !== undefined && z.seiten > 1 && (
              <p className="mt-1 text-cp-xs text-cp-text-muted">
                {t('attachments.previewFirstPage', 'First page shown; the document has more.')}
              </p>
            )}
          </>
        )}
      </div>
    </ModalShell>
  )
}
