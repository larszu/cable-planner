import { useEffect, useMemo, useRef, useState } from 'react'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { format, useTranslation } from '../../lib/i18n'

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

// 19" rack panel aspect: outer 482.6 mm / 1U 44.45 mm = 10.857 (width / 1HE-height).
const PANEL_ASPECT_PER_1HE = 10.857
const HE_PRESETS = [1, 2, 3, 4, 6, 8, 12]

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

// Default crop rectangle (normalized 0..1) sized to the requested HE-aspect,
// centered in the source image with sane padding so the user always sees the
// full crop frame before adjusting it.
//
// IMPORTANT: the crop rect lives in normalized [0..1] coordinates of the
// source image. To make the rect look like a real rack panel on screen we
// must convert the pixel target aspect (width/height in real pixels) into a
// normalized aspect by dividing by the source image aspect. Without this the
// preset boxes were the wrong shape on non-square images.
const defaultCrop = (units: number, imageAspect: number): CropRect => {
  const pixelAspect = PANEL_ASPECT_PER_1HE / Math.max(1, units)
  const normAspect = pixelAspect / Math.max(0.0001, imageAspect)
  if (normAspect >= 1) {
    const width = 0.9
    const height = Math.min(0.9, width / normAspect)
    return { x: (1 - width) / 2, y: (1 - height) / 2, width, height }
  }
  const height = 0.9
  const width = Math.min(0.9, height * normAspect)
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height }
}

// Eight resize anchors. Each entry encodes which crop edges the handle moves
// when dragged: dx/dy = pull from left/top edge, dw/dh = pull from right/bottom.
type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const HANDLE_DEFS: Record<HandleId, { left: string; top: string; cursor: string }> = {
  nw: { left: '0%', top: '0%', cursor: 'nwse-resize' },
  n: { left: '50%', top: '0%', cursor: 'ns-resize' },
  ne: { left: '100%', top: '0%', cursor: 'nesw-resize' },
  e: { left: '100%', top: '50%', cursor: 'ew-resize' },
  se: { left: '100%', top: '100%', cursor: 'nwse-resize' },
  s: { left: '50%', top: '100%', cursor: 'ns-resize' },
  sw: { left: '0%', top: '100%', cursor: 'nesw-resize' },
  w: { left: '0%', top: '50%', cursor: 'ew-resize' },
}

const MIN_SIZE = 0.04 // 4 % of source image — prevents collapsing the crop box.

