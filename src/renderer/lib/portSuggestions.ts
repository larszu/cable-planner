import { v4 as uuidv4 } from 'uuid'
import type { ConnectorType, EquipmentTemplate, Port } from '../types/equipment'

export interface PortGroupHint {
  direction: 'in' | 'out'
  count: number
  connectorType: ConnectorType
  label: string
}

const rules: Array<{ test: RegExp; hints: PortGroupHint[] }> = [
  {
    // Switcher / vision mixer — check first (more specific than "camera")
    test: /\b(switcher|atem|vision\s*mixer|bildmischer)\b/i,
    hints: [
      { direction: 'in', count: 8, connectorType: 'BNC', label: 'SDI In' },
      { direction: 'out', count: 2, connectorType: 'BNC', label: 'Program' },
      { direction: 'out', count: 1, connectorType: 'HDMI', label: 'Multiview' },
    ],
  },
  {
    // Monitor / field recorder
    test: /\b(monitor|atomos|ninja|shogun|recorder|display|smallhd)\b/i,
    hints: [
      { direction: 'in', count: 1, connectorType: 'BNC', label: 'SDI In' },
      { direction: 'in', count: 1, connectorType: 'HDMI', label: 'HDMI In' },
      { direction: 'out', count: 1, connectorType: 'HDMI', label: 'HDMI Thru' },
    ],
  },
  {
    // Converter / scaler
    test: /\b(converter|scaler|ultrastudio|teranex|decimator|mini[-\s]*converter)\b/i,
    hints: [
      { direction: 'in', count: 1, connectorType: 'BNC', label: 'SDI In' },
      { direction: 'out', count: 1, connectorType: 'HDMI', label: 'HDMI Out' },
    ],
  },
  {
    // Camera
    test: /\b(camera|kamera|blackmagic|ursa|fx\d|red\s|alexa|venice|sony\s+[a-z]+\d+|canon\s+c\d+)\b/i,
    hints: [
      { direction: 'out', count: 1, connectorType: 'BNC', label: 'SDI Out' },
      { direction: 'out', count: 1, connectorType: 'HDMI', label: 'HDMI Out' },
      { direction: 'in', count: 1, connectorType: 'XLR', label: 'Audio In' },
    ],
  },
  {
    // Audio mixer / console
    test: /\b(mixer|mischpult|konsole|mischer|console|qu-\d|cl\d|ls\d|x32|m32)\b/i,
    hints: [
      { direction: 'in', count: 8, connectorType: 'XLR', label: 'Line/Mic' },
      { direction: 'out', count: 2, connectorType: 'XLR', label: 'Master' },
    ],
  },
  {
    // Microphone
    test: /\b(mikro|microphone|mikrofon|wireless.*mic|lavalier|handheld|shotgun|sm\d+|beta\s*\d+)\b/i,
    hints: [{ direction: 'out', count: 1, connectorType: 'XLR', label: 'Mic Out' }],
  },
  {
    // Light
    test: /\b(licht|light|scheinwerfer|aputure|skypanel|led\s*panel|kino[-\s]*flo|arri\s|rgbw)\b/i,
    hints: [
      { direction: 'in', count: 1, connectorType: 'PowerCON', label: 'Power In' },
      { direction: 'in', count: 1, connectorType: 'Ethernet/RJ45', label: 'sACN/Art-Net' },
    ],
  },
  {
    // Fiber link
    test: /\b(fiber|glasfaser|sfp|lwl|opticalcon)\b/i,
    hints: [
      { direction: 'in', count: 1, connectorType: 'Fiber', label: 'Fiber In' },
      { direction: 'out', count: 1, connectorType: 'Fiber', label: 'Fiber Out' },
    ],
  },
  {
    // Power distro
    test: /\b(distro|verteiler|mehrfachsteckdose|power\s*strip|stromverteiler)\b/i,
    hints: [
      { direction: 'in', count: 1, connectorType: 'Schuko 230V', label: 'Mains' },
      { direction: 'out', count: 6, connectorType: 'Schuko 230V', label: 'Outlet' },
    ],
  },
  {
    // Network switch
    test: /\b(switch|netzwerkswitch|network\s*switch|gigabit\s*switch|poe\s*switch)\b/i,
    hints: [{ direction: 'in', count: 8, connectorType: 'Ethernet/RJ45', label: 'LAN' }],
  },
]

export const suggestPortGroups = (name: string, category = ''): PortGroupHint[] => {
  const haystack = `${name} ${category}`
  for (const rule of rules) {
    if (rule.test.test(haystack)) return rule.hints.map((h) => ({ ...h }))
  }
  return [
    { direction: 'in', count: 1, connectorType: 'Custom', label: 'Input' },
    { direction: 'out', count: 1, connectorType: 'Custom', label: 'Output' },
  ]
}

const portsFromHints = (hints: PortGroupHint[], dir: 'in' | 'out'): Port[] =>
  hints
    .filter((h) => h.direction === dir)
    .flatMap((h) =>
      Array.from({ length: Math.max(0, h.count) }, (_item, i) => ({
        id: uuidv4(),
        name: `${h.label} ${i + 1}`,
        type: h.connectorType,
        connectorType: h.connectorType,
      })),
    )

export const buildTemplateFromHints = (
  name: string,
  category: string,
  hints: PortGroupHint[],
): EquipmentTemplate => {
  const inputs = portsFromHints(hints, 'in')
  const outputs = portsFromHints(hints, 'out')
  const maxPorts = Math.max(inputs.length, outputs.length, 3)
  return {
    name: name.trim() || 'Unnamed',
    category: category.trim() || 'Custom',
    inputs,
    outputs,
    width: 240,
    height: 80 + maxPorts * 22,
  }
}
