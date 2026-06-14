// #413 — Echtzeit-Kollaboration: CRDT-Datenschicht.
//
// Ein Yjs-`Y.Doc`, das den Plan als CRDT spiegelt. Zwei Instanzen, die ihre
// Updates austauschen, konvergieren garantiert auf denselben Stand — ohne
// zentralen Server, auch bei gleichzeitigen Edits.
//
// Stufe 1 (erledigt): nur `cables`. Stufe 2 (hier): das ganze Projekt —
// `equipment`, `cables`, `locations` als je eigene `Y.Map` (Key = id).
// Objekte werden als Ganzes gehalten (Konflikt-Granularität „pro Element"),
// was für die Praxis (zwei Planer bearbeiten verschiedene Geräte/Kabel)
// ausreicht; feld-granulares CRDT pro Element ist eine spätere Optimierung.
//
// Transport (LoopbackTransport für Tests, später y-webrtc/y-websocket) und
// die Live-Bindung an den Store liegen in syncTransport.ts / syncManager.ts.
// Pfad: docs/architecture.md §9.4.

import * as Y from 'yjs'
import type { Cable } from '../../types/cable'
import type { EquipmentItem } from '../../types/equipment'
import type { LocationFrame } from '../../types/location'

const EQUIPMENT_MAP = 'equipment'
const CABLES_MAP = 'cables'
const LOCATIONS_MAP = 'locations'

/** Minimaler Plan-Ausschnitt, den der CRDT spiegelt. */
export interface CrdtProjectSlice {
  equipment: EquipmentItem[]
  cables: Cable[]
  locations: LocationFrame[]
}

/**
 * Wrappt ein `Y.Doc` und bietet eine plan-spezifische API. Equipment, Kabel
 * und Locations liegen je als `Y.Map<…>` (Key = element.id).
 */
export class ProjectCrdt {
  readonly doc: Y.Doc
  private readonly equipment: Y.Map<EquipmentItem>
  private readonly cables: Y.Map<Cable>
  private readonly locations: Y.Map<LocationFrame>
  /** #413 — Undo-Manager über die drei Collections. Lazy erzeugt (erst beim
   *  ersten getUndoManager-Aufruf), damit er NUR Edits ab Session-Start
   *  erfasst und nicht den Initial-Seed. */
  private undoManager: Y.UndoManager | null = null

  constructor(doc: Y.Doc = new Y.Doc()) {
    this.doc = doc
    this.equipment = doc.getMap<EquipmentItem>(EQUIPMENT_MAP)
    this.cables = doc.getMap<Cable>(CABLES_MAP)
    this.locations = doc.getMap<LocationFrame>(LOCATIONS_MAP)
  }

  // ── Undo/Redo (Stufe: #413-Akzeptanzkriterium) ───────────────────────

  /** Liefert (und erzeugt bei Bedarf) einen Y.UndoManager, der NUR die
   *  lokalen Edits dieses Peers erfasst — `trackedOrigins` ist auf
   *  LOCAL_ORIGIN beschränkt, also die Origin, mit der die Store-Bindung
   *  via `transactLocal` schreibt. Dadurch nimmt Undo ausschließlich die
   *  EIGENEN Änderungen zurück und lässt die Edits anderer Teilnehmer
   *  unangetastet — genau das Verhalten, das kollaboratives Undo braucht. */
  getUndoManager(): Y.UndoManager {
    if (!this.undoManager) {
      this.undoManager = new Y.UndoManager(
        [this.equipment, this.cables, this.locations],
        { trackedOrigins: new Set([LOCAL_ORIGIN]) },
      )
    }
    return this.undoManager
  }

  undo(): void {
    this.getUndoManager().undo()
  }
  redo(): void {
    this.getUndoManager().redo()
  }
  canUndo(): boolean {
    return this.getUndoManager().undoStack.length > 0
  }
  canRedo(): boolean {
    return this.getUndoManager().redoStack.length > 0
  }

  // ── Voll-Projekt-Sync ────────────────────────────────────────────────

  /** Spiegelt einen Plan-Ausschnitt in das Y.Doc (Initial-Load / Resync).
   *  Entfernte Elemente werden gelöscht, neue/geänderte gesetzt — alles in
   *  EINER Transaction, damit Observer nur ein Update sehen. */
  loadFromProject(slice: CrdtProjectSlice): void {
    this.doc.transact(() => {
      syncMap(this.equipment, slice.equipment)
      syncMap(this.cables, slice.cables)
      syncMap(this.locations, slice.locations)
    })
  }

  /** Aktueller Plan-Stand aus dem Y.Doc. */
  toProject(): CrdtProjectSlice {
    return {
      equipment: [...this.equipment.values()],
      cables: [...this.cables.values()],
      locations: [...this.locations.values()],
    }
  }

  // ── Einzel-Mutationen ────────────────────────────────────────────────

