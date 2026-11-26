// #1240 — Beschriftung der Bausteine in der Innenansicht.
import { format, type useTranslation } from '../../../lib/i18n'
import type { InnerBlock, InnerDest } from '../../../lib/switching'

type Uebersetzen = ReturnType<typeof useTranslation>

export const blockLabel = (b: InnerBlock, t: Uebersetzen): string => {
  const n = { n: b.index }
  switch (b.kind) {
    case 'input':
      return b.portName || format(t('switching.block.input', 'Input {n}'), n)
    case 'black':
      return t('switching.block.black', 'Black')
    case 'bars':
      return t('switching.block.bars', 'Colour bars')
    case 'color':
      return format(t('switching.block.color', 'Colour {n}'), n)
    case 'mediaPlayer':
      return format(t('switching.block.mediaPlayer', 'Media player {n}'), n)
    case 'mixEffect':
      return format(t('switching.block.mixEffect', 'M/E {n}'), n)
    case 'upstreamKeyer':
      return format(t('switching.block.usk', 'USK {n}'), n)
    case 'downstreamKeyer':
      return format(t('switching.block.dsk', 'DSK {n}'), n)
    case 'superSource':
      return format(t('switching.block.superSource', 'SuperSource {n}'), n)
    case 'program':
      return t('switching.block.program', 'PGM')
    case 'aux':
      return format(t('switching.block.aux', 'Aux {n}'), n)
    case 'multiviewer':
      return format(t('switching.block.multiviewer', 'Multiviewer {n}'), n)
  }
}

export const destLabel = (d: InnerDest, t: Uebersetzen): string => {
  switch (d.role) {
    case 'program':
      return t('switching.dest.program', 'Programme bus')
    case 'preview':
      return t('switching.dest.preview', 'Preview bus')
    case 'box':
      return format(t('switching.dest.box', 'Box {n}'), { n: d.index ?? 1 })
    case 'artFill':
      return t('switching.dest.artFill', 'Art fill')
    case 'artKey':
      return t('switching.dest.artKey', 'Art key')
    case 'fill':
      return t('switching.dest.fill', 'Fill')
    case 'key':
      return t('switching.dest.key', 'Key')
    case 'aux':
      return t('switching.dest.source', 'Source')
    case 'still':
      return t('switching.dest.still', 'Still')
  }
}
