import { useRef, useState } from 'react'
import type { Grundriss } from '../../types/grundriss'
import { useTranslation } from '../../lib/i18n'
import { grundrissZuschneiden, zuschnittAus, zuschnittGueltig, type Zuschnitt } from '../../lib/grundriss/zuschnitt'

/** #984 — Ausschnitt in einer Vorschau aufziehen und ins Bild uebernehmen. */
export const GrundrissZuschnitt = ({
  g,
  uebernehmen,
  schliessen,
}: {
  g: Grundriss
  uebernehmen: (patch: Partial<Grundriss>) => void
  schliessen: () => void
}) => {
  const t = useTranslation()
  const flaeche = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [z, setZ] = useState<Zuschnitt | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  const rel = (e: React.PointerEvent) => {
    const r = flaeche.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const gueltig = !!z && zuschnittGueltig(z, g)

  return (
    <div className="space-y-2" data-testid="grundriss-zuschnitt">
      <p className="text-cp-text-muted">{t('floorplan.crop.help', 'Drag a rectangle over the part of the plan you want to keep.')}</p>
      <div
        ref={flaeche}
        className="relative cursor-crosshair touch-none select-none overflow-hidden rounded-cp-s border border-cp-border"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          start.current = rel(e)
          setZ(null)
        }}
        onPointerMove={(e) => {
          if (start.current) setZ(zuschnittAus(start.current, rel(e)))
        }}
        onPointerUp={(e) => {
          if (start.current) setZ(zuschnittAus(start.current, rel(e)))
          start.current = null
        }}
      >
        <img src={g.src} alt={g.name ?? ''} draggable={false} className="block w-full" />
        {z && (
          <div
            className="pointer-events-none absolute border-2 border-cp-accent"
            style={{
              left: `${z.x * 100}%`,
              top: `${z.y * 100}%`,
              width: `${z.w * 100}%`,
              height: `${z.h * 100}%`,
              boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.45)',
            }}
          />
        )}
      </div>
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-cp-control bg-cp-accent px-2 py-1 text-cp-bg disabled:opacity-50"
          disabled={!gueltig || laeuft}
          onClick={async () => {
            if (!z) return
            setLaeuft(true)
            try {
              uebernehmen(await grundrissZuschneiden(g, z))
              schliessen()
            } finally {
              setLaeuft(false)
            }
          }}
        >
          {t('floorplan.crop.apply', 'Crop plan')}
        </button>
        <button className="rounded-cp-control border border-cp-border px-2 py-1 hover:bg-cp-surface-3" onClick={schliessen}>
          {t('common.cancel', 'Cancel')}
        </button>
      </div>
    </div>
  )
}