  upsertEquipment(item: EquipmentItem): void {
    this.equipment.set(item.id, item)
  }
  removeEquipment(id: string): void {
    this.equipment.delete(id)
  }
  upsertCable(cable: Cable): void {
    this.cables.set(cable.id, cable)
  }
  removeCable(id: string): void {
    this.cables.delete(id)
  }
  upsertLocation(loc: LocationFrame): void {
    this.locations.set(loc.id, loc)
  }
  removeLocation(id: string): void {
    this.locations.delete(id)
  }

  /** Aktueller Kabel-Stand (Stufe-1-Kompatibilität). */
  toCables(): Cable[] {
    return [...this.cables.values()]
  }

  /** Spiegelt nur die Kabel (Stufe-1-Kompatibilität). */
  loadFromCables(list: Cable[]): void {
    this.doc.transact(() => syncMap(this.cables, list))
  }

  // ── Transport-Primitive ──────────────────────────────────────────────

  /** Gesamter Doc-State als binäres Update (für Transport/Persistenz). */
  encodeState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc)
  }

  /** State-Vector für inkrementelle Diffs. */
  encodeStateVector(): Uint8Array {
    return Y.encodeStateVector(this.doc)
  }

  /** Diff relativ zum State-Vector eines Peers — minimaler Sync. */
  encodeDiff(remoteStateVector: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc, remoteStateVector)
  }

  /** Wendet ein eingehendes Update an. CRDT-Merge ist kommutativ +
   *  idempotent — Reihenfolge und Doppel-Empfang sind egal. */
  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update)
  }

  /** Wendet ein Remote-Update mit Origin-Markierung an, damit `onUpdate`-
   *  Listener es als nicht-lokal erkennen (keine Echo-Schleife). */
  applyRemoteUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update, REMOTE_ORIGIN)
  }

  /** Listener für lokale UND remote Updates. cb bekommt das binäre Update
   *  + ob es lokal entstand. Rückgabe: Unsubscribe-Funktion. */
  onUpdate(cb: (update: Uint8Array, isLocal: boolean) => void): () => void {
    const handler = (update: Uint8Array, origin: unknown) => {
      cb(update, origin !== REMOTE_ORIGIN)
    }
    this.doc.on('update', handler)
    return () => this.doc.off('update', handler)
  }

  // ── Store-Binding (Stufe 3) ──────────────────────────────────────────

  /** Führt `fn` in einer Transaction mit `LOCAL_ORIGIN` aus. Die Binding-
   *  Schicht nutzt das für Store→Doc-Writes, damit ihr eigener `observe`-
   *  Listener diese Änderungen als „selbst verursacht" erkennt und NICHT
   *  zurück in den Store schreibt (kein Loop). */
  transactLocal(fn: () => void): void {
    this.doc.transact(fn, LOCAL_ORIGIN)
  }

  /** Beobachtet angewandte Doc-Änderungen samt Origin. Anders als
   *  `onUpdate` (das auf den Transport zielt) bekommt der Callback den
   *  rohen Origin — die Binding-Schicht filtert damit ihre eigenen
   *  `LOCAL_ORIGIN`-Writes heraus und zieht nur fremde Änderungen
   *  (Transport/Provider) in den Store. Rückgabe: Unsubscribe. */
  observe(cb: (origin: unknown) => void): () => void {
    const handler = (_update: Uint8Array, origin: unknown) => cb(origin)
    this.doc.on('update', handler)
    return () => this.doc.off('update', handler)
  }

  destroy(): void {
    this.undoManager?.destroy()
    this.undoManager = null
    this.doc.destroy()
  }
}

/** Origin-Marker für angewandte Remote-Updates (Echo-Schutz im Transport). */
export const REMOTE_ORIGIN = 'remote'

/** Origin-Marker für Store→Doc-Writes der Binding-Schicht. Erlaubt dem
 *  Binding-`observe`, die eigenen Writes von echten Remote-Änderungen
 *  (Transport oder y-webrtc-Provider) zu unterscheiden. */
export const LOCAL_ORIGIN = 'local'

/** Setzt eine Y.Map auf den Stand einer id-Liste: fehlende löschen, Rest
 *  setzen. Erwartet, in einer Transaction aufgerufen zu werden. */
const syncMap = <T extends { id: string }>(map: Y.Map<T>, list: T[]): void => {
  const incoming = new Set(list.map((x) => x.id))
  for (const id of [...map.keys()]) {
    if (!incoming.has(id)) map.delete(id)
  }
  for (const x of list) map.set(x.id, x)
}

/**
 * Konvenienz: führt das Update von `source` in `target` zusammen. Nur für
 * Tests/Proofs — Produktion nutzt den Transport.
 */
export const mergeUpdateInto = (source: ProjectCrdt, target: ProjectCrdt): void => {
  target.applyUpdate(source.encodeState())
}
