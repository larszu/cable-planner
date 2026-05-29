// Issue #343 — Projekt-Vorlagen ("Neu aus Vorlage").
//
// Non-destruktiv: Vorlagen sind reine Snapshots eines CablePlannerProject,
// die in localStorage (eigene) bzw. statisch (mitgelieferte Show-Setups)
// liegen. "Verwenden" lädt eine *Kopie* über loadProject — bestehende
// Projektdaten werden nie überschrieben, nur ersetzt nachdem der User
// bestätigt hat. Vorlagen tragen weder Dateipfad noch projektspezifische
// Auftraggeber-/Logo-Daten.

import { v4 as uuidv4 } from 'uuid'
import type { CablePlannerProject } from '../types/project'
import type { LocationFrame } from '../types/location'

export interface ProjectTemplate {
  id: string
  name: string
  /** Kurzbeschreibung für die Galerie-Karte. */
  description: string
  /** true = mitgeliefert (nicht löschbar), false/undefined = User-Vorlage. */
  builtin?: boolean
  /** i18n-Key für die Beschreibung (nur Built-ins; User-Vorlagen nutzen description direkt). */
  descKey?: string
  /** i18n-Key für den Namen (nur Built-ins). */
  nameKey?: string
  project: CablePlannerProject
}

const STORAGE_KEY = 'cable-planner.project-templates.v1'

const nowIso = () => new Date().toISOString()

/** Tiefe Kopie eines Projekts. Projektdaten sind JSON-serialisierbar (.cableplan),
 *  daher ist der JSON-Roundtrip sicher und folgt der Konvention im Canvas-Clipboard. */
const cloneProject = (p: CablePlannerProject): CablePlannerProject =>
  JSON.parse(JSON.stringify(p)) as CablePlannerProject

const frame = (
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): LocationFrame => ({ id: uuidv4(), name, x, y, width, height, color })

/**
 * Mitgelieferte Show-Setup-Vorlagen. Bewusst schlank gehalten: Metadaten
 * (Name, Beschreibung, Default-Videoformat) plus ein, zwei Standort-Rahmen
 * als räumlicher Startpunkt — kein vorgefertigtes Equipment, damit keine
 * unrealistischen/halbgaren Geräte-Daten ins Projekt geraten. Der User
 * füllt die Rahmen mit seiner echten Library.
 */
export const buildBuiltinTemplates = (): ProjectTemplate[] => {
  const base = (name: string, description: string, frames: LocationFrame[]): CablePlannerProject => ({
    metadata: {
      name,
      description,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      defaultVideoFormat: '1080p50',
    },
    equipment: [],
    cables: [],
    locations: frames,
    canvasState: { x: 0, y: 0, zoom: 1 },
  })

  return [
    {
      id: 'builtin-ob-van',
      builtin: true,
      nameKey: 'templates.builtin.obVan.name',
      descKey: 'templates.builtin.obVan.desc',
      name: 'Ü-Wagen / OB-Van',
      description: 'Übertragungswagen mit Bühne und FOH — getrennte Standort-Rahmen.',
      project: base('Ü-Wagen / OB-Van', 'Übertragungswagen-Setup', [
        frame('Ü-Wagen', 40, 40, 520, 360, '#38bdf8'),
        frame('Bühne', 620, 40, 520, 360, '#34d399'),
      ]),
    },
    {
      id: 'builtin-studio',
      builtin: true,
      nameKey: 'templates.builtin.studio.name',
      descKey: 'templates.builtin.studio.desc',
      name: 'TV-Studio',
      description: 'Studio mit Regie und Studioboden.',
      project: base('TV-Studio', 'Studio-Setup', [
        frame('Regie', 40, 40, 520, 360, '#a78bfa'),
        frame('Studio', 620, 40, 520, 360, '#f472b6'),
      ]),
    },
    {
      id: 'builtin-live-stage',
      builtin: true,
      nameKey: 'templates.builtin.liveStage.name',
      descKey: 'templates.builtin.liveStage.desc',
      name: 'Live-Bühne',
      description: 'Bühne, FOH und Monitorwelt für Live-Events.',
      project: base('Live-Bühne', 'Live-Stage-Setup', [
        frame('Bühne', 40, 40, 640, 320, '#34d399'),
        frame('FOH', 40, 400, 300, 260, '#38bdf8'),
        frame('Monitor', 380, 400, 300, 260, '#fbbf24'),
      ]),
    },
    {
      id: 'builtin-corporate',
      builtin: true,
      nameKey: 'templates.builtin.corporate.name',
      descKey: 'templates.builtin.corporate.desc',
      name: 'Konferenz / Corporate',
      description: 'Saal und Regie für Tagungen und Corporate-Events.',
      project: base('Konferenz / Corporate', 'Corporate-Setup', [
        frame('Saal', 40, 40, 640, 360, '#60a5fa'),
        frame('Regie', 740, 40, 360, 360, '#a78bfa'),
      ]),
    },
    {
      id: 'builtin-worship',
      builtin: true,
      nameKey: 'templates.builtin.worship.name',
      descKey: 'templates.builtin.worship.desc',
      name: 'Houses of Worship',
      description: 'Altarraum/Bühne und Technikempore für Gottesdienste.',
      project: base('Houses of Worship', 'HoW-Setup', [
        frame('Altarraum', 40, 40, 640, 320, '#fbbf24'),
        frame('Technik-Empore', 40, 400, 640, 220, '#38bdf8'),
      ]),
    },
  ]
}

