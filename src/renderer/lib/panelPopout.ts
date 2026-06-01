/**
 * #427 — Panels in echte separate OS-Fenster auslagern.
 *
 * Ein Popout ist ein zweites Browser-/Electron-Fenster (`window.open`) der
 * gleichen App mit `?popout=<panel>`. Es rendert NUR das jeweilige Panel
 * (Library / Eigenschaften / Anmerkungen) und lässt sich auf einen weiteren
 * Monitor ziehen. Projekt- und Auswahl-Zustand werden über einen
 * `BroadcastChannel` bidirektional zwischen allen Fenstern synchronisiert —
 * Bearbeiten im Popout wirkt sofort im Hauptfenster und umgekehrt.
 */
import { useProjectStore } from '../store/projectStore'
import { useUiStore } from '../store/uiStore'

export type PopoutPanel = 'library' | 'properties' | 'annotations' | 'settings'

/** Dockable Panels, die im Hauptfenster verschwinden müssen wenn ausgelagert. */
const DOCKABLE: ReadonlySet<PopoutPanel> = new Set(['library', 'properties', 'annotations'])

/** Sinnvolle Startgröße je Panel (Settings braucht mehr Platz als ein Drawer). */
const POPOUT_SIZE: Record<PopoutPanel, { w: number; h: number }> = {
  library: { w: 440, h: 780 },
  properties: { w: 460, h: 820 },
  annotations: { w: 440, h: 780 },
  settings: { w: 940, h: 760 },
}

const CHANNEL = 'cable-planner:panel-popout'
let channel: BroadcastChannel | null = null
let applying = false

interface Sel {
  e?: string
  c?: string
  l?: string
  t?: string
}

const currentSel = (): Sel => {
  const s = useProjectStore.getState()
  return {
    e: s.selectedEquipmentId,
    c: s.selectedCableId,
    l: s.selectedLocationId,
    t: s.selectedTemplateName,
  }
}
const sameSel = (a: Sel, b: Sel): boolean => a.e === b.e && a.c === b.c && a.l === b.l && a.t === b.t

/** Welches Panel soll dieses Fenster als Popout rendern (oder null = Haupt-App). */
export const popoutPanel = (): PopoutPanel | null => {
  try {
    const p = new URL(window.location.href).searchParams.get('popout')
    return p === 'library' || p === 'properties' || p === 'annotations' || p === 'settings'
      ? p
      : null
  } catch {
    return null
  }
}

export const isPopout = (): boolean => popoutPanel() != null

/** Offene Popout-Fenster pro Panel (verhindert Doppel-Öffnen). */
const openWindows = new Map<PopoutPanel, Window>()

/**
 * Öffnet ein Panel als separates Fenster (auf weitere Monitore ziehbar).
 * Ist das Panel ein gedocktes Seiten-Panel, wird es im Hauptfenster
 * ausgeblendet (sonst doppelt offen) und beim Schließen des OS-Fensters
 * automatisch wieder eingeblendet. Ein erneuter Klick fokussiert das schon
 * offene Fenster statt ein zweites zu öffnen.
 */
export const openPanelPopout = (panel: PopoutPanel): void => {
  try {
    // Bereits offen? → nur fokussieren.
    const existing = openWindows.get(panel)
    if (existing && !existing.closed) {
      existing.focus()
      return
    }

    const url = new URL(window.location.href)
    url.searchParams.set('popout', panel)
    url.hash = ''
    const { w, h } = POPOUT_SIZE[panel]
    const win = window.open(
      url.toString(),
      `cable-planner-${panel}`,
      `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`,
    )
    if (!win) return // Popup blockiert
    openWindows.set(panel, win)

    if (DOCKABLE.has(panel)) {
      // Im Hauptfenster ausblenden.
      const ui = useUiStore.getState()
      ui.setPanelPoppedOut(panel as 'library' | 'properties' | 'annotations', true)
      // Schließen des OS-Fensters erkennen → im Hauptfenster wieder einblenden.
      const timer = window.setInterval(() => {
        if (win.closed) {
          window.clearInterval(timer)
          openWindows.delete(panel)
          useUiStore
            .getState()
            .setPanelPoppedOut(panel as 'library' | 'properties' | 'annotations', false)
        }
      }, 700)
    }
  } catch {
    /* Popup blockiert o. Ä. — ignorieren */
  }
}

/**
 * Startet die Cross-Fenster-Synchronisation. In JEDEM Fenster (Haupt + Popout)
 * aufrufen. Broadcastet lokale Projekt-/Auswahl-Änderungen und wendet
 * eingehende an (ohne Echo-Schleife). Popouts fordern beim Start den
 * aktuellen Stand an.
 */
export const initPanelPopoutSync = (): void => {
  if (channel || typeof BroadcastChannel === 'undefined') return
  channel = new BroadcastChannel(CHANNEL)
  let lastProject = useProjectStore.getState().project
  let lastSel = currentSel()
  // Solange kein anderes Fenster (Popout oder Haupt) mithört, NICHT bei jeder
  // Mutation das ganze Projekt klonen/senden. Ein Popout hat per Definition
  // sofort einen Peer (das Haupt-Fenster); das Haupt-Fenster lernt den Peer,
  // sobald ein Popout sich meldet ('request'/'sync').
  let hasPeer = popoutPanel() != null

  const broadcastNow = (): void => {
    const s = useProjectStore.getState()
    channel?.postMessage({ type: 'sync', project: s.project, sel: currentSel() })
  }

  useProjectStore.subscribe((s) => {
    if (applying || !hasPeer) return
    const sel = currentSel()
    if (s.project === lastProject && sameSel(sel, lastSel)) return
    lastProject = s.project
    lastSel = sel
    channel?.postMessage({ type: 'sync', project: s.project, sel })
  })

  channel.onmessage = (ev: MessageEvent) => {
    const m = ev.data as { type?: string; project?: unknown; sel?: Sel } | null
    if (!m) return
    hasPeer = true
    if (m.type === 'request') {
      broadcastNow()
      return
    }
    if (m.type === 'sync' && m.project) {
      applying = true
      try {
        useProjectStore.setState({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          project: m.project as any,
          selectedEquipmentId: m.sel?.e,
          selectedCableId: m.sel?.c,
          selectedLocationId: m.sel?.l,
          selectedTemplateName: m.sel?.t,
        })
        lastProject = useProjectStore.getState().project
        lastSel = m.sel ?? {}
      } finally {
        applying = false
      }
    }
  }

  // Initialen Stand vom anderen Fenster anfordern (Popout pullt vom Haupt).
  channel.postMessage({ type: 'request' })
}
