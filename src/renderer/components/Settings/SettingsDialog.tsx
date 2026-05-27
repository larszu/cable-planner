import { useState } from 'react'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { HotkeysTab } from './tabs/HotkeysTab'
import { SyncTab } from './tabs/SyncTab'
import { AdvancedTab } from './tabs/AdvancedTab'
import { ProjectTab } from './tabs/ProjectTab'
import { ConfigsTab } from './tabs/ConfigsTab'
import { EditingTab } from './tabs/EditingTab'
import { AppearanceTab } from './tabs/AppearanceTab'
import { IntegrationsTab } from './tabs/IntegrationsTab'
import { useTranslation } from '../../lib/i18n'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

type SettingsSection =
  | 'project'
  | 'appearance'
  | 'editing'
  | 'hotkeys'
  | 'integrations'
  | 'configs'
  | 'sync'
  | 'advanced'

const TAB_ICONS: Record<SettingsSection, string> = {
  project: '📋',
  appearance: '🎨',
  editing: '✏️',
  hotkeys: '⌨',
  integrations: '🔌',
  configs: '🗄',
  sync: '🔄',
  advanced: '⚙',
}

const TAB_FALLBACK_LABEL: Record<SettingsSection, string> = {
  project: 'Projekt',
  appearance: 'Darstellung',
  editing: 'Bearbeiten',
  hotkeys: 'Hotkeys',
  integrations: 'Integrationen',
  configs: 'Konfigurationen',
  sync: 'Netzwerk-Sync',
  advanced: 'Erweitert',
}

const TAB_FALLBACK_TITLE: Record<SettingsSection, string> = {
  project: 'Projekt-Einstellungen',
  appearance: 'Darstellung',
  editing: 'Bearbeiten',
  hotkeys: 'Tastenkürzel',
  integrations: 'Integrationen',
  configs: 'Geräte-Konfigurationen',
  sync: 'Netzwerk-Sync',
  advanced: 'Erweitert',
}

export const SettingsDialog = ({ open, onClose }: SettingsDialogProps) => {
  const [section, setSection] = useState<SettingsSection>('project')
  const drag = useDraggablePosition('cable-planner:modal-pos:settings', open)
  const t = useTranslation()

  if (!open) return null

  const navItem = (id: SettingsSection) => (
    <button
      key={id}
      type="button"
      onClick={() => setSection(id)}
      className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${
        section === id
          ? 'bg-sky-700 text-white'
          : 'text-slate-300 hover:bg-slate-800'
      }`}
    >
      <span className="text-base">{TAB_ICONS[id]}</span>
      <span>{t(`settings.tab.${id}`, TAB_FALLBACK_LABEL[id])}</span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6">
      <div
        ref={drag.containerRef}
        style={drag.containerStyle}
        // v7.9.2 — Fix-große Höhe statt max-h, damit der Viewport nicht
        // pro Tab variabel groß ist. Inner-Scroll greift immer.
        className="flex h-[85vh] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl sm:flex-row"
      >
        <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950/40 p-3 sm:w-52 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r">
          <h3 className="mb-2 hidden px-2 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:block">
            {t('settings.section', 'Einstellungen')}
          </h3>
          {(Object.keys(TAB_ICONS) as SettingsSection[]).map((id) => navItem(id))}
        </aside>

        <main className="flex min-w-0 min-h-0 flex-1 flex-col">
          <header
            {...drag.headerProps}
            className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2 select-none"
          >
            <h2 className="text-base font-semibold">
              {t(`settings.tabTitle.${section}`, TAB_FALLBACK_TITLE[section])}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              {t('common.close', 'Schließen')}
            </button>
          </header>

          {/* v7.9.2 — min-h-0 + flex-1 + overflow-y-auto sorgt für
              zuverlässiges Scrollen in JEDEM Tab (z.B. Datenexport
              im langen Erweitert-Tab). */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {section === 'project' && <ProjectTab onClose={onClose} />}
            {section === 'appearance' && <AppearanceTab />}
            {section === 'editing' && <EditingTab />}
            {section === 'hotkeys' && <HotkeysTab />}
            {section === 'integrations' && <IntegrationsTab onClose={onClose} />}
            {section === 'configs' && <ConfigsTab />}
            {section === 'sync' && <SyncTab />}
            {section === 'advanced' && <AdvancedTab />}
          </div>
        </main>
      </div>
    </div>
  )
}

// --- Reusable card ---------------------------------------------------------

// --- Tab: Project ----------------------------------------------------------


