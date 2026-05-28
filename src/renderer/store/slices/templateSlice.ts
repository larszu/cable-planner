import type { StateCreator } from 'zustand'
import type { EquipmentItem, EquipmentTemplate } from '../../types/equipment'
import { LIMITS } from '../../lib/layoutConstants'
import { upsertCachedRentmanTemplate } from '../../lib/rentmanTemplateCache'
import { persistCustomLibrary, persistKnownCategories } from '../libraryPersist'
import type { ProjectState } from '../projectStore'

/**
 * #308 — Template-Slice. CRUD-Actions auf state.customLibrary:
 *  - addCustomTemplate / addCustomTemplates (Library-Import + Catalog-Bulk-Add)
 *  - removeCustomTemplate / setCustomTemplateCategory
 *  - updateCustomTemplate (Rename + Category-Patch mit knownCategories-Update)
 *  - markTemplateAsRack (HE-Cap via LIMITS, Rack-Flag setzen)
 *  - saveEquipmentAsTemplate / saveEquipmentAsNewTemplate
 *  - toggleTemplateFavorite / toggleTemplateHidden / setCustomLibrary
 *
 * Alle Mutations gehen durch persistCustomLibrary -> localStorage +
 * syncDevicesToFolder. Bei Rentman-Templates wird parallel der
 * rentmanTemplateCache aktualisiert, sonst stuft der naechste
 * Rentman-Re-Import den Eintrag als "neu" ein.
 *
 * Nicht hier: renameCustomCategory (mutiert auch project.equipment +
 * knownCategories), addKnownCategories, reorderCategories,
 * resyncRentmanLibraryFromCanvas (haengt an healRentmanLibraryFromProject,
 * dem Project-Healing-Helper).
 */
export type TemplateSlice = Pick<
  ProjectState,
  | 'addCustomTemplate'
  | 'addCustomTemplates'
  | 'removeCustomTemplate'
  | 'setCustomTemplateCategory'
  | 'updateCustomTemplate'
  | 'markTemplateAsRack'
  | 'saveEquipmentAsTemplate'
  | 'saveEquipmentAsNewTemplate'
  | 'toggleTemplateFavorite'
  | 'toggleTemplateHidden'
  | 'setCustomLibrary'
>

const templateFromEquipment = (
  item: EquipmentItem,
  override: { name?: string; category?: string; preserveFlags?: EquipmentTemplate } = {},
): EquipmentTemplate => ({
  name: override.name ?? item.name,
  category: (override.category || item.category || 'Sonstiges').trim() || 'Sonstiges',
  inputs: item.inputs,
  outputs: item.outputs,
  width: item.width,
  height: item.height,
  rentmanId: item.rentmanId,
  ipAddress: item.ipAddress,
  subnetMask: item.subnetMask,
  macAddress: item.macAddress,
  username: item.username,
  password: item.password,
  notes: item.notes,
  vlans: item.vlans,
  managementVlanId: item.managementVlanId,
  gateway: item.gateway,
  dnsServers: item.dnsServers,
  mgmtUrl: item.mgmtUrl,
  firmware: item.firmware,
  portVlans: item.portVlans,
  sdiCaps: item.sdiCaps,
  atemMvConfig: item.atemMvConfig,
  ...(override.preserveFlags?.favorite !== undefined ? { favorite: override.preserveFlags.favorite } : {}),
  ...(override.preserveFlags?.hidden !== undefined ? { hidden: override.preserveFlags.hidden } : {}),
})

export const createTemplateSlice: StateCreator<ProjectState, [], [], TemplateSlice> = (set) => ({
  addCustomTemplate: (template) =>
    set((state) => {
      const next = [...state.customLibrary.filter((t) => t.name !== template.name), template]
      persistCustomLibrary(next)
      if (template.rentmanId) upsertCachedRentmanTemplate(template)
      return { customLibrary: next }
    }),
  addCustomTemplates: (templates) =>
    set((state) => {
      const byName = new Map(state.customLibrary.map((t) => [t.name, t]))
      // Only add templates that don't already exist (don't overwrite user edits).
      templates.forEach((t) => {
        if (!byName.has(t.name)) byName.set(t.name, t)
      })
      const next = Array.from(byName.values())
      persistCustomLibrary(next)
      templates.forEach((template) => {
        if (template.rentmanId) upsertCachedRentmanTemplate(template)
      })
      return { customLibrary: next }
    }),
  removeCustomTemplate: (name) =>
    set((state) => {
      const next = state.customLibrary.filter((t) => t.name !== name)
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  setCustomTemplateCategory: (name, category) =>
    set((state) => {
      const cat = category.trim() || 'Sonstiges'
      const next = state.customLibrary.map((t) =>
        t.name === name ? { ...t, category: cat } : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  updateCustomTemplate: (currentName, patch) =>
    set((state) => {
      const newName = patch.name?.trim() || currentName
      const newCat = patch.category?.trim() || undefined
      const next = state.customLibrary.map((t) => {
        if (t.name !== currentName) return t
        return {
          ...t,
          name: newName,
          ...(newCat ? { category: newCat } : {}),
        }
      })
      persistCustomLibrary(next)
      const cats = new Set(state.knownCategories)
      if (newCat) cats.add(newCat)
      const catsSorted = Array.from(cats).sort((a, b) => a.localeCompare(b))
      persistKnownCategories(catsSorted)
      return { customLibrary: next, knownCategories: catsSorted }
    }),
  markTemplateAsRack: (name, rackUnits) =>
    set((state) => {
      const heightHE = Math.max(1, Math.min(LIMITS.MAX_RACK_HEIGHT_HE, Math.round(rackUnits)))
      const next = state.customLibrary.map((t) =>
        t.name === name
          ? { ...t, isRackDevice: true, rackUnits: heightHE }
          : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  saveEquipmentAsTemplate: (equipmentId) =>
    set((state) => {
      const item = state.project.equipment.find((e) => e.id === equipmentId)
      if (!item) return {}
      const existing = state.customLibrary.find((t) => t.name === item.name)
      const template = templateFromEquipment(item, { preserveFlags: existing })
      const next = [
        ...state.customLibrary.filter((t) => t.name !== template.name),
        template,
      ]
      persistCustomLibrary(next)
      if (template.rentmanId) upsertCachedRentmanTemplate(template)
      return { customLibrary: next }
    }),
  saveEquipmentAsNewTemplate: (equipmentId, newName, category) =>
    set((state) => {
      const item = state.project.equipment.find((e) => e.id === equipmentId)
      if (!item) return {}
      const trimmed = newName.trim()
      if (!trimmed) return {}
      // If the target name already exists we treat the whole operation as a
      // no-op so we never accidentally overwrite a different template.
      if (state.customLibrary.some((t) => t.name === trimmed)) return {}
      const template = templateFromEquipment(item, { name: trimmed, category })
      const next = [...state.customLibrary, template]
      persistCustomLibrary(next)
      if (template.rentmanId) upsertCachedRentmanTemplate(template)
      return { customLibrary: next }
    }),
  toggleTemplateFavorite: (name) =>
    set((state) => {
      const next = state.customLibrary.map((t) =>
        t.name === name ? { ...t, favorite: !t.favorite } : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  toggleTemplateHidden: (name) =>
    set((state) => {
      const next = state.customLibrary.map((t) =>
        t.name === name ? { ...t, hidden: !t.hidden } : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  setCustomLibrary: (templates) =>
    set(() => {
      persistCustomLibrary(templates)
      return { customLibrary: templates }
    }),
})
