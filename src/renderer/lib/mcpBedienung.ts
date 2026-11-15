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
  'cue_next',
  'cue_prev',
] as const
export type UiBefehl = (typeof UI_BEFEHLE)[number]

// #1195 — Ablaufplan (#1182) als Cue-Liste: `cue_next`/`cue_prev` gehen
// durch die Abschnitte und zeigen die verknuepften Geraete und Wege in der
// Signalweg-Ansicht (reine Ansicht, Esc beendet sie). Der Zeiger lebt nur in
// diesem Fenster: welcher Abschnitt gerade laeuft, ist Bedienung, kein Plan.
let cueIndex = -1

const zeigeCue = (schritt: 1 | -1) => {
  const { rundown, cables } = useProjectStore.getState().project
  const segmente = rundown?.segments ?? []
  if (!segmente.length) return
  cueIndex = Math.min(segmente.length - 1, Math.max(0, cueIndex + schritt))
  const seg = segmente[cueIndex]
  const link = rundown?.links?.find((l) => l.segmentId === seg.id)
  const kabelIds = link?.cableIds ?? []
  const geraete = new Set(link?.equipmentIds ?? [])
  for (const c of cables) {
    if (kabelIds.includes(c.id)) geraete.add(c.fromEquipmentId).add(c.toEquipmentId)
  }
  useUiStore.getState().setSignalweg({ cableId: `cue:${seg.id}`, kabelIds, geraetIds: [...geraete] })
}

const aktuellerCue = () => {
  const segmente = useProjectStore.getState().project.rundown?.segments ?? []
  if (cueIndex >= segmente.length) cueIndex = segmente.length - 1
  const seg = cueIndex >= 0 ? segmente[cueIndex] : undefined
  return {
    cue: seg ? [seg.number, seg.title].filter(Boolean).join(' ') : '',
    cueIndex: seg ? cueIndex + 1 : 0,
    cueCount: segmente.length,
  }
}

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
    cue_next: () => zeigeCue(1),
    cue_prev: () => zeigeCue(-1),
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
    ...aktuellerCue(),
  }
  const text = `${action}: ${errorCount} errors, ${warningCount} warnings${daten.cue ? `, cue ${daten.cueIndex}/${daten.cueCount} ${daten.cue}` : ''}`
  return { daten, text }
}
