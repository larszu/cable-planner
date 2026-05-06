import type {
  AtemAudioConfig,
  AtemAudioOutput,
  AtemAudioSource,
} from '../types/equipment'

/**
 * Parse an ATEM Profile XML (or a fragment containing <AudioMapping>) into
 * the internal AtemAudioConfig shape. Keeps the original XML around so
 * `serializeAudioMappingXml` can patch only the routing attributes and leave
 * every other section of the profile untouched.
 *
 * Throws on invalid XML or when no <AudioMapping> is found.
 */
export function parseAudioMappingXml(xml: string): AtemAudioConfig {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error(`Ungültiges XML: ${parserError.textContent ?? 'parse error'}`)
  }
  const mapping = doc.querySelector('AudioMapping')
  if (!mapping) {
    throw new Error(
      'Kein <AudioMapping> im XML gefunden. Erwartet wird ein ATEM Profile-XML.',
    )
  }

  const sources: AtemAudioSource[] = Array.from(
    mapping.querySelectorAll('AudioSources > Source'),
  ).map((el) => ({
    id: Number(el.getAttribute('id')),
    name: el.getAttribute('name') ?? '',
  }))

  const outputs: AtemAudioOutput[] = Array.from(
    mapping.querySelectorAll('AudioOutputs > Output'),
  ).map((el) => ({
    id: Number(el.getAttribute('id')),
    sourceId: Number(el.getAttribute('sourceId') ?? '0'),
    name: el.getAttribute('name') ?? '',
  }))

  return { sources, outputs, rawXml: xml }
}

/**
 * Patch the routing attributes of the <Output> elements inside <AudioMapping>
 * with the user's edits and return the resulting XML string.
 *
 * - When `config.rawXml` is present we parse it back and only mutate
 *   attributes that exist in `config.outputs`. Every unrelated section
 *   (MixEffectBlocks, FairlightAudioMixer, ButtonMapping, Settings, …) and
 *   every attribute we didn't touch is preserved verbatim. This is what
 *   makes the matrix safe to use against the user's real Profile.
 * - When no rawXml is present we synthesise a minimal <Profile> wrapper that
 *   contains just the AudioMapping section (good enough for a fresh export
 *   from scratch, e.g. when the matrix was built by hand).
 */
export function serializeAudioMappingXml(config: AtemAudioConfig): string {
  if (config.rawXml) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(config.rawXml, 'application/xml')
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      throw new Error(
        `Original-XML lässt sich nicht mehr parsen: ${parserError.textContent ?? ''}`,
      )
    }
    const mapping = doc.querySelector('AudioMapping')
    if (!mapping) {
      throw new Error('Kein <AudioMapping> im Original-XML mehr vorhanden.')
    }
    const newSourceIdByOutputId = new Map(
      config.outputs.map((o) => [o.id, o.sourceId]),
    )
    for (const el of Array.from(mapping.querySelectorAll('AudioOutputs > Output'))) {
      const id = Number(el.getAttribute('id'))
      const newSourceId = newSourceIdByOutputId.get(id)
      if (newSourceId !== undefined) {
        el.setAttribute('sourceId', String(newSourceId))
      }
    }
    return new XMLSerializer().serializeToString(doc)
  }

  const escapeXmlAttr = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Profile majorVersion="2" minorVersion="1">',
    '    <AudioMapping>',
    '        <AudioOutputs>',
    ...config.outputs.map(
      (o) =>
        `            <Output id="${o.id}" sourceId="${o.sourceId}" name="${escapeXmlAttr(o.name)}"/>`,
    ),
    '        </AudioOutputs>',
    '        <AudioSources>',
    ...config.sources.map(
      (s) => `            <Source id="${s.id}" name="${escapeXmlAttr(s.name)}"/>`,
    ),
    '        </AudioSources>',
    '    </AudioMapping>',
    '</Profile>',
    '',
  ].join('\n')
}

/**
 * Detect whether an existing equipment.atemAudioConfig is the legacy
 * Fairlight per-source shape from v0.3.0 (which had {mainGain, balance, onAir}
 * on each source) so we can ignore it on load — the new matrix shape replaces
 * it entirely.
 */
export function isLegacyFairlightConfig(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (!Array.isArray(v.sources)) return false
  if (v.sources.length === 0) return !Array.isArray(v.outputs)
  const first = v.sources[0] as Record<string, unknown>
  return 'mainGain' in first || 'onAir' in first
}
