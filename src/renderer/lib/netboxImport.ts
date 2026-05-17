import { v4 as uuidv4 } from 'uuid'
import { parse } from 'yaml'
import type { ConnectorType, EquipmentTemplate, Port } from '../types/equipment'
import { STORAGE_KEYS } from './storageKeys'

const OWNER = 'netbox-community'
const REPO = 'devicetype-library'
const BRANCHES = ['master', 'main'] as const
const INDEX_CACHE_KEY = STORAGE_KEYS.netboxIndexV1

type GitTreeEntry = {
  path: string
  type: string
}

type GitTreeResponse = {
  tree?: GitTreeEntry[]
  truncated?: boolean
}

type NetBoxFrontMatter = {
  manufacturer?: string
  model?: string
  slug?: string
  u_height?: number
  front_image?: string
  rear_image?: string
  interfaces?: Array<Record<string, unknown>>
  power_ports?: Array<Record<string, unknown>>
  power_outlets?: Array<Record<string, unknown>>
  console_ports?: Array<Record<string, unknown>>
  console_server_ports?: Array<Record<string, unknown>>
  rear_ports?: Array<Record<string, unknown>>
  front_ports?: Array<Record<string, unknown>>
}

export interface NetBoxDeviceTypeSearchResult {
  branch: string
  path: string
  manufacturer: string
  model: string
  slug: string
}

const makePort = (
  name: string,
  connectorType: ConnectorType,
  direction?: Port['direction'],
): Port => ({
  id: uuidv4(),
  name,
  type: connectorType,
  connectorType,
  direction,
})

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const toText = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>
    const label = rec.label ?? rec.value ?? rec.name ?? rec.slug ?? ''
    if (label) return String(label)
  }
  return ''
}

const inferConnectorType = (name: string, typeValue: string): ConnectorType => {
  const haystack = `${name} ${typeValue}`.toLowerCase()
  if (haystack.includes('hdmi')) return 'HDMI'
  if (haystack.includes('displayport') || haystack.includes('dp-')) return 'DisplayPort'
  if (haystack.includes('xlr') || haystack.includes('aes3')) return 'XLR'
  if (haystack.includes('bnc') || haystack.includes('sdi') || haystack.includes('coax')) return 'BNC'
  if (haystack.includes('usb')) return 'USB'
  if (haystack.includes('powercon')) return 'PowerCON'
  if (haystack.includes('schuko')) return 'Schuko 230V'
  if (haystack.includes('iec') || haystack.includes('c13') || haystack.includes('c14')) return 'IEC 230V'
  if (haystack.includes('sfp28') || haystack.includes('qsfp') || haystack.includes('sfpp') || haystack.includes('sfp+')) return 'SFP+'
  if (haystack.includes('sfp')) return 'SFP'
  if (haystack.includes('lc') || haystack.includes('fiber') || haystack.includes('fibre')) return 'Fiber'
  if (
    haystack.includes('rj45') ||
    haystack.includes('8p8c') ||
    haystack.includes('base-t') ||
    haystack.includes('ethernet')
  ) {
    return 'Ethernet/RJ45'
  }
  return 'Custom'
}

const inferDirection = (name: string, typeValue: string, roleValue: string): 'in' | 'out' | 'bidirectional' => {
  const value = `${name} ${typeValue} ${roleValue}`.toLowerCase()
  if (/\b(out|output|send|tx)\b/.test(value)) return 'out'
  if (/\b(in|input|return|rx)\b/.test(value)) return 'in'
  if (/\b(power\s*in|psu\s*in|mains\s*in)\b/.test(value)) return 'in'
  if (/\b(power\s*out|poe\s*out)\b/.test(value)) return 'out'
  return 'bidirectional'
}

const portExists = (ports: Port[], name: string): boolean => {
  const needle = normalize(name)
  return ports.some((port) => normalize(port.name) === needle)
}

const appendPort = (
  inputs: Port[],
  outputs: Port[],
  name: string,
  connectorType: ConnectorType,
  direction: 'in' | 'out' | 'bidirectional',
) => {
  if (direction === 'in') {
    if (!portExists(inputs, name)) inputs.push(makePort(name, connectorType, 'in'))
    return
  }
  if (direction === 'out') {
    if (!portExists(outputs, name)) outputs.push(makePort(name, connectorType, 'out'))
    return
  }
  // Keep bidirectional ports as a mirrored in/out pair with matching names,
  // but avoid multiplying duplicates when NetBox entries overlap.
  if (!portExists(inputs, name)) {
    inputs.push(makePort(name, connectorType, 'bidirectional'))
  }
  if (!portExists(outputs, name)) {
    outputs.push(makePort(name, connectorType, 'bidirectional'))
  }
}

const toName = (record: Record<string, unknown>, fallback: string): string => {
  const raw = record.label ?? record.name ?? record.type ?? record.rear_port ?? fallback
  return String(raw || fallback).trim()
}

