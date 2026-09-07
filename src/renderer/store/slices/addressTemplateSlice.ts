import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'
import { normaliseAddressRange } from '../../lib/addressTemplate'
import { isPrimaryInterface } from '../../lib/networkInterfaces'
import type { AddressLayer, AddressRange } from '../../types/addressTemplate'

/**
 * BEDARF 20 — die Adressbereichs-Ebenen im Store.
 *
 * DREI DINGE MACHT DIESER SLICE ANDERS ALS DIE ANDEREN:
 *
 * 1. **Jeder Bereich geht durch dieselbe Normalisierung wie beim Laden.**
 *    `normaliseAddressRange` ist die Engstelle: sie kanonisiert den CIDR auf
 *    seine Netz-Adresse und lehnt ab, was keiner ist. Wuerde der Slice daran
 *    vorbeischreiben, gaebe es zwei Wahrheiten darueber, was ein gueltiger
 *    Bereich ist — und die aus der Oberflaeche waere die laxere. Genau so
 *    entstehen Datensaetze, die erst beim naechsten Laden verschwinden.
 *
 * 2. **`applyReaddress` schreibt genau EINE Schnittstelle.** Es gibt bewusst
 *    kein „alle uebernehmen". Der Bedarf verlangt einen Vorschlag, und ein
 *    Knopf, der zwanzig Adressen auf einmal umschreibt, ist keiner mehr — er
 *    ist eine Vergabe mit Bestaetigungsdialog. Dieselbe Haltung wie bei den
 *    PTZ-Presets (Bedarf 96).
 *
 * 3. **Schnittstelle 0 wird an ihrem echten Ort geschrieben.** Die Alt-Felder
 *    am Geraet SIND Schnittstelle 0 (`lib/networkInterfaces.ts`). Wer sie
 *    stattdessen in `networkInterfaces` schriebe, erzeugte eine zweite
 *    Adresse desselben Geraets — und der Adressplan meldete danach eine
 *    Doppel-IP, die es nur im Werkzeug gibt.
 */
export type AddressTemplateSlice = Pick<
  ProjectState,
  | 'addAddressLayer'
  | 'updateAddressLayer'
  | 'removeAddressLayer'
  | 'addAddressRange'
  | 'updateAddressRange'
  | 'removeAddressRange'
  | 'applyReaddress'
>

export const createAddressTemplateSlice: StateCreator<
  ProjectState,
  [],
  [],
  AddressTemplateSlice
> = (set) => ({
  addAddressLayer: (layer) => {
    const name = layer.name?.trim()
    if (!name) return undefined
    const id = layer.id?.trim() || uuidv4()
    let created = false
    set((state) => {
      const existing = state.project.addressLayers ?? []
      if (existing.some((l) => l.id === id)) {
        created = true
        return {}
      }
      const next: AddressLayer = {
        id,
        name,
        kind: layer.kind ?? 'standing',
        ranges: (layer.ranges ?? [])
          .map((r) => normaliseAddressRange(r))
          .filter((r): r is AddressRange => !!r),
      }
      const updated = { ...state.project, addressLayers: [...existing, next] }
      scheduleProjectAutosave(updated)
      created = true
      return { project: updated }
    })
    return created ? id : undefined
  },

  updateAddressLayer: (id, patch) =>
    set((state) => {
      const existing = state.project.addressLayers ?? []
      if (!existing.some((l) => l.id === id)) return {}
      const updated = {
        ...state.project,
        addressLayers: existing.map((l) => {
          if (l.id !== id) return l
          const merged: AddressLayer = { ...l, ...patch, id: l.id, ranges: l.ranges }
          // Ein leerer Name macht die Ebene auf jedem Blatt namenlos. Die
          // vorhandene Bezeichnung zu behalten ist ehrlicher als sie
          // wegzuwerfen, weil jemand das Feld geleert hat.
          if (typeof merged.name === 'string' && merged.name.trim() === '') merged.name = l.name
          return merged
        }),
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  removeAddressLayer: (id) =>
    set((state) => {
      const existing = state.project.addressLayers ?? []
      if (!existing.some((l) => l.id === id)) return {}
      const updated = { ...state.project, addressLayers: existing.filter((l) => l.id !== id) }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  addAddressRange: (layerId, range) => {
    const id = range.id?.trim() || uuidv4()
    // Vor dem Zustandswechsel pruefen: `set` darf nicht zur Halbzeit
    // entscheiden, ob es etwas angelegt hat.
    const kandidat = normaliseAddressRange({ ...range, id })
    if (!kandidat) return undefined
    let created = false
    set((state) => {
      const existing = state.project.addressLayers ?? []
      const ebene = existing.find((l) => l.id === layerId)
      if (!ebene) return {}
      if (ebene.ranges.some((r) => r.id === id)) {
        created = true
        return {}
      }
      const updated = {
        ...state.project,
        addressLayers: existing.map((l) =>
          l.id === layerId ? { ...l, ranges: [...l.ranges, kandidat] } : l,
        ),
      }
      scheduleProjectAutosave(updated)
      created = true
      return { project: updated }
    })
    return created ? id : undefined
  },

  updateAddressRange: (layerId, rangeId, patch) =>
    set((state) => {
      const existing = state.project.addressLayers ?? []
      const ebene = existing.find((l) => l.id === layerId)
      const vorher = ebene?.ranges.find((r) => r.id === rangeId)
      if (!ebene || !vorher) return {}
      // Durch dieselbe Engstelle wie beim Laden. Bleibt dabei nichts uebrig
      // — etwa weil jemand den CIDR auf Unsinn gesetzt hat — bleibt der alte
      // Bereich stehen, statt still zu verschwinden.
      const nachher = normaliseAddressRange({ ...vorher, ...patch, id: rangeId })
      if (!nachher) return {}
      const updated = {
        ...state.project,
        addressLayers: existing.map((l) =>
          l.id !== layerId
            ? l
            : { ...l, ranges: l.ranges.map((r) => (r.id === rangeId ? nachher : r)) },
        ),
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  removeAddressRange: (layerId, rangeId) =>
    set((state) => {
      const existing = state.project.addressLayers ?? []
      const ebene = existing.find((l) => l.id === layerId)
      if (!ebene || !ebene.ranges.some((r) => r.id === rangeId)) return {}
      const updated = {
        ...state.project,
        addressLayers: existing.map((l) =>
          l.id === layerId ? { ...l, ranges: l.ranges.filter((r) => r.id !== rangeId) } : l,
        ),
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  applyReaddress: (equipmentId, nicId, ip, mask) => {
    let applied = false
    set((state) => {
      const item = state.project.equipment.find((e) => e.id === equipmentId)
      if (!item) return {}
      const primaer = isPrimaryInterface(item, nicId)
      if (!primaer && !(item.networkInterfaces ?? []).some((n) => n.id === nicId)) return {}
      const equipment = state.project.equipment.map((e) => {
        if (e.id !== equipmentId) return e
        if (primaer) return { ...e, ipAddress: ip, subnetMask: mask }
        return {
          ...e,
          networkInterfaces: (e.networkInterfaces ?? []).map((n) =>
            n.id === nicId ? { ...n, ipAddress: ip, subnetMask: mask } : n,
          ),
        }
      })
      const updated = { ...state.project, equipment }
      scheduleProjectAutosave(updated)
      applied = true
      return { project: updated }
    })
    return applied
  },
})
