import type { SignalStandard } from './cableSpec'

/**
 * Video format descriptor covering all common SMPTE/ITU-R broadcast rasters.
 *
 * Sources:
 *   - SMPTE ST 292-1 (HD-SDI 1.485 Gb/s)
 *   - SMPTE ST 424 / 425-1 (3G-SDI 2.970 Gb/s — Level A and Level B)
 *   - SMPTE ST 2081-10 (6G-SDI), ST 2082-10 (12G-SDI)
 *   - SMPTE ST 425-5 (Quad Link 3G — 2SI / Square Division mapping)
 *
 * `carriers` lists the single-link SDI transports that can carry this format
 * natively. For Ultra HD (2160p) we also include Quad Link 3G flavours.
 */
export type VideoFormatId =
  // SD / HD (1.5G)
  | '576i50'
  | '720p50'
  | '720p60'
  | '1080i50'
  | '1080i60'
  | '1080p24'
  | '1080p25'
  | '1080p30'
  // 3G (1080p50/60)
  | '1080p50'
  | '1080p60'
  // UHD
  | '2160p24'
  | '2160p25'
  | '2160p30'
  | '2160p50'
  | '2160p60'
  // DCI
  | '4096x2160p24'
  | '4096x2160p60'

export type SdiCarrier =
  | 'SDI-HD' // ST 292-1 1.5G
  | 'SDI-3G-A' // 3G Level A (direct mapping)
  | 'SDI-3G-B' // 3G Level B (dual-link in one cable)
  | 'SDI-6G'
  | 'SDI-12G'
  | 'QuadLink-3G-2SI'
  | 'QuadLink-3G-SquareDivision'
  | 'DualLink-HD' // 2× 1.5G HD-SDI (SMPTE 372M)
  | 'DualLink-3G' // 2× 3G-SDI (z.B. 1080p / 4:4:4)

export interface VideoFormat {
  id: VideoFormatId
  label: string
  /** SDI transports that can carry this format (in rough order of preference). */
  carriers: SdiCarrier[]
  /** Matching cable categories in `cableCatalog` that can transport this format. */
  preferredCable: SignalStandard
  /** Free-text notes (legacy / user-supplied). Built-in entries use `notesKey`. */
  notes?: string
  /** Translation key for the built-in catalog. Resolved via `t(notesKey, '')`
   *  so the description follows the active UI language. */
  notesKey?: string
}

export const VIDEO_FORMATS: VideoFormat[] = [
  { id: '576i50', label: '576i50 (PAL)', carriers: ['SDI-HD'], preferredCable: 'SDI-SD' },
  { id: '720p50', label: '720p50', carriers: ['SDI-HD'], preferredCable: 'SDI-HD' },
  { id: '720p60', label: '720p59.94 / 720p60', carriers: ['SDI-HD'], preferredCable: 'SDI-HD' },
  { id: '1080i50', label: '1080i50', carriers: ['SDI-HD'], preferredCable: 'SDI-HD' },
  { id: '1080i60', label: '1080i59.94 / 1080i60', carriers: ['SDI-HD'], preferredCable: 'SDI-HD' },
  { id: '1080p24', label: '1080p23.98 / 1080p24', carriers: ['SDI-HD'], preferredCable: 'SDI-HD' },
  { id: '1080p25', label: '1080p25', carriers: ['SDI-HD'], preferredCable: 'SDI-HD' },
  { id: '1080p30', label: '1080p29.97 / 1080p30', carriers: ['SDI-HD'], preferredCable: 'SDI-HD' },
  {
    id: '1080p50',
    label: '1080p50 (3G)',
    carriers: ['SDI-3G-A', 'SDI-3G-B', 'DualLink-HD'],
    preferredCable: 'SDI-3G',
    notesKey: 'catalog.videoFormat.1080p50.notes',
  },
  {
    id: '1080p60',
    label: '1080p59.94 / 1080p60 (3G)',
    carriers: ['SDI-3G-A', 'SDI-3G-B', 'DualLink-HD'],
    preferredCable: 'SDI-3G',
  },
  {
    id: '2160p24',
    label: '2160p23.98 / 2160p24 (6G oder Quad 3G)',
    carriers: ['SDI-6G', 'QuadLink-3G-2SI', 'QuadLink-3G-SquareDivision'],
    preferredCable: 'SDI-6G',
  },
  {
    id: '2160p25',
    label: '2160p25 (6G oder Quad 3G)',
    carriers: ['SDI-6G', 'QuadLink-3G-2SI', 'QuadLink-3G-SquareDivision'],
    preferredCable: 'SDI-6G',
  },
  {
    id: '2160p30',
    label: '2160p29.97 / 2160p30 (6G oder Quad 3G)',
    carriers: ['SDI-6G', 'QuadLink-3G-2SI', 'QuadLink-3G-SquareDivision'],
    preferredCable: 'SDI-6G',
  },
  {
    id: '2160p50',
    label: '2160p50 (12G oder Quad 3G)',
    carriers: ['SDI-12G', 'QuadLink-3G-2SI', 'QuadLink-3G-SquareDivision'],
    preferredCable: 'SDI-12G',
    notesKey: 'catalog.videoFormat.2160p50.notes',
  },
  {
    id: '2160p60',
    label: '2160p59.94 / 2160p60 (12G oder Quad 3G)',
    carriers: ['SDI-12G', 'QuadLink-3G-2SI', 'QuadLink-3G-SquareDivision'],
    preferredCable: 'SDI-12G',
  },
  {
    id: '4096x2160p24',
    label: 'DCI 4K p24 (6G)',
    carriers: ['SDI-6G'],
    preferredCable: 'SDI-6G',
  },
  {
    id: '4096x2160p60',
    label: 'DCI 4K p60 (12G)',
    carriers: ['SDI-12G'],
    preferredCable: 'SDI-12G',
  },
]

