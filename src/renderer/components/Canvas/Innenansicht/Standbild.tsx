// #1240 — Standbilder in den Media-Pool laden: „Bild laden…“ und Drag & Drop
// am Mediaplayer-Knoten und im Media-Pool, Vorschau, Entfernen, Ersetzen.
//
// Das Bild liegt im Projekt (`project.fotos`, PNG bleibt PNG). Das geht in
// der Desktop-App wie im Browser und auch, bevor das Projekt einen Ordner
// hat. Vorhandene Bild-Anhaenge (Ordner „Anhaenge“) bleiben waehlbar.
import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useTranslation } from '../../../lib/i18n'
import type { MediaSlotState } from '../../../lib/switching'
import { useStillBild } from './useStandbild'

/** Die erste Bilddatei aus einem Drop. */
const bildAusDrop = (e: DragEvent): File | null => {
  const f = Array.from(e.dataTransfer?.files ?? []).find(
    (x) => /^image\//.test(x.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(x.name),
  )
  return f ?? null
}

/** Ablageflaeche: nimmt eine Bilddatei per Drag & Drop an. */
export const BildAblage = ({
  onFile,
  className,
  children,
  testId,
}: {
  onFile: (f: File) => void
  className?: string
  children: ReactNode
  testId?: string
}) => {
  const [ueber, setUeber] = useState(false)
  return (
    <div
      data-testid={testId}
      className={`${className ?? ''} ${ueber ? 'outline outline-2 outline-cp-accent' : ''}`}
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'copy'
        setUeber(true)
      }}
      onDragLeave={() => setUeber(false)}
      onDrop={(e) => {
        setUeber(false)
        const f = bildAusDrop(e)
        if (!f) return
        e.preventDefault()
        e.stopPropagation()
        onFile(f)
      }}
    >
      {children}
    </div>
  )
}

/** Knopf „Bild laden…“ mit verstecktem Dateifeld. */
export const BildLadenKnopf = ({
  onFile,
  ersetzen,
  testId,
}: {
  onFile: (f: File) => void
  ersetzen?: boolean
  testId?: string
}) => {
  const t = useTranslation()
  const eingabe = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        data-testid={testId}
        onClick={(e) => {
          e.stopPropagation()
          eingabe.current?.click()
        }}
        className="nodrag rounded-cp-s px-1.5 py-0.5 text-cp-accent hover:bg-cp-surface-3"
      >
        {ersetzen ? t('switching.media.replace', 'Replace…') : t('switching.media.load', 'Load image…')}
      </button>
      <input
        ref={eingabe}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        className="hidden"
        data-testid={testId ? `${testId}-datei` : undefined}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
    </>
  )
}

/** Vorschaubild eines Platzes, leer ohne Bild. */
export const StillVorschau = ({ refState, gross }: { refState: MediaSlotState | undefined; gross?: boolean }) => {
  const { src } = useStillBild(refState)
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      data-testid="standbild-vorschau"
      className={`${gross ? 'h-16 w-28' : 'h-8 w-14'} rounded-cp-s border border-cp-border bg-cp-surface-3 object-contain`}
    />
  )
}

/** Dateiname des geladenen Bilds. */
export const StillName = ({ refState }: { refState: MediaSlotState | undefined }) => {
  const { name } = useStillBild(refState)
  return name ? <span className="min-w-0 flex-1 truncate text-cp-text-secondary">{name}</span> : null
}
