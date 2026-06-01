/**
 * #427 — Render-Shell für ein in ein separates OS-Fenster ausgelagertes Panel.
 *
 * Lädt dieselbe App mit `?popout=<panel>` und zeigt NUR das jeweilige Panel,
 * fensterfüllend. Projekt-/Auswahl-Zustand kommt über initPanelPopoutSync()
 * (BroadcastChannel) live aus dem Hauptfenster. Kein Canvas, kein Menü.
 */
import { useEffect } from 'react'
import { useUiStore } from '../../store/uiStore'
import { LibraryPanel } from '../Library/LibraryPanel'
import { PropertiesPanel } from '../Properties/PropertiesPanel'
import { AnnotationsPanel } from '../Annotations/AnnotationsPanel'
import type { PopoutPanel } from '../../lib/panelPopout'

export const PopoutApp = ({ panel }: { panel: PopoutPanel }) => {
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  // Theme + Titel des Popout-Fensters setzen.
  useEffect(() => {
    document.documentElement.dataset.theme = canvasTheme
  }, [canvasTheme])
  useEffect(() => {
    const title =
      panel === 'library' ? 'Library' : panel === 'properties' ? 'Eigenschaften' : 'Anmerkungen'
    document.title = `Cable Planner — ${title}`
  }, [panel])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--cp-bg)] text-[var(--cp-text)]">
      {panel === 'library' && <LibraryPanel />}
      {panel === 'properties' && <PropertiesPanel />}
      {panel === 'annotations' && <AnnotationsPanel open onClose={() => window.close()} />}
    </div>
  )
}
