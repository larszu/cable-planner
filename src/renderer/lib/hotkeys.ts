/**
 * Issue #69: Hotkey dispatcher.
 *
 * The user-customizable hotkey map lives in uiStore.hotkeys. Each entry
 * is `actionName → key-combo` (e.g. "undo" → "Ctrl+Z"). This module:
 *   1. Provides `comboFromEvent` so the settings UI can capture a
 *      keystroke and store it as a string.
 *   2. Provides `useHotkeys()` — a hook that registers a global
 *      keydown listener and dispatches a callback when a matching
 *      combo is pressed.
 *
 * Combos use the syntax: modifier+modifier+key, modifiers in fixed
 * order: Ctrl, Shift, Alt, Meta. The "key" half is the value of
 * `event.key` (case-insensitive for printables; special keys keep
 * their canonical name — "ArrowUp", "Delete", "Escape", "F1"…).
 */

import { useEffect } from 'react'

export interface HotkeyHandlers {
  [action: string]: () => void
}

/** Build a canonical combo string from a KeyboardEvent. */
export const comboFromEvent = (event: KeyboardEvent | React.KeyboardEvent): string => {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push(event.metaKey && !event.ctrlKey ? 'Meta' : 'Ctrl')
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')
  const key = event.key
  // Exclude modifier-only keystrokes ("Shift", "Control" etc.) — those
  // make no sense as a "completed" combo.
  if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return ''
  const printable = key.length === 1
  parts.push(printable ? key.toUpperCase() : key)
  return parts.join('+')
}

/** True when the user is currently typing in a text input — in which case
 *  global hotkeys should NOT fire (so the user can still type Ctrl+A etc.
 *  in form fields). */
const isEditable = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

/**
 * React hook that wires a `map of action → combo` to a `map of action →
 * callback`. Pass both; the hook attaches a single window listener and
 * fires the matching callback when the key combo is detected. Edits in
 * text fields are skipped.
 */
export const useHotkeys = (
  map: Record<string, string>,
  handlers: HotkeyHandlers,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) return
    const handler = (event: KeyboardEvent) => {
      if (isEditable(event.target)) return
      const combo = comboFromEvent(event)
      if (!combo) return
      // First exact match wins. Build a reverse lookup once per call.
      for (const action of Object.keys(map)) {
        if (map[action] === combo && handlers[action]) {
          event.preventDefault()
          handlers[action]!()
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [map, handlers, enabled])
}

export const HOTKEY_ACTION_LABEL: Record<string, string> = {
  undo: 'Rückgängig',
  redo: 'Wiederherstellen',
  save: 'Projekt speichern',
  saveAs: 'Projekt speichern unter…',
  newProject: 'Neues Projekt',
  openProject: 'Projekt öffnen',
  deleteSelected: 'Auswahl löschen',
  clearSelection: 'Auswahl aufheben',
  toggleLibrary: 'Library ein-/ausblenden',
  toggleProperties: 'Eigenschaften ein-/ausblenden',
  showLegend: 'Längen-Legende anzeigen',
  jumpToPatches: 'Zu Patches springen',
  toggleArrows: 'Pfeil-Anzeige umschalten',
  toggleRouting: 'Routing umschalten',
}
