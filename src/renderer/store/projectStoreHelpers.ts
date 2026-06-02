import { v4 as uuidv4 } from 'uuid'
import type { CablePlannerProject } from '../types/project'
import type { Port } from '../types/equipment'

/**
 * #308 — Pure Helper-Funktionen aus projectStore ausgelagert. Diese sind
 * frei von State-Subscriptions und können von Slices oder Komponenten
 * direkt aufgerufen werden, ohne den Store-Builder zu erweitern.
 */

export const nowIso = (): string => new Date().toISOString()

/**
 * Frisches leeres Projekt — Start-Stand fuer den initialen Store
 * sowie nach `clear()`. Setzt sinnvolle Default-Metadaten und einen
 * neutralen Viewport.
 */
export const defaultProject = (): CablePlannerProject => ({
  metadata: {
    name: 'Untitled Project',
    description: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    defaultVideoFormat: '1080p50',
    defaultPowerStandard: 'eu-230-1ph',
    defaultLightingControl: 'dmx512',
  },
  equipment: [],
  cables: [],
  locations: [],
  canvasState: { x: 0, y: 0, zoom: 1 },
})

/**
 * Berührt `updatedAt` im Metadaten-Block. Wird in fast jedem
 * Store-Mutator aufgerufen, damit der File-Save-Indikator und die
 * Recents-Liste korrekt aktualisiert werden.
 */
export const touchProject = (project: CablePlannerProject): CablePlannerProject => ({
  ...project,
  metadata: {
    ...project.metadata,
    updatedAt: nowIso(),
  },
})

/**
 * v7.9.5 — Zentrale Lock-Check für Plan-Mutationen. Wenn der User den
 * Plan als "abgeschlossen" markiert hat oder eine Viewer-Datei geöffnet
 * ist, dürfen Geräte/Kabel/Layout NICHT mehr verändert werden.
 * Annotations + Mobile-Check-State + Mode-Switch sind davon ausgenommen.
 */
export const isProjectLocked = (state: { project: CablePlannerProject }): boolean => {
  const mode = state.project.mode
  return mode === 'finalized' || mode === 'viewer'
}

/**
 * Stellt sicher, dass ein importierter Port alle Pflichtfelder hat.
 * - id wird generiert wenn leer
 * - name fällt auf fallbackName zurück
 * - originalName wird vom name abgeleitet wenn nicht gesetzt (für den
 *   Label-Swap-Feature beim Cable-Reconnect, v7.9.113)
 * - type/connectorType default auf 'Custom'
 *
 * Spread des Eingangs-Ports zuerst, damit optionale Felder wie
 * `direction`, `sfpType`, `sfpStandard`, `sfpWavelength`, `sfpVendor`
 * den Import überleben.
 */
export const sanitizePort = (port: Partial<Port>, fallbackName: string): Port => {
  const name = port.name ?? fallbackName
  return {
    ...port,
    id: port.id && port.id.length > 0 ? port.id : uuidv4(),
    name,
    originalName: port.originalName ?? name,
    type: port.type ?? 'Custom',
    connectorType: port.connectorType ?? 'Custom',
  }
}