export const RackImageCropDialog = ({
  open,
  imageSrc,
  rackUnits,
  side,
  onCancel,
  onConfirm,
}: RackImageCropDialogProps) => {
  const t = useTranslation()
  const [crop, setCrop] = useState<CropRect>(defaultCrop(rackUnits, 1))
  const [zoom, setZoom] = useState(1)
  const [aspectLock, setAspectLock] = useState(true)
  const [activeHandle, setActiveHandle] = useState<HandleId | 'move' | null>(null)
  // Tracks the source image's pixel aspect (naturalWidth / naturalHeight) so
  // every preset / aspect-lock calculation maps from pixel-space to the
  // normalized [0..1] crop coordinates correctly. Defaults to 1 until onLoad
  // fires — then the effect below resets the crop to a properly shaped box.
  const [imgAspect, setImgAspect] = useState(1)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<{ pointerNx: number; pointerNy: number; crop: CropRect } | null>(null)
  const { containerRef, containerStyle, headerProps } = useDraggablePosition(
    'cable-planner:modal-pos:rack-crop',
    open,
  )

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Crop-Draft beim Dialog-Öffnen seeden (keyed sync)
      setCrop(defaultCrop(rackUnits, imgAspect))
      setZoom(1)
      setAspectLock(true)
    }
  }, [open, rackUnits, imageSrc, imgAspect])

  // Live HE estimate derived from the current crop's *pixel* aspect ratio.
  // The crop rect is normalized to [0..1] of the source image, so we have to
  // multiply by the image's pixel aspect to get the real-world panel aspect.
  const liveHe = useMemo(() => {
    if (crop.width <= 0 || crop.height <= 0) return rackUnits
    const cropPixelAspect = (crop.width / crop.height) * imgAspect
    if (cropPixelAspect <= 0) return rackUnits
    return PANEL_ASPECT_PER_1HE / cropPixelAspect
  }, [crop.width, crop.height, rackUnits, imgAspect])

  // Pixel-space target aspect (used for canvas export at finalize time).
  const targetAspect = useMemo(() => PANEL_ASPECT_PER_1HE / Math.max(1, rackUnits), [rackUnits])
  // Normalized-space target aspect for resize-locking and preset framing.
  const normTargetAspect = useMemo(
    () => targetAspect / Math.max(0.0001, imgAspect),
    [targetAspect, imgAspect],
  )

  // Convert a pointer event into the overlay's normalized 0..1 coordinates.
  const pointerToNormalized = (event: React.PointerEvent | PointerEvent): { x: number; y: number } | null => {
    const el = overlayRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    }
  }

  // Apply a resize for the currently active handle, optionally constrained to
  // the panel aspect when aspect-lock is on or the user is holding shift.
  const applyResize = (handle: HandleId, pointerNx: number, pointerNy: number, lockAspect: boolean) => {
    const start = dragStartRef.current
    if (!start) return
    const c0 = start.crop
    let left = c0.x
    let top = c0.y
    let right = c0.x + c0.width
    let bottom = c0.y + c0.height

    if (handle.includes('w')) left = clamp(pointerNx, 0, right - MIN_SIZE)
    if (handle.includes('e')) right = clamp(pointerNx, left + MIN_SIZE, 1)
    if (handle.includes('n')) top = clamp(pointerNy, 0, bottom - MIN_SIZE)
    if (handle.includes('s')) bottom = clamp(pointerNy, top + MIN_SIZE, 1)

    let width = right - left
    let height = bottom - top

    if (lockAspect) {
      // Resolve aspect by adjusting whichever dimension was NOT primarily
      // dragged. For corner handles use the larger delta as the master.
      const isCorner = handle.length === 2
      const masterIsWidth = isCorner
        ? Math.abs(width - c0.width) > Math.abs(height - c0.height)
        : handle === 'e' || handle === 'w'
      if (masterIsWidth) {
        height = clamp(width / normTargetAspect, MIN_SIZE, 1)
        if (handle.includes('n')) top = clamp(bottom - height, 0, bottom - MIN_SIZE)
        else bottom = clamp(top + height, top + MIN_SIZE, 1)
        height = bottom - top
        width = height * normTargetAspect
        if (handle.includes('w')) left = clamp(right - width, 0, right - MIN_SIZE)
        else right = clamp(left + width, left + MIN_SIZE, 1)
      } else {
        width = clamp(height * normTargetAspect, MIN_SIZE, 1)
        if (handle.includes('w')) left = clamp(right - width, 0, right - MIN_SIZE)
        else right = clamp(left + width, left + MIN_SIZE, 1)
        width = right - left
        height = width / normTargetAspect
        if (handle.includes('n')) top = clamp(bottom - height, 0, bottom - MIN_SIZE)
        else bottom = clamp(top + height, top + MIN_SIZE, 1)
      }
    }

    setCrop({ x: left, y: top, width: right - left, height: bottom - top })
  }

  // Not curried: a curried handler called as onPointerDown('move') during
  // render makes the compiler treat the inner closure's ref access as
  // render-reachable (react-hooks/refs). Plain (handle, event) + an inline
  // arrow at the call site keeps the ref writes inside a real handler.
  const handlePointerDown = (handle: HandleId | 'move', event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const norm = pointerToNormalized(event)
    if (!norm) return
    dragStartRef.current = { pointerNx: norm.x, pointerNy: norm.y, crop: { ...crop } }
    setActiveHandle(handle)
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeHandle) return
    const norm = pointerToNormalized(event)
    if (!norm) return
    if (activeHandle === 'move') {
      const start = dragStartRef.current
      if (!start) return
      const dx = norm.x - start.pointerNx
      const dy = norm.y - start.pointerNy
      const nextX = clamp(start.crop.x + dx, 0, 1 - start.crop.width)
      const nextY = clamp(start.crop.y + dy, 0, 1 - start.crop.height)
      setCrop({ ...start.crop, x: nextX, y: nextY })
      return
    }
    applyResize(activeHandle, norm.x, norm.y, aspectLock || event.shiftKey)
  }

  const onPointerUp = () => {
    setActiveHandle(null)
    dragStartRef.current = null
  }

  // Wheel zoom centered on the cursor — adjusts the source-image scale and
  // keeps the pixel under the cursor stationary by scrolling the container.
  const onWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      // Plain wheel = zoom (matches Photoshop / image editors). Hold ctrl for
      // page scroll if needed.
      event.preventDefault()
      const scroller = scrollRef.current
      if (!scroller) return
      const before = scroller.getBoundingClientRect()
      const cursorX = event.clientX - before.left + scroller.scrollLeft
      const cursorY = event.clientY - before.top + scroller.scrollTop
      const factor = event.deltaY > 0 ? 0.9 : 1.1
      const nextZoom = clamp(zoom * factor, 0.5, 6)
      const ratio = nextZoom / zoom
      setZoom(nextZoom)
      // After the DOM updates, re-anchor scroll so the cursor stays put.
      requestAnimationFrame(() => {
        if (!scrollRef.current) return
        scrollRef.current.scrollLeft = cursorX * ratio - (event.clientX - before.left)
        scrollRef.current.scrollTop = cursorY * ratio - (event.clientY - before.top)
      })
    }
  }

  // Keyboard support: arrow nudge, +/- zoom, R = reset.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.05 : 0.005
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setCrop((c) => ({ ...c, x: clamp(c.x - step, 0, 1 - c.width) }))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setCrop((c) => ({ ...c, x: clamp(c.x + step, 0, 1 - c.width) }))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCrop((c) => ({ ...c, y: clamp(c.y - step, 0, 1 - c.height) }))
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCrop((c) => ({ ...c, y: clamp(c.y + step, 0, 1 - c.height) }))
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      setZoom((z) => clamp(z * 1.1, 0.5, 6))
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      setZoom((z) => clamp(z * 0.9, 0.5, 6))
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault()
      setCrop(defaultCrop(rackUnits, imgAspect))
      setZoom(1)
    }
  }

  if (!open || !imageSrc) return null

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

    // Export at a screen-derived 1HE size so panels stay visually consistent
    // across views regardless of source resolution.
    const oneHePx = Math.max(48, Math.round(window.innerHeight * 0.045))
    const targetHeight = Math.max(1, Math.round(oneHePx * Math.max(1, rackUnits)))
    const targetWidth = Math.max(1, Math.round(targetHeight * targetAspect))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
    onConfirm({ dataUrl: canvas.toDataURL('image/png'), crop })
  }

  const cropGlow = activeHandle ? '0 0 0 1px rgba(34,211,238,0.9), 0 0 18px 2px rgba(34,211,238,0.55)' : '0 0 0 1px rgba(34,211,238,0.6)'

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 outline-none"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div
        ref={containerRef}
        style={containerStyle}
        className="max-h-[94vh] w-full max-w-5xl overflow-auto rounded border border-cp-border bg-cp-surface-1 p-4 text-cp-text shadow-2xl"
      >
        <div
          {...headerProps}
          className="mb-3 flex items-start justify-between gap-3 select-none"
        >
          <div>
            <h3 className="text-cp-xl font-semibold">
              {format(
                side === 'front'
                  ? t('rackCrop.titleFront', 'Front Grafik zuschneiden ({units} HE)')
                  : t('rackCrop.titleRear', 'Rear Grafik zuschneiden ({units} HE)'),
                { units: rackUnits },
              )}
            </h3>
            <p className="mt-0.5 text-cp-xs text-cp-text-muted">
              {t(
                'rackCrop.hint',
                'Mausrad zoomt · Ecken & Kanten ziehen zum Skalieren · Shift = Aspekt halten · Pfeiltasten nudgen · R = Reset',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('rackCrop.close', 'Schliessen')}
          </button>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_280px]">
          <div className="rounded border border-cp-border bg-cp-surface-3/40 p-2">
            <div className="mb-2 flex items-center gap-2 text-cp-xs text-cp-text-muted">
              <span>{t('rackCrop.zoom', 'Zoom')}</span>
              <input
                type="range"
                min={0.5}
                max={6}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value) || 1)}
                className="flex-1"
                title={t('rackCrop.scrollHint', 'Mausrad oder + / - tut dasselbe')}
              />
              <span className="w-12 text-right tabular-nums">{zoom.toFixed(2)}x</span>
              <label className="ml-2 flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={aspectLock}
                  onChange={(event) => setAspectLock(event.target.checked)}
                />
                {t('rackCrop.lockAspect', 'Aspekt fixieren')}
              </label>
            </div>
            <div
              ref={scrollRef}
              className="relative max-h-[70vh] overflow-auto rounded border border-cp-border"
              onWheel={onWheelZoom}
            >
              <div
                className="relative mx-auto select-none"
                style={{ width: `${Math.max(480, 860 * zoom)}px` }}
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Rack crop source"
                  className="block h-auto w-full object-contain"
                  draggable={false}
                  onLoad={(event) => {
                    const target = event.currentTarget
                    if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                      setImgAspect(target.naturalWidth / target.naturalHeight)
                    }
                  }}
                />
                <div
                  ref={overlayRef}
                  className="absolute inset-0"
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  {/* Dim mask outside crop using four absolute rectangles */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 bg-black/40" style={{ height: `${crop.y * 100}%` }} />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/40" style={{ height: `${(1 - crop.y - crop.height) * 100}%` }} />
                  <div className="pointer-events-none absolute left-0 bg-black/40" style={{ top: `${crop.y * 100}%`, height: `${crop.height * 100}%`, width: `${crop.x * 100}%` }} />
                  <div className="pointer-events-none absolute right-0 bg-black/40" style={{ top: `${crop.y * 100}%`, height: `${crop.height * 100}%`, width: `${(1 - crop.x - crop.width) * 100}%` }} />

                  {/* Crop frame + handles */}
                  <div
                    className="absolute"
                    style={{
                      left: `${crop.x * 100}%`,
                      top: `${crop.y * 100}%`,
                      width: `${crop.width * 100}%`,
                      height: `${crop.height * 100}%`,
                      boxShadow: cropGlow,
                      cursor: activeHandle === 'move' ? 'grabbing' : 'grab',
                    }}
                    onPointerDown={(e) => handlePointerDown('move', e)}
                  >
                    {/* Live HE badge inside the crop box */}
                    <div className="pointer-events-none absolute right-1 top-1 rounded bg-cyan-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                      {aspectLock ? `${rackUnits} HE` : `\u2248 ${liveHe.toFixed(1)} HE`}
                    </div>
                    {/* Resize handles */}
                    {(Object.keys(HANDLE_DEFS) as HandleId[]).map((id) => {
                      const def = HANDLE_DEFS[id]
                      return (
                        <div
                          key={id}
                          onPointerDown={(e) => handlePointerDown(id, e)}
                          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-cyan-200 bg-cyan-400 hover:bg-cyan-300"
                          style={{ left: def.left, top: def.top, cursor: def.cursor, touchAction: 'none' }}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded border border-cp-border bg-cp-surface-3/40 p-2 text-cp-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-cp-text-muted">
                {t('rackCrop.presets', 'Schnittvorlagen')}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCrop(defaultCrop(rackUnits, imgAspect))
                  setZoom(1)
                }}
                className="rounded bg-cp-surface-4 px-2 py-0.5 text-[10px] hover:bg-cp-surface-5"
                title={t('rackCrop.resetTitle', 'Crop und Zoom zurücksetzen (R)')}
              >
                {t('rackCrop.reset', '⟲ Reset')}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {HE_PRESETS.map((he) => (
                <button
                  key={he}
                  type="button"
                  onClick={() => setCrop(defaultCrop(he, imgAspect))}
                  className={`rounded px-2 py-1 ${he === rackUnits ? 'bg-cyan-700 hover:bg-cyan-600' : 'bg-cp-surface-4 hover:bg-cp-surface-5'}`}
                  title={format(t('rackCrop.presetTitle', 'Vorlage {n} HE Aspekt'), { n: he })}
                >
                  {he}HE
                </button>
              ))}
            </div>

            <div className="mt-3 rounded border border-cp-border-muted bg-cp-surface-1/60 p-2">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-cp-text-muted">
                {t('rackCrop.manualValues', 'Manuelle Werte (0–1)')}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="block text-[11px]">
                  X
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    value={crop.x.toFixed(3)}
                    onChange={(event) => {
                      const value = clamp(Number(event.target.value) || 0, 0, 1 - crop.width)
                      setCrop((current) => ({ ...current, x: value }))
                    }}
                    className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-1 p-1 tabular-nums"
                  />
                </label>
                <label className="block text-[11px]">
                  Y
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    value={crop.y.toFixed(3)}
                    onChange={(event) => {
                      const value = clamp(Number(event.target.value) || 0, 0, 1 - crop.height)
                      setCrop((current) => ({ ...current, y: value }))
                    }}
                    className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-1 p-1 tabular-nums"
                  />
                </label>
                <label className="block text-[11px]">
                  {t('rackCrop.width', 'Breite')}
                  <input
                    type="number"
                    step="0.01"
                    min={MIN_SIZE}
                    max={1}
                    value={crop.width.toFixed(3)}
                    onChange={(event) => {
                      const width = clamp(Number(event.target.value) || MIN_SIZE, MIN_SIZE, 1)
                      setCrop((current) => ({ ...current, width, x: clamp(current.x, 0, 1 - width) }))
                    }}
                    className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-1 p-1 tabular-nums"
                  />
                </label>
                <label className="block text-[11px]">
                  {t('rackCrop.height', 'Höhe')}
                  <input
                    type="number"
                    step="0.01"
                    min={MIN_SIZE}
                    max={1}
                    value={crop.height.toFixed(3)}
                    onChange={(event) => {
                      const height = clamp(Number(event.target.value) || MIN_SIZE, MIN_SIZE, 1)
                      setCrop((current) => ({ ...current, height, y: clamp(current.y, 0, 1 - height) }))
                    }}
                    className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-1 p-1 tabular-nums"
                  />
                </label>
              </div>
            </div>

            <div className="rounded border border-cp-border-muted bg-cp-surface-1/60 p-2 text-[11px] text-cp-text-muted">
              <div>
                {t('rackCrop.targetAspect', 'Ziel-Aspekt:')}{' '}
                <span className="tabular-nums text-cp-text-bright">{targetAspect.toFixed(2)}:1</span>
              </div>
              <div>
                {t('rackCrop.currentAspect', 'Aktueller Crop-Aspekt:')}{' '}
                <span className="tabular-nums text-cp-text-bright">
                  {(crop.width / Math.max(0.001, crop.height)).toFixed(2)}:1
                </span>
              </div>
              <div>
                {t('rackCrop.liveHe', 'Live HE:')}{' '}
                <span className="tabular-nums text-cp-text-bright">{liveHe.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded bg-cp-surface-4 px-3 py-1 text-cp-base hover:bg-cp-surface-5">
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button type="button" onClick={finalizeCrop} className="rounded bg-emerald-600 px-3 py-1 text-cp-base hover:bg-emerald-500">
            {t('rackCrop.confirm', 'Zuschnitt übernehmen')}
          </button>
        </div>
      </div>
    </div>
  )
}
