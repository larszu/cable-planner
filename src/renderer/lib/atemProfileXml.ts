// ───────────────────────────────────────────────────────────────────────────
// ATEM-Setup-Datei (Profil-XML) vollstaendig lesen und schreiben (#1240, Stufe 4).
//
// Derselbe Weg wie `atemAudioMappingXml.ts`, nur fuer alle Abschnitte, die das
// Modell kennt: M/E-Busse, Keyer, DSK, SuperSource, Aux, Farbgeneratoren,
// Mediaplayer und Media-Pool, Multiviewer, Eingangsnamen, Makronamen und
// Mix-Minus. Der Audio-Teil geht weiter durch `parseAudioConfigXml`.
//
// GRUNDREGEL: Was das Modell nicht kennt, bleibt byte-gleich. Deshalb wird
// beim Schreiben nicht neu serialisiert, sondern nur der Wert eines schon
// vorhandenen Attributs im Originaltext ersetzt — und nur, wenn er sich
// tatsaechlich unterscheidet. Ein Einlesen und Ausgeben ohne Aenderung
// liefert damit dieselben Bytes.
//
// Element- und Attributnamen stammen aus dem offen einsehbaren Dateiformat
// (Vorlage: `default_config.xml` von pyAtemSim, MIT; Setup-Dateien, die ATEM
// Software Control mit „Save“ schreibt).
//
// REIN: kein IO, kein Store.
// ───────────────────────────────────────────────────────────────────────────
import type { AtemAudioConfig, AtemMvConfig, AtemMvDefinition, EquipmentItem } from '../types/equipment'
import { parseAudioConfigXml } from './atemAudioMappingXml'
import { mapCpWindowIndexToAtem, migrateMvToQuadrants } from './atemMvLayout'
import { tr } from './i18n'
import { buildInnerMatrix, routePatch, routeOf, type InnerMatrix } from './switching/internalMatrix'
import { switchingProfileFor } from './switching/state'
import type { AtemProfileState, KeyerType, SwitchingBlockCounts, SwitchingState } from './switching/types'

// ─── Kleiner Scanner mit Positionen ─────────────────────────────────────

export interface XmlAttr {
  name: string
  value: string
  /** Bereich des rohen Werts (ohne Anfuehrungszeichen) im Text. */
  start: number
  end: number
}

export interface XmlEl {
  name: string
  attrs: XmlAttr[]
  children: XmlEl[]
  /** Ende des Start-Tags (Position hinter `>`), fuer Einfuegungen. */
  tagEnd: number
}

const decode = (s: string) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
    const k = e.toLowerCase()
    if (k === 'lt') return '<'
    if (k === 'gt') return '>'
    if (k === 'quot') return '"'
    if (k === 'apos') return "'"
    if (k === 'amp') return '&'
    return String.fromCodePoint(k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10))
  })

