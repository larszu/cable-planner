// ───────────────────────────────────────────────────────────────────────────
// #1183 — die Oberflaeche ueber die lokale MCP-Schnittstelle bedienen
// (Stream Deck ueber Companion: linke Hand auf Tasten, rechte an der Maus).
//
// Wenige Befehle, die es als Tastenkuerzel ohnehin gibt — kein zweiter Weg
// in den Plan. `status` liefert, was eine Taste als Rueckmeldung zeigt.
// Steht hinter dem Schreib-Schalter, weil Rueckgaengig/Duplizieren den Plan
// aendern.
// ───────────────────────────────────────────────────────────────────────────
import { projectHistory } from '../store/projectHistory'
import { useProjectStore } from '../store/projectStore'
import { useUiStore } from '../store/uiStore'
import { runDrawingChecks } from './drawingChecks'
import {
  triggerCanvasDuplicate,
  triggerCanvasFitView,
  triggerCanvasSelectAll,
  triggerCanvasZoomIn,
  triggerCanvasZoomOut,
} from './canvasViewport'

export const UI_BEFEHLE = [
  'status',
  'undo',
  'redo',
  'zoom_in',
  'zoom_out',
  'fit_view',
  'select_all',
  'duplicate',
  'toggle_plan_check',
] as const
export type UiBefehl = (typeof UI_BEFEHLE)[number]

export const uiBefehl = (args: Record<string, unknown>): { daten: Record<string, unknown>; text: string } => {
  const action = args.action as UiBefehl
  if (!(UI_BEFEHLE as readonly string[]).includes(action)) {
    // Antwort an den MCP-Client (Companion), kein Oberflaechen-Text.
    const text = `Unknown action "${String(action)}".`
    return { daten: { ok: false, known: UI_BEFEHLE }, text }
  }
  const tun: Record<Exclude<UiBefehl, 'status'>, () => void> = {
    undo: () => projectHistory.undo(),
    redo: () => projectHistory.redo(),
    zoom_in: triggerCanvasZoomIn,
    zoom_out: triggerCanvasZoomOut,
    fit_view: triggerCanvasFitView,
    select_all: triggerCanvasSelectAll,
    duplicate: triggerCanvasDuplicate,
    toggle_plan_check: () => useUiStore.getState().togglePlanCheck(),
  }
  if (action !== 'status') tun[action]()
  const { equipment, cables } = useProjectStore.getState().project
  const { errorCount, warningCount } = runDrawingChecks({ equipment, cables })
  const daten = {
    ok: true,
    action,
    errors: errorCount,
    warnings: warningCount,
    planCheckOpen: useUiStore.getState().planCheck.open,
  }
  const text = `${action}: ${errorCount} errors, ${warningCount} warnings`
  return { daten, text }
}
