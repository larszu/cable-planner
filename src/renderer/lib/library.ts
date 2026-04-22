import { v4 as uuidv4 } from 'uuid'
import type { EquipmentItem } from '../types/equipment'

const size = { width: 220, height: 140 }

const port = (name: string, connectorType: EquipmentItem['inputs'][number]['connectorType']) => ({
  id: uuidv4(),
  name,
  type: connectorType,
  connectorType,
})

export const builtInLibrary: Omit<EquipmentItem, 'id' | 'x' | 'y'>[] = [
  {
    name: 'Vision Mixer',
    category: 'Video',
    inputs: [port('Program In', 'SDI'), port('Aux In', 'HDMI')],
    outputs: [port('Program Out', 'SDI'), port('Multiview', 'HDMI')],
    ...size,
  },
  {
    name: 'Audio Console',
    category: 'Audio',
    inputs: [port('Mic 1', 'XLR'), port('Mic 2', 'XLR')],
    outputs: [port('Main L', 'XLR'), port('Main R', 'XLR')],
    ...size,
  },
  {
    name: 'Media Server',
    category: 'Playback',
    inputs: [port('Network', 'Ethernet/RJ45')],
    outputs: [port('SDI Out', 'SDI'), port('HDMI Out', 'HDMI')],
    ...size,
  },
]