const encode = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Elementbaum mit Attributpositionen. Wirft bei offensichtlich kaputtem XML. */
export const scanXml = (xml: string): XmlEl => {
  const root: XmlEl = { name: '#root', attrs: [], children: [], tagEnd: 0 }
  const stack: XmlEl[] = [root]
  let i = 0
  while ((i = xml.indexOf('<', i)) !== -1) {
    if (xml.startsWith('<!--', i)) {
      const e = xml.indexOf('-->', i)
      if (e < 0) throw new Error('XML: unterminated comment')
      i = e + 3
      continue
    }
    if (xml.startsWith('<![CDATA[', i)) {
      const e = xml.indexOf(']]>', i)
      if (e < 0) throw new Error('XML: unterminated CDATA')
      i = e + 3
      continue
    }
    if (xml[i + 1] === '?' || xml[i + 1] === '!') {
      const e = xml.indexOf('>', i)
      if (e < 0) throw new Error('XML: unterminated declaration')
      i = e + 1
      continue
    }
    if (xml[i + 1] === '/') {
      const e = xml.indexOf('>', i)
      const name = xml.slice(i + 2, e).trim()
      const top = stack.pop()
      if (!top || top.name !== name || stack.length === 0) throw new Error(`XML: unexpected </${name}>`)
      i = e + 1
      continue
    }
    const nameM = /^<([A-Za-z_][\w.:-]*)/.exec(xml.slice(i, i + 200))
    if (!nameM) throw new Error('XML: invalid tag')
    const el: XmlEl = { name: nameM[1], attrs: [], children: [], tagEnd: 0 }
    let j = i + nameM[0].length
    const attrRe = /\s*([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')|\s*(\/?>)/y
    let closed = false
    let selfClosing = false
    while (!closed) {
      attrRe.lastIndex = j
      const m = attrRe.exec(xml)
      if (!m) throw new Error(`XML: invalid attribute in <${el.name}>`)
      if (m[5]) {
        closed = true
        selfClosing = m[5] === '/>'
      } else {
        const raw = m[3] ?? m[4] ?? ''
        const vStart = m.index + m[0].length - raw.length - 1
        el.attrs.push({ name: m[1], value: decode(raw), start: vStart, end: vStart + raw.length })
      }
      j = attrRe.lastIndex
    }
    el.tagEnd = j
    stack[stack.length - 1].children.push(el)
    if (!selfClosing) stack.push(el)
    i = j
  }
  if (stack.length !== 1) throw new Error(`XML: <${stack[stack.length - 1].name}> not closed`)
  return root
}

const kids = (el: XmlEl | undefined, name: string): XmlEl[] => (el ? el.children.filter((c) => c.name === name) : [])
const kid = (el: XmlEl | undefined, name: string): XmlEl | undefined => el?.children.find((c) => c.name === name)
const at = (el: XmlEl | undefined, name: string): string | undefined => el?.attrs.find((a) => a.name === name)?.value
const num = (el: XmlEl | undefined, name: string): number | undefined => {
  const v = at(el, name)
  if (v === undefined || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
const bool = (el: XmlEl | undefined, name: string): boolean | undefined => {
  const v = at(el, name)
  return v === undefined ? undefined : v === 'True' || v === 'true' || v === '1'
}
const byIndex = (els: XmlEl[], attr = 'index') => new Map(els.map((e) => [num(e, attr), e] as const))

/** Ersetzt Attributwerte im Text; nur wo der neue Wert wirklich ein anderer ist. */
class Patcher {
  private edits: { start: number; end: number; text: string }[] = []
  set(el: XmlEl | undefined, name: string, value: string | number | boolean | undefined): void {
    if (!el || value === undefined) return
    const a = el.attrs.find((x) => x.name === name)
    if (!a) return
    const next = typeof value === 'boolean' ? (value ? 'True' : 'False') : String(value)
    if (a.value === next) return
    if (typeof value === 'number' && a.value.trim() !== '' && Number(a.value) === value) return
    if (typeof value === 'boolean' && (a.value === 'True' || a.value === 'true') === value && /^(true|false)$/i.test(a.value)) return
    this.edits.push({ start: a.start, end: a.end, text: encode(next) })
  }
  apply(xml: string): string {
    let out = xml
    for (const e of [...this.edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end)
    return out
  }
}

// ─── Gemeinsame Abschnitte ─────────────────────────────────────────────

interface Sections {
  profile?: XmlEl
  mes: XmlEl[]
  dsks: XmlEl[]
  supers: XmlEl[]
  auxes: XmlEl[]
  colors: XmlEl[]
  players: XmlEl[]
  stills: XmlEl[]
  inputs: XmlEl[]
  macros: XmlEl[]
  mixMinus: XmlEl[]
  multiViews: XmlEl[]
}

const sections = (root: XmlEl): Sections => {
  const profile = kid(root, 'Profile')
  const settings = kid(profile, 'Settings')
  // Ein Mischer mit EINER SuperSource schreibt sie ohne Huelle und ohne Index.
  const supers = kid(profile, 'SuperSources') ? kids(kid(profile, 'SuperSources'), 'SuperSource') : kids(profile, 'SuperSource')
  return {
    profile,
    mes: kids(kid(profile, 'MixEffectBlocks'), 'MixEffectBlock'),
    dsks: kids(kid(profile, 'DownstreamKeys'), 'DownstreamKey'),
    supers,
    auxes: kids(kid(profile, 'Auxiliaries'), 'Auxiliary'),
    colors: kids(kid(profile, 'ColorGenerators'), 'ColorGenerator'),
    players: kids(kid(profile, 'MediaPlayers'), 'MediaPlayer'),
    stills: kids(kid(kid(profile, 'MediaPool'), 'Stills'), 'Still'),
    inputs: kids(kid(settings, 'Inputs'), 'Input'),
    macros: kids(kid(profile, 'MacroPool'), 'Macro'),
    mixMinus: kids(kid(settings, 'MixMinusOutputs'), 'MixMinusOutput'),
    multiViews: kids(kid(settings, 'MultiViews'), 'MultiView'),
  }
}

const superIndex = (el: XmlEl, pos: number) => num(el, 'index') ?? pos
const KEY_TYPE: Record<string, KeyerType> = { Luma: 'luma', Chroma: 'chroma', Pattern: 'pattern', DVE: 'dve' }
const KEY_TYPE_XML: Record<KeyerType, string> = { luma: 'Luma', chroma: 'Chroma', pattern: 'Pattern', dve: 'DVE' }

// ─── Einlesen ──────────────────────────────────────────────────────────

export interface AtemProfileImport {
  patch: Pick<EquipmentItem, 'switching'> & Partial<Pick<EquipmentItem, 'plannedCrosspoints' | 'atemMvConfig' | 'atemAudioConfig'>>
  /** ATEM-Quellen-IDs, fuer die das Modell keinen Baustein hat (bleiben in der Datei). */
  unmapped: number[]
}

/**
 * Eine ATEM-Setup-Datei ins Modell lesen.
 *
 * Bausteinzahlen, die das Profil nicht belegt, kommen aus der Datei (ein
 * belegter Profilwert gewinnt, wie ueberall). Kreuzpunkte auf Quellen, die
 * das Modell nicht kennt (z. B. Clean Feed), bleiben nur in der Datei.
 */
export const readAtemProfileXml = (device: EquipmentItem, xml: string, fileName?: string): AtemProfileImport => {
  const root = scanXml(xml)
  const s = sections(root)
  if (!s.profile) {
    throw new Error(tr('err.atemProfile.noProfile', 'No <Profile> element found — this is not an ATEM setup file.'))
  }
  const counts: SwitchingBlockCounts = {}
  const ext = s.inputs.map((e) => num(e, 'id') ?? 0).filter((id) => id >= 1 && id < 1000)
  if (ext.length) counts.inputs = Math.max(...ext)
  if (s.mes.length) counts.mixEffects = s.mes.length
  const keyCount = Math.max(0, ...s.mes.map((m) => kids(kid(m, 'Keys'), 'Key').length))
  if (keyCount) counts.upstreamKeyersPerMe = keyCount
  if (s.dsks.length) counts.downstreamKeyers = s.dsks.length
  if (s.supers.length) counts.superSources = s.supers.length
  const boxCount = Math.max(0, ...s.supers.map((x) => kids(kid(x, 'Boxes'), 'Box').length))
  if (boxCount) counts.superSourceBoxes = boxCount
  if (s.players.length) counts.mediaPlayers = s.players.length
  if (s.colors.length) counts.colorGenerators = s.colors.length
  if (s.auxes.length) counts.aux = s.auxes.length
  if (s.multiViews.length) counts.multiviewers = s.multiViews.length
  const stillMax = Math.max(0, ...s.stills.map((e) => (num(e, 'index') ?? -1) + 1))
  if (stillMax) counts.stills = stillMax

  const profile = switchingProfileFor(device)
  const prev = device.switching ?? {}
  const blocks: SwitchingBlockCounts = { ...(prev.blocks ?? {}) }
  for (const [k, v] of Object.entries(counts) as [keyof SwitchingBlockCounts, number][]) {
    if (profile?.blocks[k] === undefined && (blocks[k] ?? 0) < v) blocks[k] = v
  }

  const atemProfile: AtemProfileState = { rawXml: xml }
  if (fileName) atemProfile.fileName = fileName
  const product = at(s.profile, 'product')
  if (product) atemProfile.product = product

  const baseState: SwitchingState = { ...prev, blocks, atemProfile, routes: {}, keyers: { ...(prev.keyers ?? {}) } }
  let current: EquipmentItem = { ...device, switching: baseState }
  const matrix = buildInnerMatrix(current, profile, baseState)
  const bySource = new Map(matrix.blocks.filter((b) => b.sourceId !== undefined).map((b) => [b.sourceId as number, b.id]))
  const unmapped = new Set<number>()
  const route = (dest: string, sourceId: number | undefined) => {
    if (sourceId === undefined || !matrix.destOwner.has(dest)) return
    const src = bySource.get(sourceId)
    if (!src) {
      unmapped.add(sourceId)
      return
    }
    current = { ...current, ...routePatch(current, matrix, dest, src) }
  }
  const keyer = (id: string, onAir: boolean | undefined, type?: KeyerType) => {
    const st = current.switching ?? {}
    const k = { ...(st.keyers?.[id] ?? {}) }
    if (onAir !== undefined) k.onAir = onAir
    if (type) k.type = type
    current = { ...current, switching: { ...st, keyers: { ...(st.keyers ?? {}), [id]: k } } }
  }

  s.mes.forEach((me, pos) => {
    const n = (num(me, 'index') ?? pos) + 1
    route(`me:${n}/pgm`, num(kid(me, 'Program'), 'input'))
    route(`me:${n}/pvw`, num(kid(me, 'Preview'), 'input'))
    kids(kid(me, 'Keys'), 'Key').forEach((key, kpos) => {
      const k = (num(key, 'index') ?? kpos) + 1
      route(`me:${n}/key:${k}/fill`, num(key, 'inputFill'))
      route(`me:${n}/key:${k}/key`, num(key, 'inputCut'))
      keyer(`me:${n}/key:${k}`, bool(key, 'onAir'), KEY_TYPE[at(key, 'type') ?? ''])
    })
  })
  s.dsks.forEach((d, pos) => {
    const n = (num(d, 'index') ?? pos) + 1
    route(`dsk:${n}/fill`, num(d, 'fillSource'))
    route(`dsk:${n}/key`, num(d, 'keySource'))
    keyer(`dsk:${n}`, bool(d, 'onAir'))
  })
  const boxes: Record<string, boolean> = {}
  s.supers.forEach((ss, pos) => {
    const n = superIndex(ss, pos) + 1
    route(`ss:${n}/art-fill`, num(ss, 'artFillInput'))
    route(`ss:${n}/art-key`, num(ss, 'artKeyInput'))
    kids(kid(ss, 'Boxes'), 'Box').forEach((box, bpos) => {
      const b = (num(box, 'index') ?? bpos) + 1
      route(`ss:${n}/box:${b}`, num(box, 'inputSource'))
      const en = bool(box, 'enabled')
      if (en !== undefined) boxes[`ss:${n}/box:${b}`] = en
    })
  })
  if (Object.keys(boxes).length) atemProfile.boxes = boxes
  for (const a of s.auxes) {
    const id = num(a, 'id')
    if (id !== undefined && id > 8000) route(`aux:${id - 8000}`, num(a, 'input'))
  }
  s.players.forEach((p, pos) => {
    const n = (num(p, 'index') ?? pos) + 1
    const idx = num(p, 'sourceIndex')
    if (at(p, 'sourceType') === 'Still' && idx !== undefined) {
      const st = current.switching ?? {}
      current = { ...current, switching: { ...st, routes: { ...(st.routes ?? {}), [`mp:${n}/still`]: `still:${idx + 1}` } } }
    }
  })

  const colors: AtemProfileState['colors'] = {}
  s.colors.forEach((c, pos) => {
    colors[String((num(c, 'index') ?? pos) + 1)] = {
      hue: num(c, 'hue') ?? 0,
      saturation: num(c, 'saturation') ?? 0,
      luma: num(c, 'luma') ?? 0,
    }
  })
  if (Object.keys(colors).length) atemProfile.colors = colors
  const stills: AtemProfileState['stills'] = {}
  for (const e of s.stills) {
    const idx = num(e, 'index')
    if (idx === undefined) continue
    stills[String(idx + 1)] = { name: at(e, 'name') ?? '', ...(at(e, 'path') ? { path: at(e, 'path') } : {}) }
  }
  if (Object.keys(stills).length) atemProfile.stills = stills
  const inputs: AtemProfileState['inputs'] = {}
  for (const e of s.inputs) {
    const id = num(e, 'id')
    if (id !== undefined) inputs[String(id)] = { shortName: at(e, 'shortName') ?? '', longName: at(e, 'longName') ?? '' }
  }
  if (Object.keys(inputs).length) atemProfile.inputs = inputs
  const macros: AtemProfileState['macros'] = {}
  s.macros.forEach((m, pos) => {
    const d = at(m, 'description')
    macros[String((num(m, 'index') ?? pos) + 1)] = { name: at(m, 'name') ?? '', ...(d ? { description: d } : {}) }
  })
  if (Object.keys(macros).length) atemProfile.macros = macros
  const mixMinus: AtemProfileState['mixMinus'] = {}
  s.mixMinus.forEach((m, pos) => {
    const mode = at(m, 'audioMode')
    if (mode) mixMinus[String((num(m, 'index') ?? pos) + 1)] = mode
  })
  if (Object.keys(mixMinus).length) atemProfile.mixMinus = mixMinus

  const patch: AtemProfileImport['patch'] = {
    switching: { ...(current.switching ?? {}), atemProfile },
    plannedCrosspoints: current.plannedCrosspoints,
  }
  const mv = readMultiViews(s)
  if (mv) patch.atemMvConfig = mv
  if (/<AudioMapping[\s>]|<AudioMixer[\s>]/.test(xml)) {
    try {
      patch.atemAudioConfig = parseAudioConfigXml(xml)
    } catch {
      /* ohne lesbaren Audio-Teil bleibt die Audio-Zuordnung des Plans */
    }
  }
  return { patch, unmapped: [...unmapped].sort((a, b) => a - b) }
}

const readMultiViews = (s: Sections): AtemMvConfig | undefined => {
  if (!s.multiViews.length) return undefined
  const multiViewers: AtemMvDefinition[] = s.multiViews.map((mv, pos) => {
    const layout = num(mv, 'LayoutID') ?? 0
    const windows = kids(kid(mv, 'Windows'), 'Window')
      .map((w) => ({ windowIndex: num(w, 'index') ?? -1, sourceId: num(w, 'input') ?? -1 }))
      .filter((w) => w.windowIndex >= 0 && w.sourceId >= 0)
    const legacy: AtemMvDefinition = {
      index: num(mv, 'index') ?? pos,
      layout,
      windows,
      ...(bool(mv, 'programPreviewSwapped') !== undefined ? { programPreviewSwapped: bool(mv, 'programPreviewSwapped') } : {}),
    }
    return migrateMvToQuadrants(legacy)
  })
  return { multiViewers }
}

// ─── Ausgeben ──────────────────────────────────────────────────────────

/** Fenster eines Multiviewers in ATEM-Zaehlung. */
const mvWindowsAtem = (mv: AtemMvDefinition): Map<number, number> => {
  const out = new Map<number, number>()
  for (const w of mv.windows) {
    const idx = mv.quadrants ? mapCpWindowIndexToAtem(w.windowIndex, mv.layout) : w.windowIndex
    if (idx >= 0) out.set(idx, w.sourceId)
  }
  return out
}

/**
 * Die Setup-Datei aus dem Plan schreiben.
 *
 * Grundlage ist die geladene Datei (`switching.atemProfile.rawXml`); ohne
 * sie entsteht ein Geruest mit den Abschnitten, die das Modell kennt. In
 * beiden Faellen werden nur vorhandene Attribute ueberschrieben.
 */
export const writeAtemProfileXml = (device: EquipmentItem): string => {
  const state = device.switching ?? {}
  const profile = switchingProfileFor(device)
  const matrix = buildInnerMatrix(device, profile, state)
  const xml = state.atemProfile?.rawXml ?? atemProfileSkeleton(device, matrix)
  const root = scanXml(xml)
  const s = sections(root)
  const p = new Patcher()
  const srcId = (dest: string): number | undefined => {
    const src = routeOf(device, matrix, state, dest)
    return src ? matrix.byId.get(src)?.sourceId : undefined
  }

  s.mes.forEach((me, pos) => {
    const n = (num(me, 'index') ?? pos) + 1
    p.set(kid(me, 'Program'), 'input', srcId(`me:${n}/pgm`))
    p.set(kid(me, 'Preview'), 'input', srcId(`me:${n}/pvw`))
    kids(kid(me, 'Keys'), 'Key').forEach((key, kpos) => {
      const k = (num(key, 'index') ?? kpos) + 1
      const ks = state.keyers?.[`me:${n}/key:${k}`]
      p.set(key, 'inputFill', srcId(`me:${n}/key:${k}/fill`))
      p.set(key, 'inputCut', srcId(`me:${n}/key:${k}/key`))
      p.set(key, 'onAir', ks?.onAir)
      p.set(key, 'type', ks?.type ? KEY_TYPE_XML[ks.type] : undefined)
    })
  })
  s.dsks.forEach((d, pos) => {
    const n = (num(d, 'index') ?? pos) + 1
    p.set(d, 'fillSource', srcId(`dsk:${n}/fill`))
    p.set(d, 'keySource', srcId(`dsk:${n}/key`))
    p.set(d, 'onAir', state.keyers?.[`dsk:${n}`]?.onAir)
  })
  s.supers.forEach((ss, pos) => {
    const n = superIndex(ss, pos) + 1
    p.set(ss, 'artFillInput', srcId(`ss:${n}/art-fill`))
    p.set(ss, 'artKeyInput', srcId(`ss:${n}/art-key`))
    kids(kid(ss, 'Boxes'), 'Box').forEach((box, bpos) => {
      const b = (num(box, 'index') ?? bpos) + 1
      p.set(box, 'inputSource', srcId(`ss:${n}/box:${b}`))
      p.set(box, 'enabled', state.atemProfile?.boxes?.[`ss:${n}/box:${b}`])
    })
  })
  for (const a of s.auxes) {
    const id = num(a, 'id')
    if (id !== undefined && id > 8000) p.set(a, 'input', srcId(`aux:${id - 8000}`))
  }
  s.players.forEach((pl, pos) => {
    const n = (num(pl, 'index') ?? pos) + 1
    const still = /^still:(\d+)$/.exec(state.routes?.[`mp:${n}/still`] ?? '')
    if (still) {
      p.set(pl, 'sourceType', 'Still')
      p.set(pl, 'sourceIndex', Number(still[1]) - 1)
    }
  })
  s.colors.forEach((c, pos) => {
    const col = state.atemProfile?.colors?.[String((num(c, 'index') ?? pos) + 1)]
    p.set(c, 'hue', col?.hue)
    p.set(c, 'saturation', col?.saturation)
    p.set(c, 'luma', col?.luma)
  })
  for (const e of s.stills) {
    const st = state.atemProfile?.stills?.[String((num(e, 'index') ?? -2) + 1)]
    p.set(e, 'name', st?.name)
    p.set(e, 'path', st?.path)
  }
  for (const e of s.inputs) {
    const inp = state.atemProfile?.inputs?.[String(num(e, 'id'))]
    p.set(e, 'shortName', inp?.shortName)
    p.set(e, 'longName', inp?.longName)
  }
  s.macros.forEach((m, pos) => {
    const mac = state.atemProfile?.macros?.[String((num(m, 'index') ?? pos) + 1)]
    p.set(m, 'name', mac?.name)
    p.set(m, 'description', mac?.description)
  })
  s.mixMinus.forEach((m, pos) => p.set(m, 'audioMode', state.atemProfile?.mixMinus?.[String((num(m, 'index') ?? pos) + 1)]))

  // Multiviewer aus dem Plan (`atemMvConfig`). Nur wenn die Aufteilung in der
  // Datei dieselbe ist — sonst zeigten die Fensternummern auf andere Kacheln.
  const mvs = new Map((device.atemMvConfig?.multiViewers ?? []).map((m) => [m.index, m]))
  s.multiViews.forEach((el, pos) => {
    const mv = mvs.get(num(el, 'index') ?? pos)
    if (!mv) return
    p.set(el, 'programPreviewSwapped', mv.programPreviewSwapped)
    const fileLayout = num(el, 'LayoutID')
    if (fileLayout !== undefined && fileLayout !== mv.layout) return
    const wins = mvWindowsAtem(mv)
    for (const w of kids(kid(el, 'Windows'), 'Window')) p.set(w, 'input', wins.get(num(w, 'index') ?? -1))
  })

  patchAudio(p, root, device.atemAudioConfig)
  return p.apply(xml)
}

/** Audio-Teil aus dem Plan (`atemAudioConfig`) — dieselben Felder wie `serializeAudioConfigXml`. */
const patchAudio = (p: Patcher, root: XmlEl, audio: AtemAudioConfig | undefined) => {
  if (!audio) return
  const profile = kid(root, 'Profile')
  if (audio.matrix) {
    const outs = byIndex(kids(kid(kid(profile, 'AudioMapping'), 'AudioOutputs'), 'Output'), 'id')
    for (const o of audio.matrix.outputs) p.set(outs.get(o.id), 'sourceId', o.sourceId)
  }
  const mixer = kid(profile, 'AudioMixer')
  if (audio.classicMixer && mixer) {
    const m = audio.classicMixer
    p.set(mixer, 'programOutGain', m.programOutGain)
    p.set(mixer, 'programOutBalance', m.programOutBalance)
    p.set(mixer, 'programOutFollowFadeToBlack', m.programOutFollowFadeToBlack)
    p.set(mixer, 'audioFollowVideoCrossfadeTransition', m.audioFollowVideoCrossfadeTransition)
    const ins = byIndex(kids(kid(mixer, 'AudioInputs'), 'AudioInput'), 'id')
    for (const i of m.inputs) {
      const el = ins.get(i.id)
      p.set(el, 'mixOption', i.mixOption)
      if (i.gain === null) {
        if (!/^-?inf/i.test(at(el, 'gain') ?? '')) p.set(el, 'gain', '-inf')
      } else p.set(el, 'gain', i.gain)
      p.set(el, 'balance', i.balance)
    }
  }
}

/**
 * Geruest einer Setup-Datei, wenn keine geladen ist. Es enthaelt nur die
 * Abschnitte, die das Modell kennt, mit den Namen aus dem offenen Format;
 * die Werte setzt danach derselbe Patch wie bei einer geladenen Datei.
 */
export const atemProfileSkeleton = (device: EquipmentItem, matrix: InnerMatrix): string => {
  const c = (kind: string) => matrix.blocks.filter((b) => b.kind === kind)
  const keysPer = (me: string) => matrix.blocks.filter((b) => b.kind === 'upstreamKeyer' && b.parent === me)
  const L: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', `<Profile majorVersion="1" minorVersion="5" product="${encode(device.name || 'ATEM')}">`]
  const mes = c('mixEffect')
  if (mes.length) {
    L.push('    <MixEffectBlocks>')
    for (const me of mes) {
      L.push(`        <MixEffectBlock index="${me.index - 1}">`, '            <Program input="0"/>', '            <Preview input="0"/>')
      const keys = keysPer(me.id)
      if (keys.length) {
        L.push('            <Keys>')
        for (const k of keys) L.push(`                <Key index="${k.index - 1}" type="Luma" inputCut="0" inputFill="0" onAir="False"/>`)
        L.push('            </Keys>')
      }
      L.push('        </MixEffectBlock>')
    }
    L.push('    </MixEffectBlocks>')
  }
  const dsks = c('downstreamKeyer')
  if (dsks.length) {
    L.push('    <DownstreamKeys>')
    for (const d of dsks) L.push(`        <DownstreamKey index="${d.index - 1}" fillSource="0" keySource="0" onAir="False"/>`)
    L.push('    </DownstreamKeys>')
  }
  const sss = c('superSource')
  if (sss.length) {
    L.push('    <SuperSources>')
    for (const ss of sss) {
      L.push(`        <SuperSource index="${ss.index - 1}" artFillInput="0" artKeyInput="0">`, '            <Boxes>')
      for (const d of ss.dests.filter((x) => x.role === 'box')) {
        L.push(`                <Box index="${(d.index ?? 1) - 1}" enabled="False" inputSource="0"/>`)
      }
      L.push('            </Boxes>', '        </SuperSource>')
    }
    L.push('    </SuperSources>')
  }
  const colors = c('color')
  if (colors.length) {
    L.push('    <ColorGenerators>')
    for (const col of colors) L.push(`        <ColorGenerator index="${col.index - 1}" hue="0" saturation="0" luma="0"/>`)
    L.push('    </ColorGenerators>')
  }
  const auxes = c('aux')
  if (auxes.length) {
    L.push('    <Auxiliaries>')
    for (const a of auxes) L.push(`        <Auxiliary id="${8000 + a.index}" input="0"/>`)
    L.push('    </Auxiliaries>')
  }
  const inputs = c('input')
  const mvs = device.atemMvConfig?.multiViewers ?? []
  L.push('    <Settings>')
  if (inputs.length) {
    L.push('        <Inputs>')
    for (const i of inputs) {
      const long = (i.portName ?? `Input ${i.index}`).slice(0, 20)
      L.push(`            <Input id="${i.index}" shortName="${encode(long.slice(0, 4))}" longName="${encode(long)}"/>`)
    }
    L.push('        </Inputs>')
  }
  if (mvs.length) {
    L.push('        <MultiViews>')
    for (const mv of mvs) {
      L.push(`            <MultiView index="${mv.index}" LayoutID="${mv.layout}" programPreviewSwapped="False">`, '                <Windows>')
      for (const [idx] of [...mvWindowsAtem(mv)].sort((a, b) => a[0] - b[0])) L.push(`                    <Window index="${idx}" input="0"/>`)
      L.push('                </Windows>', '            </MultiView>')
    }
    L.push('        </MultiViews>')
  }
  L.push('    </Settings>')
  const players = c('mediaPlayer')
  if (players.length) {
    L.push('    <MediaPlayers>')
    for (const mp of players) L.push(`        <MediaPlayer index="${mp.index - 1}" sourceType="Still" sourceIndex="0"/>`)
    L.push('    </MediaPlayers>')
  }
  L.push('</Profile>', '')
  return L.join('\n')
}
