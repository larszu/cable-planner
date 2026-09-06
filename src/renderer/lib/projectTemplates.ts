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
import { stripForTemplate, projectVenue, type TemplateScope } from './templateScope'
import { assessJobHandover, latestAsBuilt, type JobBasis } from './jobHandover'

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
  /**
   * Bedarf 91 — das Haus, aus dem diese Vorlage stammt.
   *
   * Nur bei `scope: 'venue'` gesetzt. Es steht HIER und nicht nur in
   * `project.metadata.siteAddress`, weil es beim Verwenden gebraucht wird,
   * BEVOR das Projekt geladen ist: die Karte in der Galerie muss sagen
   * können, aus welchem Haus die Antworten kommen.
   */
  venue?: string
  /**
   * BEDARF 84 — woraus diese Vorlage gemacht wurde: aus dem Bauzustand oder
   * aus dem Plan von vorher.
   *
   * **Beim Schreiben eingefroren**, wie `VenueAnswer.venue` (Bedarf 85). Das
   * Quell-Projekt zieht weiter; die Vorlage nicht. Sie später aus dem
   * mitkopierten Stand zu berechnen ergäbe eine Auskunft über einen Plan, den
   * niemand mehr aufmacht.
   *
   * Der Bedarf sagt es wörtlich: „next year the same event is re-planned from
   * the QUOTE, not from what was actually built". Wenn das passiert, soll es
   * wenigstens draufstehen.
   */
  basis?: JobBasis
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
  /**
   * BEDARF 91 — ein Pflicht-Parameter OHNE Default, und das mit Absicht.
   *
   * Dieselbe Bauform wie `credentials` bei `syncSharedLibrary` (Design-Frage
   * 5): der alte Zustand war „geht stillschweigend mit", und ein Default
   * hätte genau den wiederhergestellt, sobald ein Aufrufer ihn weglässt. Wer
   * eine Vorlage schreibt, muss beantwortet haben, ob sie an ein Haus
   * gebunden ist.
   */
  scope: TemplateScope,
): ProjectTemplate => {
  // Bedarf 91 — erst das Ortsgebundene, dann die Auftrags-Identität. Zwei
  // Schritte, weil die Fragen verschieden sind: das eine hängt am HAUS, das
  // andere am KUNDEN, und eine Vorlage für dasselbe Haus behält das eine und
  // nie das andere.
  const clone: CablePlannerProject = stripForTemplate(cloneProject(project), scope)
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

  const venue = scope === 'venue' ? projectVenue(project) : undefined
  // Bedarf 84 — aus dem QUELL-Projekt gelesen, nicht aus der Kopie: `clone`
  // hat die Revisionen bereits verloren (sie sind die Geschichte einer
  // anderen Show), und ohne sie waere jede Vorlage „wie geplant".
  const basis = assessJobHandover(project).basis
  const tpl: ProjectTemplate = {
    id: `user-${uuidv4()}`,
    name,
    description,
    builtin: false,
    ...(venue ? { venue } : {}),
    basis,
    project: clone,
  }
  const next = [...loadUserTemplates(), tpl]
  persist(next)
  return tpl
}

/**
 * BEDARF 75 — „promote as-built to template".
 *
 *   > Trucks historically 'would need to be completely reconfigured to meet
 *   > the requirements of the new job' when moving between event types. Switch
 *   > configs are typically not saved back after load-out, so the next show
 *   > starts from the plan rather than from the as-built.
 *
 * Der Bedarf nennt den Weg selbst: „a 'promote as-built to template' action
 * after load-out so the reconciliation import feeds back into the next show's
 * starting point."
 *
 * WARUM DAS NICHT DASSELBE IST WIE `saveUserTemplate`. Der schreibt den
 * Plan, wie er GERADE ist. Nach dem Abbau ist das der Stand nach dem letzten
 * Klick — und der kann alles Moegliche sein: halb aufgeraeumt, mit
 * Testgeraeten, mit einer Ruecknahme, die nur im Kopf stattgefunden hat. Was
 * die naechste Show braucht, ist der Stand, den jemand ausdruecklich als
 * gebaut festgeschrieben hat.
 *
 * DIE ABLEHNUNG IST DER PUNKT. Ohne As-Built gibt es nichts zu befoerdern,
 * und auf den Live-Plan auszuweichen waere der Fehler, gegen den Bedarf 84
 * geschrieben ist: eine Vorlage mit dem Wort „wie gebaut" darauf, die den
 * Angebotsstand traegt. `promoteAsBuiltToTemplate` gibt dann `null` und einen
 * Grund zurueck; die Oberflaeche sagt ihn, statt still etwas anderes zu tun.
 */
export type PromoteRefusal = 'no-as-built'

export interface PromoteResult {
  template?: ProjectTemplate
  /** Gesetzt, wenn nichts befoerdert wurde — mit dem Grund. */
  refused?: PromoteRefusal
  /** Das Etikett der befoerderten Revision, fuer die Rueckmeldung. */
  from?: string
}

export const promoteAsBuiltToTemplate = (
  name: string,
  description: string,
  project: CablePlannerProject,
  scope: TemplateScope,
): PromoteResult => {
  const asBuilt = latestAsBuilt(project)
  if (!asBuilt) return { refused: 'no-as-built' }
  // Der Schnappschuss ist ein Projekt OHNE `revisions` (per Typ). Genau das
  // ist hier richtig: die Geschichte der alten Show gehoert nicht in die
  // Vorlage, und `stripForTemplate` wuerde sie ohnehin entfernen.
  const stand = { ...asBuilt.snapshot, revisions: [] } as CablePlannerProject
  const tpl = saveUserTemplate(name, description, stand, scope)
  // `saveUserTemplate` liest die Grundlage aus dem uebergebenen Projekt, und
  // das ist hier der Schnappschuss OHNE Revisionen — also „wie geplant".
  // Das waere die falsche Auskunft: der Inhalt IST der Bauzustand. Die
  // Vorlage wird deshalb nachtraeglich richtiggestellt und neu abgelegt.
  const korrigiert: ProjectTemplate = { ...tpl, basis: 'as-built' }
  persist(loadUserTemplates().map((t) => (t.id === tpl.id ? korrigiert : t)))
  return { template: korrigiert, from: asBuilt.label }
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
