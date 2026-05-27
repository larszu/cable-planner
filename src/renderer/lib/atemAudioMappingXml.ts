import type {
  AtemAudioConfig,
  AtemAudioOutput,
  AtemAudioSource,
  AtemClassicAudioInput,
  AtemClassicMixer,
  AtemInputLabel,
} from '../types/equipment'

/**
 * Parse an ATEM Profile XML into our internal AtemAudioConfig shape.
 *
 * Detects whichever audio section(s) the file contains:
 *   - <AudioMapping>  → routing matrix (Fairlight-capable ATEMs)
 *   - <AudioMixer>    → classic per-input mixer (older Production Studio /
 *                        Television Studio models)
 *   - both            → e.g. Constellation, where both coexist
 *
 * Also harvests friendly input labels from <Settings><Inputs> so the UI can
 * label rows with "Cam1 - Jan" instead of bare ids.
 *
 * The complete original XML is stored as `rawXml` so a later
 * serializeAudioConfigXml call can patch only the attributes the user changed
 * and round-trip every other section of the Profile byte-for-byte.
 */
export function parseAudioConfigXml(xml: string): AtemAudioConfig {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error(`Ungültiges XML: ${parserError.textContent ?? 'parse error'}`)
  }

  const config: AtemAudioConfig = { rawXml: xml }

  // <Settings><Inputs><Input id=… shortName=… longName=… externalPortType=…/>
  const inputLabels: Record<number, AtemInputLabel> = {}
  for (const el of Array.from(doc.querySelectorAll('Settings > Inputs > Input'))) {
    const id = Number(el.getAttribute('id'))
    if (!Number.isFinite(id)) continue
    inputLabels[id] = {
      shortName: el.getAttribute('shortName') ?? '',
      longName: el.getAttribute('longName') ?? '',
      externalPortType: el.getAttribute('externalPortType') ?? undefined,
    }
  }
  if (Object.keys(inputLabels).length > 0) config.inputLabels = inputLabels

  // <AudioMapping> — Fairlight matrix
  const mapping = doc.querySelector('AudioMapping')
  if (mapping) {
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
    config.matrix = { sources, outputs }
  }

  // <AudioMixer> — classic per-input mixer
  const classicEl = doc.querySelector('AudioMixer')
  if (classicEl) {
    const inputs: AtemClassicAudioInput[] = Array.from(
      classicEl.querySelectorAll('AudioInputs > AudioInput'),
    ).map((el) => {
      const gainAttr = el.getAttribute('gain') ?? '0'
      const gain = /^-?inf(inity)?$/i.test(gainAttr.trim()) ? null : Number(gainAttr)
      const mixOption = el.getAttribute('mixOption') ?? 'Off'
      return {
        id: Number(el.getAttribute('id')),
        mixOption: (['Off', 'On', 'AudioFollowVideo'].includes(mixOption)
          ? mixOption
          : 'Off') as AtemClassicAudioInput['mixOption'],
        gain,
        balance: Number(el.getAttribute('balance') ?? '0'),
      }
    })
    const classic: AtemClassicMixer = {
      programOutGain: Number(classicEl.getAttribute('programOutGain') ?? '0'),
      programOutBalance: Number(classicEl.getAttribute('programOutBalance') ?? '0'),
      programOutFollowFadeToBlack:
        classicEl.getAttribute('programOutFollowFadeToBlack') === 'True',
      audioFollowVideoCrossfadeTransition:
        classicEl.getAttribute('audioFollowVideoCrossfadeTransition') === 'True',
      inputs,
    }
    config.classicMixer = classic
  }

  if (!config.matrix && !config.classicMixer) {
    throw new Error(
      'Weder <AudioMapping> noch <AudioMixer> im XML gefunden — die Audio-Sektion fehlt oder das XML ist kein ATEM Profile.',
    )
  }

  return config
}

/**
 * Patch the audio sections of the original XML with the user's edits and
 * return the resulting XML string. Non-destructive: only attributes the user
 * actually changed are touched; every other section of the Profile is
 * preserved.
 *
 * - For the matrix: only <Output sourceId="…"/> attributes inside <AudioMapping>
 *   are updated.
 * - For the classic mixer: <AudioInput mixOption="…" gain="…" balance="…"/>
 *   attributes inside <AudioMixer><AudioInputs> plus the master attributes on
 *   <AudioMixer> itself are updated.
 *
 * Without `rawXml`, a minimal <Profile> wrapper containing whichever sections
 * the config holds is synthesised. (Useful when the matrix was built from
 * scratch in-app rather than loaded from an existing profile.)
 */
