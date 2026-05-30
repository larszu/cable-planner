// #413 — Stufe 3: Live-Bindung Zustand-Store ⇄ ProjectCrdt.
//
// Koppelt den Projekt-Store bidirektional an ein Y.Doc (ProjectCrdt), ohne
// Update-Loops:
//
//   Store → Doc:  Der Store nutzt strukturelles Sharing (jede Mutation
//     erzeugt frische Referenzen NUR für geänderte Teile). Wir vergleichen
//     daher referenz-basiert gegen den letzten Stand und schreiben nur die
//     tatsächlich geänderten/entfernten Elemente ins Doc — in EINER
//     `transactLocal`-Transaction (Origin = LOCAL_ORIGIN).
//
//   Doc → Store:  `observe` liefert den Origin jeder Doc-Änderung. Eigene
//     `LOCAL_ORIGIN`-Writes ignorieren wir (die kamen ja aus dem Store).
//     Fremde Änderungen (Transport/Provider) ziehen wir per
//     `applyRemoteProject` in den Store.
//
// Echo-Schutz: Vor dem Anwenden eines Remote-Stands setzen wir `last` auf
// exakt die Referenzen, die auch in den Store geschrieben werden. Wenn die
// Store-Subscription daraufhin feuert, findet der Referenz-Diff keine
// Änderung → es wird nichts zurück ins Doc geschrieben.

import type { ProjectCrdt } from './projectCrdt'
import { LOCAL_ORIGIN } from './projectCrdt'
import { useProjectStore } from '../../store/projectStore'
import type { Cable } from '../../types/cable'
import type { EquipmentItem } from '../../types/equipment'
import type { LocationFrame } from '../../types/location'

/** Minimaler Store-Vertrag, den die Bindung braucht (erleichtert Tests). */
interface BindableStore {
  getState: () => {
    project: {
      equipment: EquipmentItem[]
      cables: Cable[]
      locations?: LocationFrame[]
    }
    applyRemoteProject: (slice: Slice) => void
  }
  subscribe: (listener: (state: unknown, prev: unknown) => void) => () => void
}

interface Slice {
  equipment: EquipmentItem[]
  cables: Cable[]
  locations: LocationFrame[]
}

export interface StoreBindingOptions {
  /** Beim Start den aktuellen Store-Stand ins (leere) Doc schreiben.
   *  Default true. Auf false setzen, wenn das Doc bereits einen autoritativen
   *  Remote-Stand trägt, den der lokale Store übernehmen soll. */
  seedDoc?: boolean
  /** Store-Override (Tests). Default: globaler useProjectStore. */
  store?: BindableStore
}

export interface StoreBindingHandle {
  /** Trennt beide Richtungen (Listener ab). Doc + Store bleiben bestehen. */
  stop: () => void
}

const EMPTY_LOCATIONS: LocationFrame[] = []

/** Referenzen der zuletzt synchronisierten Collections (für den Diff). */
interface Snapshot {
  equipment: EquipmentItem[]
  cables: Cable[]
  locations: LocationFrame[]
}

/** Schreibt die Differenz zweier id-Listen ins Doc: geänderte/neue per
 *  upsert, entfernte per remove. „Geändert" = andere Objekt-Referenz
 *  (dank strukturellem Sharing reicht der Referenzvergleich). */
const diffInto = <T extends { id: string }>(
  prev: T[],
  next: T[],
  upsert: (item: T) => void,
  remove: (id: string) => void,
): void => {
  if (prev === next) return
  const prevById = new Map(prev.map((x) => [x.id, x]))
  const nextIds = new Set<string>()
  for (const item of next) {
    nextIds.add(item.id)
    if (prevById.get(item.id) !== item) upsert(item)
  }
  for (const item of prev) {
    if (!nextIds.has(item.id)) remove(item.id)
  }
}

/**
 * Verbindet `crdt` mit dem Projekt-Store. Liefert ein Handle zum Trennen.
 */
export const bindStoreToCrdt = (
  crdt: ProjectCrdt,
  opts: StoreBindingOptions = {},
): StoreBindingHandle => {
  const store = opts.store ?? (useProjectStore as unknown as BindableStore)

  const readSlice = (): Snapshot => {
    const p = store.getState().project
    return {
      equipment: p.equipment,
      cables: p.cables,
      locations: p.locations ?? EMPTY_LOCATIONS,
    }
  }

  let last: Snapshot = readSlice()

  // ── Store → Doc ────────────────────────────────────────────────────
  const pushToDoc = (next: Snapshot): void => {
    crdt.transactLocal(() => {
      diffInto(last.equipment, next.equipment, (i) => crdt.upsertEquipment(i), (id) => crdt.removeEquipment(id))
      diffInto(last.cables, next.cables, (i) => crdt.upsertCable(i), (id) => crdt.removeCable(id))
      diffInto(last.locations, next.locations, (i) => crdt.upsertLocation(i), (id) => crdt.removeLocation(id))
    })
    last = next
  }

  // Initial-Seed: lokalen Stand ins Doc (Doc gilt als leer/neu).
  if (opts.seedDoc !== false) {
    crdt.transactLocal(() => {
      for (const e of last.equipment) crdt.upsertEquipment(e)
      for (const c of last.cables) crdt.upsertCable(c)
      for (const l of last.locations) crdt.upsertLocation(l)
    })
  }

  const unsubStore = store.subscribe(() => {
    const next = readSlice()
    // Nichts geändert (gleiche Referenzen) → kein Doc-Write. Das ist auch
    // der Fall direkt nach einem Remote-Apply (last wurde vorab gesetzt).
    if (
      next.equipment === last.equipment &&
      next.cables === last.cables &&
      next.locations === last.locations
    ) {
      return
    }
    pushToDoc(next)
  })

  // ── Doc → Store ────────────────────────────────────────────────────
  const unsubDoc = crdt.observe((origin) => {
    if (origin === LOCAL_ORIGIN) return // eigener Store→Doc-Write, ignorieren
    const slice = crdt.toProject()
    // last VOR dem Store-Write auf exakt diese Referenzen setzen, damit die
    // Store-Subscription den Diff als „leer" sieht (kein Rück-Write).
    last = {
      equipment: slice.equipment,
      cables: slice.cables,
      locations: slice.locations,
    }
    store.getState().applyRemoteProject(slice)
  })

  return {
    stop: () => {
      unsubStore()
      unsubDoc()
    },
  }
}