export const DEFAULT_VIDEO_FORMAT: VideoFormatId = '1080p50'

export const videoFormatById = (id: VideoFormatId | undefined): VideoFormat | undefined =>
  VIDEO_FORMATS.find((f) => f.id === id)

/** SDI capability flags stored per device. */
export interface SdiCapabilities {
  /** Supports 3G-SDI Level A (direct 1080p50/60 mapping). */
  levelA?: boolean
  /** Supports 3G-SDI Level B (dual-link 1.5G over one 3G cable). */
  levelB?: boolean
  /** Highest single-link SDI rate the device can negotiate. */
  maxSingleLink?: 'SDI-HD' | 'SDI-3G' | 'SDI-6G' | 'SDI-12G'
  /** Quad Link 3G-SDI support (for 2160p50/60 over four BNC cables). */
  quadLink3G?: QuadLinkMode
  /** #370 — Dual-Link SDI support: 2× HD-SDI (SMPTE 372M) or 2× 3G for
   *  1080p50/60 / 4:4:4. The pair is modelled per-port via `dualLinkGroup`. */
  dualLink?: boolean
}

export type QuadLinkMode = 'none' | '2SI' | 'SquareDivision' | 'both'

/**
 * Pick the best cable SignalStandard to carry `format` given the SDI
 * capabilities of the two endpoints. Falls back to the format's preferred
 * cable when caps are unknown.
 */
export const pickCableStandardForFormat = (
  format: VideoFormat,
  fromCaps?: SdiCapabilities,
  toCaps?: SdiCapabilities,
): SignalStandard => {
  // If either endpoint cannot go above 3G and the format is UHD, we need Quad Link.
  const caps = [fromCaps, toCaps].filter(Boolean) as SdiCapabilities[]
  const maxBothAtLeast = (target: 'SDI-3G' | 'SDI-6G' | 'SDI-12G') => {
    const order = { 'SDI-HD': 1, 'SDI-3G': 2, 'SDI-6G': 3, 'SDI-12G': 4 } as const
    return caps.every((c) => !c.maxSingleLink || order[c.maxSingleLink] >= order[target])
  }
  if (format.preferredCable === 'SDI-12G' && !maxBothAtLeast('SDI-12G')) {
    // Fall back to 3G (Quad Link expected — same physical cable type).
    return 'SDI-3G'
  }
  if (format.preferredCable === 'SDI-6G' && !maxBothAtLeast('SDI-6G')) {
    return 'SDI-3G'
  }
  // #370 — Dual-Link fallback: a 3G format (1080p50/60) can also travel over
  // 2× HD-SDI (Dual-Link HD, SMPTE 372M) when both endpoints are HD-only but
  // advertise Dual-Link support. The per-cable type is then HD-SDI.
  if (
    format.preferredCable === 'SDI-3G' &&
    !maxBothAtLeast('SDI-3G') &&
    caps.length > 0 &&
    caps.every((c) => c.dualLink)
  ) {
    return 'SDI-HD'
  }
  return format.preferredCable
}