export function serializeAudioConfigXml(config: AtemAudioConfig): string {
  if (config.rawXml) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(config.rawXml, 'application/xml')
    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      throw new Error(
        `Original-XML lässt sich nicht mehr parsen: ${parserError.textContent ?? ''}`,
      )
    }

    if (config.matrix) {
      const mapping = doc.querySelector('AudioMapping')
      if (mapping) {
        const newSourceIdByOutputId = new Map(
          config.matrix.outputs.map((o) => [o.id, o.sourceId]),
        )
        for (const el of Array.from(
          mapping.querySelectorAll('AudioOutputs > Output'),
        )) {
          const id = Number(el.getAttribute('id'))
          const newSrc = newSourceIdByOutputId.get(id)
          if (newSrc !== undefined) el.setAttribute('sourceId', String(newSrc))
        }
      }
    }

    if (config.classicMixer) {
      const mixerEl = doc.querySelector('AudioMixer')
      if (mixerEl) {
        mixerEl.setAttribute('programOutGain', String(config.classicMixer.programOutGain))
        mixerEl.setAttribute(
          'programOutBalance',
          String(config.classicMixer.programOutBalance),
        )
        mixerEl.setAttribute(
          'programOutFollowFadeToBlack',
          config.classicMixer.programOutFollowFadeToBlack ? 'True' : 'False',
        )
        mixerEl.setAttribute(
          'audioFollowVideoCrossfadeTransition',
          config.classicMixer.audioFollowVideoCrossfadeTransition ? 'True' : 'False',
        )
        const newInputs = new Map(config.classicMixer.inputs.map((i) => [i.id, i]))
        for (const el of Array.from(
          mixerEl.querySelectorAll('AudioInputs > AudioInput'),
        )) {
          const id = Number(el.getAttribute('id'))
          const next = newInputs.get(id)
          if (next) {
            el.setAttribute('mixOption', next.mixOption)
            el.setAttribute('gain', next.gain === null ? '-inf' : String(next.gain))
            el.setAttribute('balance', String(next.balance))
          }
        }
      }
    }

    return new XMLSerializer().serializeToString(doc)
  }

  // No raw XML: synthesise minimal profile
  const escapeXmlAttr = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Profile majorVersion="2" minorVersion="1">',
  ]
  if (config.matrix) {
    lines.push('    <AudioMapping>', '        <AudioOutputs>')
    for (const o of config.matrix.outputs) {
      lines.push(
        `            <Output id="${o.id}" sourceId="${o.sourceId}" name="${escapeXmlAttr(o.name)}"/>`,
      )
    }
    lines.push('        </AudioOutputs>', '        <AudioSources>')
    for (const s of config.matrix.sources) {
      lines.push(
        `            <Source id="${s.id}" name="${escapeXmlAttr(s.name)}"/>`,
      )
    }
    lines.push('        </AudioSources>', '    </AudioMapping>')
  }
  if (config.classicMixer) {
    const m = config.classicMixer
    lines.push(
      `    <AudioMixer programOutGain="${m.programOutGain}" programOutBalance="${m.programOutBalance}" programOutFollowFadeToBlack="${m.programOutFollowFadeToBlack ? 'True' : 'False'}" audioFollowVideoCrossfadeTransition="${m.audioFollowVideoCrossfadeTransition ? 'True' : 'False'}">`,
      '        <AudioInputs>',
    )
    for (const i of m.inputs) {
      lines.push(
        `            <AudioInput id="${i.id}" mixOption="${i.mixOption}" gain="${i.gain === null ? '-inf' : i.gain}" balance="${i.balance}"/>`,
      )
    }
    lines.push('        </AudioInputs>', '    </AudioMixer>')
  }
  lines.push('</Profile>', '')
  return lines.join('\n')
}

/**
 * Detect old persistent shapes:
 *  - v0.3.0 Fairlight per-source (mainGain/balance/onAir)
 *  - v0.3.1 flat { sources, outputs } before the matrix wrapper was introduced
 * so we can migrate or discard them on load.
 */
export function isLegacyAudioConfig(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (Array.isArray(v.sources) && v.sources.length > 0) {
    const first = v.sources[0] as Record<string, unknown>
    if ('mainGain' in first || 'onAir' in first) return true
  }
  // v0.3.1: flat sources/outputs without matrix wrapper
  if (Array.isArray(v.outputs) && Array.isArray(v.sources) && !('matrix' in v)) {
    return true
  }
  return false
}

/**
 * Best-effort migration of the v0.3.1 flat shape ({ sources, outputs }) to
 * the new shape ({ matrix: { sources, outputs } }). Returns null if the value
 * isn't a recognisable migrant — caller should treat that as "no config".
 */
export function migrateLegacyAudioConfig(value: unknown): AtemAudioConfig | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (Array.isArray(v.outputs) && Array.isArray(v.sources)) {
    const sources = v.sources as Record<string, unknown>[]
    if (sources.length === 0 || !('mainGain' in (sources[0] ?? {}))) {
      const outputs = v.outputs as AtemAudioOutput[]
      const sources2 = v.sources as AtemAudioSource[]
      return {
        matrix: { sources: sources2, outputs },
        rawXml: typeof v.rawXml === 'string' ? v.rawXml : undefined,
      }
    }
  }
  return null
}

/**
 * Backwards-compatible parser entry point — kept so existing imports keep
 * working through the v3 transition. Prefer parseAudioConfigXml.
 */
export const parseAudioMappingXml = parseAudioConfigXml
export const serializeAudioMappingXml = serializeAudioConfigXml
export const isLegacyFairlightConfig = isLegacyAudioConfig
