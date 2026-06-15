import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Node, Edge } from 'reactflow'
import { useTranslation } from '../../lib/i18n'
import { promptDialog } from '../../lib/promptDialog'
import { projectHistory } from '../../store/projectHistory'
import { EQUIPMENT_LAYOUT } from '../../lib/layoutConstants'
import type { ProjectState } from '../../store/projectStore'
import type { EquipmentItem } from '../../types/equipment'
import type { Cable } from '../../types/cable'

/**
 * #468 — Canvas-Tastatur-Shortcuts aus CanvasArea (CanvasContent) als Hook
 * ausgelagert. Eine abgegrenzte Concern: Event-Lifecycle (window keydown) +
 * Key→Aktion-Mapping. Die konkreten Fähigkeiten (Copy/Paste/Delete/Nudge/…)
 * werden injiziert — der Hook bleibt der einzige Ort für „welche Taste tut
 * was". Verhaltensneutral: identischer Handler-Body, nur verschoben
 * (Characterization-Test golden==after: Nudge/Duplicate/Delete identisch).
 *
 * Shortcuts: Esc (Pending-Cable abbrechen) · Ctrl/Cmd+C/V/D (Copy/Paste/
 * Duplicate) · Ctrl/Cmd +/= (Gerät an Mausposition anlegen) · Pfeiltasten
 * (selektierte Geräte nudgen, Shift = 4 Zellen) · Delete/Backspace (löschen).
 */
export interface CanvasKeyboardShortcutsDeps {
  pendingCable: unknown
  clearPendingCable: () => void
  copySelectionToClipboard: () => boolean
  pasteFromClipboard: () => void
  duplicateSelection: () => void
  deleteSelected: ProjectState['deleteSelected']
  getSelectedEquipmentIds: () => string[]
  clipboardRef: MutableRefObject<{ items: EquipmentItem[]; cables: Cable[] } | null>
  lastMousePosRef: MutableRefObject<{ x: number; y: number } | null>
  screenToFlowPosition: (p: { x: number; y: number }) => { x: number; y: number }
  getNodes: () => Node[]
  getEdges: () => Edge[]
  setRfNodes: Dispatch<SetStateAction<Node[]>>
  addEquipment: ProjectState['addEquipment']
  updateEquipment: ProjectState['updateEquipment']
  deleteEquipment: ProjectState['deleteEquipment']
  deleteCable: ProjectState['deleteCable']
}

export function useCanvasKeyboardShortcuts(deps: CanvasKeyboardShortcutsDeps): void {
  const t = useTranslation()
  const {
    pendingCable, clearPendingCable,
    copySelectionToClipboard, pasteFromClipboard, duplicateSelection, deleteSelected,
    getSelectedEquipmentIds, clipboardRef, lastMousePosRef, screenToFlowPosition,
    getNodes, getEdges, setRfNodes, addEquipment, updateEquipment, deleteEquipment, deleteCable,
  } = deps
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pendingCable) {
        clearPendingCable()
        return
      }
      const target = event.target as HTMLElement | null
      const isTextField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (isTextField) return
      const ctrl = event.ctrlKey || event.metaKey
      if (ctrl && !event.shiftKey && !event.altKey) {
        const key = event.key.toLowerCase()
        if (key === 'c') {
          if (copySelectionToClipboard()) event.preventDefault()
          return
        }
        if (key === 'v') {
          if (clipboardRef.current) {
            event.preventDefault()
            pasteFromClipboard()
          }
          return
        }
        if (key === 'd') {
          event.preventDefault()
          duplicateSelection()
          return
        }
        // Strg+= or Strg++  (issue #44): quick-add device. Opens a name
        // prompt; the new equipment lands at the last known mouse position
        // in flow coordinates, snapped to grid.
        if (event.key === '+' || event.key === '=') {
          event.preventDefault()
          ;(async () => {
            const name = (await promptDialog(
              t('canvas.area.newDevicePromptTitle', 'Neues Gerät'),
              t('canvas.area.newDevicePromptDefault', 'Neues Gerät'),
            ))?.trim()
            if (!name) return
            const pos = lastMousePosRef.current
            const flow = pos
              ? screenToFlowPosition({ x: pos.x, y: pos.y })
              : { x: 200, y: 200 }
            addEquipment({
              name,
              category: 'Sonstiges',
              inputs: [],
              outputs: [],
              x: flow.x,
              y: flow.y,
              width: 240,
              height: 80,
            })
          })()
          return
        }
      }
      // #460 — Tastatur-Pfad zum Verschieben von Geräten: Pfeiltasten
      // nudgen die selektierten Equipment-Nodes um eine Rasterzelle
      // (Shift = 4 Zellen für gröbere Sprünge). rfNodes besitzt die
      // Live-Positionen (der Store-Sync überschreibt sie bewusst nie), also
      // bewegen wir die RF-Nodes UND persistieren in den Store — exakt das
      // Muster aus Drag-End/Align. Nur mit Selektion + ohne Modifier.
      if (
        !ctrl &&
        !event.altKey &&
        (event.key === 'ArrowUp' ||
          event.key === 'ArrowDown' ||
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight')
      ) {
        const ids = getSelectedEquipmentIds()
        if (ids.length === 0) return
        event.preventDefault()
        const grid = EQUIPMENT_LAYOUT.GRID_SIZE
        const step = event.shiftKey ? grid * 4 : grid
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
        const idSet = new Set(ids)
        const moved = getNodes()
          .filter((n) => n.type === 'equipment' && idSet.has(n.id))
          .map((n) => ({ id: n.id, x: n.position.x + dx, y: n.position.y + dy }))
        if (moved.length === 0) return
        const movedById = new Map(moved.map((m) => [m.id, m]))
        setRfNodes((cur) =>
          cur.map((n) => {
            const m = movedById.get(n.id)
            return m ? { ...n, position: { x: m.x, y: m.y } } : n
          }),
        )
        projectHistory.transact(() => {
          for (const m of moved) updateEquipment(m.id, { x: m.x, y: m.y })
        })
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      // v7.9.90 — Multi-Select-Delete für ALLE selektierten Items
      // (vorher: Equipment-Loop ODER Single-Select-Pointer aus dem Store
      // — Multi-selected Cables konnten nicht gemeinsam gelöscht werden).
      // ReactFlow's getEdges() liefert die aktuelle Edge-Liste samt
      // .selected-Flag — daraus die selected-Cable-IDs ableiten.
      const equipmentIds = getSelectedEquipmentIds()
      const cableIds = getEdges().filter((e) => e.selected).map((e) => e.id)
      if (equipmentIds.length + cableIds.length > 1) {
        event.preventDefault()
        // v7.9.92 — Wrap Multi-Delete in einer History-Transaction
        // damit der ganze Vorgang EIN Undo-Schritt ist (statt N).
        projectHistory.transact(() => {
          // Erst Cables löschen damit kein verwaister Cable-Render von
          // einem gerade gelöschten Equipment passiert.
          for (const id of cableIds) deleteCable(id)
          for (const id of equipmentIds) deleteEquipment(id)
        })
        return
      }
      deleteSelected()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    pendingCable, clearPendingCable, copySelectionToClipboard, pasteFromClipboard,
    duplicateSelection, deleteSelected, getSelectedEquipmentIds, clipboardRef,
    lastMousePosRef, screenToFlowPosition, getNodes, getEdges, setRfNodes,
    addEquipment, updateEquipment, deleteEquipment, deleteCable, t,
  ])
}
