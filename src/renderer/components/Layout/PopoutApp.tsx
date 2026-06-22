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
import { SettingsBody } from '../Settings/SettingsBody'
import { useTranslation } from '../../lib/i18n'
import type { PopoutPanel } from '../../lib/panelPopout'

const TITLE_KEYS: Record<PopoutPanel, { key: string; fallback: string }> = {
  library: { key: 'panel.title.library', fallback: 'Library' },
  properties: { key: 'panel.title.properties', fallback: 'Eigenschaften' },
  annotations: { key: 'panel.title.annotations', fallback: 'Anmerkungen' },
  settings: { key: 'panel.title.settings', fallback: 'Einstellungen' },
}

export const PopoutApp = ({ panel }: { panel: PopoutPanel }) => {
  const t = useTranslation()
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  // Theme + Titel des Popout-Fensters setzen.
  useEffect(() => {
    document.documentElement.dataset.theme = canvasTheme
  }, [canvasTheme])
  useEffect(() => {
    document.title = `Cable Planner — ${t(TITLE_KEYS[panel].key, TITLE_KEYS[panel].fallback)}`
  }, [panel, t])

  // #427 — Einstellungen füllen das Fenster (Sidebar + Tab), Schließen
  // schließt das OS-Fenster. Layout entspricht dem Modal-Panel.
  if (panel === 'settings') {
    return (
      <div className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-cp-surface-1 text-cp-text sm:flex-row">
        <SettingsBody onClose={() => window.close()} />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--cp-bg)] text-[var(--cp-text)]">
      {panel === 'library' && <LibraryPanel />}
      {panel === 'properties' && <PropertiesPanel />}
      {panel === 'annotations' && <AnnotationsPanel open onClose={() => window.close()} />}
    </div>
  )
}