const resolvePanelImageUrl = (
  imageValue: string | undefined,
  item: NetBoxDeviceTypeSearchResult,
): string | undefined => {
  const raw = (imageValue ?? '').trim()
  if (!raw) return undefined
  if (/^https?:\/\//i.test(raw)) return raw

  const base = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${item.branch}/`
  const normalizedPath = raw.replace(/^\/+/, '')
  if (normalizedPath.startsWith('images/') || normalizedPath.startsWith('device-types/')) {
    return `${base}${normalizedPath}`
  }

  const pathParts = item.path.split('/')
  pathParts.pop()
  const folder = pathParts.join('/')
  return `${base}${folder}/${normalizedPath}`
}

const importPorts = (device: NetBoxFrontMatter) => {
  const inputs: Port[] = []
  const outputs: Port[] = []

  const interfaceLike = [
    ...(device.interfaces ?? []),
    ...(device.console_ports ?? []),
    ...(device.console_server_ports ?? []),
    ...(device.front_ports ?? []),
    ...(device.rear_ports ?? []),
  ]

  for (const raw of interfaceLike) {
    const name = toName(raw, 'Port')
    const typeValue = toText(raw.type ?? raw.label ?? '')
    const roleValue = toText(raw.role ?? raw.mode ?? raw.rear_port ?? '')
    const connectorType = inferConnectorType(name, typeValue)
    const direction = inferDirection(name, typeValue, roleValue)
    appendPort(inputs, outputs, name, connectorType, direction)
  }

  for (const raw of device.power_ports ?? []) {
    const name = toName(raw, 'Power In')
    const typeValue = toText(raw.type ?? raw.label ?? '')
    const connectorType = inferConnectorType(name, typeValue)
    appendPort(inputs, outputs, name, connectorType, 'in')
  }

  for (const raw of device.power_outlets ?? []) {
    const name = toName(raw, 'Power Out')
    const typeValue = toText(raw.type ?? raw.label ?? '')
    const connectorType = inferConnectorType(name, typeValue)
    appendPort(inputs, outputs, name, connectorType, 'out')
  }

  return { inputs, outputs }
}

const fetchTreeForBranch = async (branch: string): Promise<NetBoxDeviceTypeSearchResult[]> => {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${branch}?recursive=1`)
  if (!res.ok) {
    throw new Error(`GitHub tree ${branch} failed with ${res.status}`)
  }
  const json = (await res.json()) as GitTreeResponse
  const files = (json.tree ?? []).filter(
    (entry) =>
      entry.type === 'blob' &&
      entry.path.startsWith('device-types/') &&
      /\.ya?ml$/i.test(entry.path),
  )
  return files.map((entry) => {
    const parts = entry.path.split('/')
    const manufacturer = parts[1] ?? 'Unknown'
    const fileName = parts[parts.length - 1] ?? ''
    const model = fileName.replace(/\.ya?ml$/i, '')
    return {
      branch,
      path: entry.path,
      manufacturer,
      model,
      slug: normalize(model).replace(/\s+/g, '-'),
    }
  })
}

const loadIndex = async (): Promise<NetBoxDeviceTypeSearchResult[]> => {
  try {
    const cached = localStorage.getItem(INDEX_CACHE_KEY)
    if (cached) return JSON.parse(cached) as NetBoxDeviceTypeSearchResult[]
  } catch {
    /* ignore */
  }

  let lastError: Error | null = null
  for (const branch of BRANCHES) {
    try {
      const items = await fetchTreeForBranch(branch)
      try {
        localStorage.setItem(INDEX_CACHE_KEY, JSON.stringify(items))
      } catch {
        /* ignore */
      }
      return items
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }
  throw lastError ?? new Error('NetBox index could not be loaded')
}

export const searchNetBoxDeviceTypes = async (query: string): Promise<NetBoxDeviceTypeSearchResult[]> => {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const terms = normalize(trimmed).split(' ').filter(Boolean)
  const index = await loadIndex()
  return index
    .filter((item) => {
      const haystack = normalize(`${item.manufacturer} ${item.model}`)
      return terms.every((term) => haystack.includes(term))
    })
    .sort((a, b) => `${a.manufacturer} ${a.model}`.localeCompare(`${b.manufacturer} ${b.model}`))
    .slice(0, 60)
}

export const clearNetBoxIndexCache = (): void => {
  try {
    localStorage.removeItem(INDEX_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

export const importNetBoxDeviceType = async (
  item: NetBoxDeviceTypeSearchResult,
): Promise<EquipmentTemplate> => {
  const rawUrl = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${item.branch}/${item.path}`
  const res = await fetch(rawUrl)
  if (!res.ok) {
    throw new Error(`NetBox YAML could not be loaded (${res.status})`)
  }
  const text = await res.text()
  const parsed = parse(text) as NetBoxFrontMatter
  const model = String(parsed.model ?? item.model)
  const manufacturer = String(parsed.manufacturer ?? item.manufacturer)
  const { inputs, outputs } = importPorts(parsed)
  const rackUnits = Number(parsed.u_height ?? 1) || 1
  const frontPanelImageUrl = resolvePanelImageUrl(parsed.front_image, item)
  const rearPanelImageUrl = resolvePanelImageUrl(parsed.rear_image, item)
  const portRows = Math.max(inputs.length, outputs.length, 3)

  return {
    name: `${manufacturer} ${model}`.trim(),
    category: 'Sonstiges',
    inputs,
    outputs,
    isRackDevice: rackUnits > 0,
    rackUnits,
    netboxPath: item.path,
    frontPanelImageUrl,
    rearPanelImageUrl,
    width: 240,
    height: 80 + portRows * 22,
    notes: `Importiert aus NetBox device-type-library (${item.path}).`,
  }
}