/** Liest die eigenen (User-)Vorlagen aus localStorage. Robust gegen kaputtes JSON. */
export const loadUserTemplates = (): ProjectTemplate[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is ProjectTemplate =>
        t && typeof t.id === 'string' && typeof t.name === 'string' && t.project,
    )
  } catch {
    return []
  }
}

const persist = (templates: ProjectTemplate[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch {
    // localStorage voll / nicht verfügbar — bewusst still, Save schlägt fehl
  }
}

/**
 * Speichert das übergebene Projekt als neue User-Vorlage. Strippt
 * projektspezifische Identitäts-Daten (Dateibezug, Auftraggeber, Logos,
 * Annotationen, Check-Status), damit die Vorlage neutral bleibt.
 */
export const saveUserTemplate = (
  name: string,
  description: string,
  project: CablePlannerProject,
): ProjectTemplate => {
  const clone: CablePlannerProject = cloneProject(project)
  // projektspezifische Identität entfernen
  delete clone.annotations
  delete clone.checkState
  delete clone.viewerSession
  clone.mode = 'editing'
  clone.metadata = {
    ...clone.metadata,
    name,
    description,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  delete clone.metadata.client
  delete clone.metadata.contractor
  delete clone.metadata.author
  delete clone.metadata.projectNumber
  delete clone.metadata.companyLogo
  delete clone.metadata.clientLogo
  delete clone.metadata.rentmanProjectId
  delete clone.metadata.rentmanProjectName
  delete clone.metadata.rentmanCablePlan
  delete clone.metadata.rentmanCableMap

  const tpl: ProjectTemplate = {
    id: `user-${uuidv4()}`,
    name,
    description,
    builtin: false,
    project: clone,
  }
  const next = [...loadUserTemplates(), tpl]
  persist(next)
  return tpl
}

/** Löscht eine User-Vorlage. Built-ins sind nicht löschbar. */
export const deleteUserTemplate = (id: string): void => {
  persist(loadUserTemplates().filter((t) => t.id !== id))
}

/**
 * Materialisiert eine Vorlage zu einem frischen Projekt: tiefe Kopie, neue
 * UUIDs für Standort-Rahmen (vermeidet ID-Kollisionen zwischen Vorlage und
 * geladenem Projekt) und ein neuer Projektname.
 */
export const instantiateTemplate = (tpl: ProjectTemplate, newName: string): CablePlannerProject => {
  const clone: CablePlannerProject = cloneProject(tpl.project)
  if (Array.isArray(clone.locations)) {
    clone.locations = clone.locations.map((f) => ({ ...f, id: uuidv4() }))
  }
  clone.metadata = {
    ...clone.metadata,
    name: newName,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  return clone
}
