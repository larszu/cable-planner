import type { ConnectorType } from '../../types/equipment'
import type { CableSpec } from '../../types/cableSpec'

export const CUSTOM_CABLE_SPEC_ID = '__custom__'

export const makeCustomCableSpec = (connectorType: ConnectorType, color: string): CableSpec => ({
  id: CUSTOM_CABLE_SPEC_ID,
  name: 'Custom Cable',
  connectorType,
  standards: ['Generic'],
  color,
  notes: 'Benutzerdefiniertes Kabel ohne Katalog-Preset.',
})
