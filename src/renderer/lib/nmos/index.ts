// ───────────────────────────────────────────────────────────────────────────
// NMOS-Ausgabe des Plans (#1240, Stufe 6): ein Paket aus IS-04-Inventar,
// IS-05-Soll-Verbindungen und Salvos, IS-08-Kanalzuordnungen und den
// MS-05-02-Blockbaeumen der Mischer und Kreuzschienen.
//
// Jeder Teil hat genau die Form, die die jeweilige API erwartet; die Tests
// pruefen sie gegen die offiziellen AMWA-Schemas (tests/fixtures/amwa).
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../../types/project'
import { buildNmosPlan, type Is04Resources } from './is04'
import { buildIs05, type Is05Export } from './is05'
import { buildIs08, type Is08Device } from './is08'
import { buildMs0502, type Ms0502Export } from './ms0502'

export const NMOS_EXPORT_FORMAT = 'lz-cable-planner/nmos'

export const NMOS_SPEC_VERSIONS = {
  'IS-04': 'v1.3',
  'IS-05': 'v1.2',
  'IS-08': 'v1.0',
  'MS-05-02': 'v1.0',
} as const

export interface NmosExport {
  format: typeof NMOS_EXPORT_FORMAT
  formatVersion: 1
  generatedAt: string
  project: string
  specs: typeof NMOS_SPEC_VERSIONS
  is04: Is04Resources
  is05: Is05Export
  is08: Is08Device[]
  ms0502: Ms0502Export[]
}

export const buildNmosExport = (project: CablePlannerProject, at: Date): NmosExport => {
  const plan = buildNmosPlan(project, at)
  return {
    format: NMOS_EXPORT_FORMAT,
    formatVersion: 1,
    generatedAt: at.toISOString(),
    project: project.metadata.name,
    specs: NMOS_SPEC_VERSIONS,
    is04: plan.resources,
    is05: buildIs05(project, plan),
    is08: buildIs08(project),
    ms0502: project.equipment.map(buildMs0502).filter((x): x is Ms0502Export => !!x),
  }
}

/** Ist das Paket leer — nichts, was ein NMOS-Controller lesen koennte? */
export const nmosExportIsEmpty = (e: NmosExport): boolean =>
  !e.is04.devices.length && !e.is08.length && !e.ms0502.length

export { buildNmosPlan } from './is04'
export { buildIs05 } from './is05'
export { buildIs08 } from './is08'
export { buildMs0502 } from './ms0502'
export { parseRegistry, previewRegistry, equipmentFromPreview, RegistryFormatError } from './importIs04'
export type { Is04ImportPreview, ImportDevice, RegistryResources } from './importIs04'
