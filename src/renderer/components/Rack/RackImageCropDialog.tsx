import { useEffect, useMemo, useRef, useState } from 'react'

interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

interface RackImageCropDialogProps {
  open: boolean
  imageSrc: string | null
  rackUnits: number
  side: 'front' | 'rear'
  onCancel: () => void
  onConfirm: (payload: { dataUrl: string; crop: CropRect }) => void
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const defaultCrop = (units: number): CropRect => {
  // Approx 19" panel aspect: width / (1HE height) ~= 10.86
  const targetAspect = 10.86 / Math.max(1, units)
  if (targetAspect >= 1) {
    const width = 0.9
    const height = width / targetAspect
    return { x: 0.05, y: Math.max(0.05, (1 - height) / 2), width, height: Math.min(0.9, height) }
  }
  const height = 0.9
  const width = height * targetAspect
  return { x: Math.max(0.05, (1 - width) / 2), y: 0.05, width: Math.min(0.9, width), height }
}

export const RackImageCropDialog = ({
  open,
  imageSrc,
  rackUnits,
  side,
  onCancel,
  onConfirm,
}: RackImageCropDialogProps) => {
  const [crop, setCrop] = useState<CropRect>(defaultCrop(rackUnits))
  const [dragging, setDragging] = useState(false)
  const [pointerOffset, setPointerOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (open) setCrop(defaultCrop(rackUnits))
  }, [open, rackUnits, imageSrc])

  const hePresets = useMemo(() => [1, 2, 3, 4, 6, 8, 12], [])

  if (!open || !imageSrc) return null

  const toNormalized = (event: React.MouseEvent<HTMLDivElement, MouseEvent>): { x: number; y: number } | null => {
    const host = event.currentTarget.getBoundingClientRect()
    if (host.width <= 0 || host.height <= 0) return null
    const x = clamp((event.clientX - host.left) / host.width, 0, 1)
    const y = clamp((event.clientY - host.top) / host.height, 0, 1)
    return { x, y }
  }

  const finalizeCrop = () => {
    const img = imgRef.current
    if (!img) return

    const sourceW = img.naturalWidth
    const sourceH = img.naturalHeight
    if (sourceW <= 0 || sourceH <= 0) return

    const sx = Math.round(crop.x * sourceW)
    const sy = Math.round(crop.y * sourceH)
    const sw = Math.max(1, Math.round(crop.width * sourceW))
    const sh = Math.max(1, Math.round(crop.height * sourceH))

    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

    onConfirm({ dataUrl: canvas.toDataURL('image/png'), crop })
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-6">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-auto rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">{side === 'front' ? 'Front' : 'Rear'} Grafik zuschneiden</h3>
            <p className="text-xs text-slate-400">Schnittvorlagen wie im Snipping-Tool. Ziehen, dann speichern.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
          >
            Schliessen
          </button>
        </div>

        <div className="mb-3 grid grid-cols-[1fr_auto] gap-3">
          <div className="rounded border border-slate-700 bg-slate-950/40 p-2">
            <div className="relative mx-auto max-h-[70vh] w-full overflow-hidden rounded border border-slate-700">
              <img ref={imgRef} src={imageSrc} alt="Rack crop source" className="h-auto max-h-[70vh] w-full object-contain" />
              <div
                className="absolute inset-0"
                onMouseMove={(event) => {
                  if (!dragging) return
                  const host = event.currentTarget.getBoundingClientRect()
                  const nx = clamp((event.clientX - host.left) / host.width - pointerOffset.x, 0, 1 - crop.width)
                  const ny = clamp((event.clientY - host.top) / host.height - pointerOffset.y, 0, 1 - crop.height)
                  setCrop((current) => ({ ...current, x: nx, y: ny }))
                }}
                onMouseUp={() => setDragging(false)}
                onMouseLeave={() => setDragging(false)}
              >
                <div
                  className="absolute border-2 border-cyan-400 bg-cyan-500/15"
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.width * 100}%`,
                    height: `${crop.height * 100}%`,
                  }}
                  onMouseDown={(event) => {
                    const host = (event.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect()
                    const rect = event.currentTarget.getBoundingClientRect()
                    setPointerOffset({
                      x: (event.clientX - rect.left) / host.width,
                      y: (event.clientY - rect.top) / host.height,
                    })
                    setDragging(true)
                  }}
                />
              </div>
            </div>
          </div>

          <div className="w-[280px] space-y-2 rounded border border-slate-700 bg-slate-950/40 p-2 text-xs">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Schnittvorlagen (HE)</div>
            <div className="grid grid-cols-4 gap-1">
              {hePresets.map((he) => (
                <button
                  key={he}
                  type="button"
                  onClick={() => setCrop(defaultCrop(he))}
                  className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                  title={`Vorlage ${he} HE`}
                >
                  {he}HE
                </button>
              ))}
            </div>

            <label className="block">
              X
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={crop.x}
                onChange={(event) => {
                  const value = clamp(Number(event.target.value) || 0, 0, 1 - crop.width)
                  setCrop((current) => ({ ...current, x: value }))
                }}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1"
              />
            </label>
            <label className="block">
              Y
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={crop.y}
                onChange={(event) => {
                  const value = clamp(Number(event.target.value) || 0, 0, 1 - crop.height)
                  setCrop((current) => ({ ...current, y: value }))
                }}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1"
              />
            </label>
            <label className="block">
              Breite
              <input
                type="number"
                step="0.01"
                min={0.05}
                max={1}
                value={crop.width}
                onChange={(event) => {
                  const width = clamp(Number(event.target.value) || 0.1, 0.05, 1)
                  setCrop((current) => ({ ...current, width, x: clamp(current.x, 0, 1 - width) }))
                }}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1"
              />
            </label>
            <label className="block">
              Hohe
              <input
                type="number"
                step="0.01"
                min={0.05}
                max={1}
                value={crop.height}
                onChange={(event) => {
                  const height = clamp(Number(event.target.value) || 0.1, 0.05, 1)
                  setCrop((current) => ({ ...current, height, y: clamp(current.y, 0, 1 - height) }))
                }}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={finalizeCrop}
            className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
          >
            Zuschnitt ubernehmen
          </button>
        </div>
      </div>
    </div>
  )
}
