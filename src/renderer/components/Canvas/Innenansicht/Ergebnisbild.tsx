// #1240 Stufe 3 — das simulierte Ergebnisbild: PGM, Aux, M/E-Ausgang oder
// ein Multiviewer, als Canvas2D aus den Zeichenschritten von `compose.ts`.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { format, useTranslation } from '../../../lib/i18n'
import { testPatternDataUri } from '../../../lib/testPattern'
import {
  composeMultiviewer,
  composeTarget,
  stillRef,
  stillSlotNumber,
  type ComposeInput,
  type MvWindow,
} from '../../../lib/switching'
import type { EquipmentItem } from '../../../types/equipment'
import { blockLabel } from './labels'
import { zeichne, zeichneFenster, type LeafLook } from './ergebnisbildZeichnen'

const FARBEN = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207']

export const Ergebnisbild = ({
  device,
  input,
  target,
}: {
  device: EquipmentItem
  input: ComposeInput
  /** `pgm`, `aux:n`, `me:n`, `pvw:me:n` oder `mv:n`. */
  target: string
}) => {
  const t = useTranslation()
  const fotos = useProjectStore((s) => s.project.fotos)
  const canvas = useRef<HTMLCanvasElement>(null)
  const cache = useRef(new Map<string, HTMLImageElement>())
  const [geladen, setGeladen] = useState(0)
  const { matrix, sim } = input

  const bild = useMemo(() => {
    if (target.startsWith('mv:')) {
      const idx = Number(target.slice(3)) - 1
      const mv = device.atemMvConfig?.multiViewers.find((m) => m.index === idx)
      return composeMultiviewer(input, mv)
    }
    return { ops: composeTarget(input, target), windows: [] as MvWindow[] }
  }, [input, target, device.atemMvConfig])

  // Wie jede Quelle aussieht: Pruefbild mit Namen oder das geladene Bild.
  const quelle = useMemo(() => {
    const out = new Map<string, string>()
    for (const b of matrix.blocks) {
      if (b.kind === 'input' || b.kind === 'bars') {
        out.set(b.id, testPatternDataUri({ name: blockLabel(b, t), zeile2: b.sourceId !== undefined ? `#${b.sourceId}` : undefined, breite: 640 }))
      } else if (b.kind === 'mediaPlayer') {
        const slot = stillSlotNumber(sim.switching.routes?.[`mp:${b.index}/still`])
        const ref = slot ? stillRef(sim.switching, slot) : undefined
        const foto = ref?.fotoId ? fotos?.find((f) => f.id === ref.fotoId) : undefined
        out.set(
          b.id,
          foto?.dataUri ||
            testPatternDataUri({ name: blockLabel(b, t), zeile2: t('switching.pult.noStill', 'no still loaded'), breite: 640 }),
        )
      }
    }
    return out
  }, [matrix, sim.switching, fotos, t])

  const look = (leaf: string): LeafLook => {
    if (leaf === 'black') return { fill: '#000' }
    if (leaf.startsWith('color:')) return { fill: FARBEN[(Number(leaf.slice(6)) - 1) % FARBEN.length] }
    const src = quelle.get(leaf)
    if (!src) return {}
    let img = cache.current.get(src)
    if (!img) {
      img = new Image()
      img.onload = () => setGeladen((n) => n + 1)
      img.src = src
      cache.current.set(src, img)
    }
    return img.complete && img.naturalWidth > 0 ? { img } : {}
  }

  const fensterName = (w: MvWindow): string => {
    if (w.target === 'pgm') return t('switching.block.program', 'PGM')
    if (w.target.startsWith('pvw:')) return t('switching.pult.pvw', 'PVW')
    const b = matrix.byId.get(w.target)
    return b ? blockLabel(b, t) : format(t('switching.pult.source', 'Source {n}'), { n: w.sourceId })
  }
  const tally = (w: MvWindow): 'pgm' | 'pvw' | null =>
    w.target === 'pgm' ? 'pgm' : w.target === 'pvw:me:1' ? 'pvw' : null

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    zeichne(ctx, bild.ops, look)
    if (bild.windows.length) zeichneFenster(ctx, bild.windows, fensterName, tally)
  })

  return (
    <canvas
      ref={canvas}
      width={960}
      height={540}
      data-testid="ergebnisbild"
      data-geladen={geladen}
      className="aspect-video w-full rounded-cp-control border border-cp-border bg-black"
    />
  )
}
