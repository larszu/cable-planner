/**
 * #427 — Inhalt der Einstellungen (Seiten-Navigation + aktiver Tab),
 * losgelöst vom Modal-Rahmen. So kann er sowohl im SettingsDialog (Modal)
 * als auch in einem ausgelagerten OS-Fenster (PopoutApp) gerendert werden.
 */
import { useState, type HTMLAttributes, type ReactNode } from 'react'
import {
  ClipboardList, Palette, Pencil, Keyboard, Plug, Database, RefreshCw, Settings, X,
  type LucideIcon,
} from 'lucide-react'
import { Icon } from '../shared/Icon'
import { HotkeysTab } from './tabs/HotkeysTab'
import { SyncTab } from './tabs/SyncTab'
import { AdvancedTab } from './tabs/AdvancedTab'
import { ProjectTab } from './tabs/ProjectTab'
import { ConfigsTab } from './tabs/ConfigsTab'
import { EditingTab } from './tabs/EditingTab'
import { AppearanceTab } from './tabs/AppearanceTab'
import { IntegrationsTab } from './tabs/IntegrationsTab'
import { useTranslation } from '../../lib/i18n'

export type SettingsSection =
  | 'project'
  | 'appearance'
  | 'editing'
  | 'hotkeys'
  | 'integrations'
  | 'configs'
  | 'sync'
  | 'advanced'

const TAB_ICONS: Record<SettingsSection, LucideIcon> = {
  project: ClipboardList,
  appearance: Palette,
  editing: Pencil,
  hotkeys: Keyboard,
  integrations: Plug,
  configs: Database,
  sync: RefreshCw,
  advanced: Settings,
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

const isSection = (v: unknown): v is SettingsSection =>
  typeof v === 'string' &&
  ['project', 'appearance', 'editing', 'hotkeys', 'integrations', 'configs', 'sync', 'advanced'].includes(v)

interface SettingsBodyProps {
  onClose: () => void
  /** Tab, der initial aktiv ist (z. B. 'sync'). */
  initialSection?: string
  /** Drag-Handler für die Kopfzeile (nur im Modal genutzt). */
  headerProps?: HTMLAttributes<HTMLElement>
  /** a11y-Titel-Id (nur im Modal genutzt). */
  titleId?: string
  /** Optionale Aktion links neben dem Schließen-Button (z. B. Auslagern). */
  headerAction?: ReactNode
}

export const SettingsBody = ({ onClose, initialSection, headerProps, titleId, headerAction }: SettingsBodyProps) => {
  const [section, setSection] = useState<SettingsSection>(isSection(initialSection) ? initialSection : 'project')
  const t = useTranslation()

  const navItem = (id: SettingsSection) => (
    <button
      key={id}
      type="button"
      onClick={() => setSection(id)}
      className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-cp-base ${
        section === id ? 'bg-sky-700 text-white' : 'text-cp-text-secondary hover:bg-cp-surface-2'
      }`}
    >
      <Icon icon={TAB_ICONS[id]} size="sm" />
      <span>{t(`settings.tab.${id}`, TAB_FALLBACK_LABEL[id])}</span>
    </button>
  )

  return (
    <>
      <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-cp-border-muted bg-cp-surface-3/40 p-3 sm:w-52 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r">
        <h3 className="mb-2 hidden px-2 text-cp-xs font-semibold uppercase tracking-wider text-cp-text-faint sm:block">
          {t('settings.section', 'Einstellungen')}
        </h3>
        {(Object.keys(TAB_ICONS) as SettingsSection[]).map((id) => navItem(id))}
      </aside>

      <main className="flex min-w-0 min-h-0 flex-1 flex-col">
        <header
          {...headerProps}
          className="flex shrink-0 items-center justify-between border-b border-cp-border-muted px-4 py-2 select-none"
        >
          <h2 id={titleId} className="text-cp-xl font-semibold">
            {t(`settings.tabTitle.${section}`, TAB_FALLBACK_TITLE[section])}
          </h2>
          <div className="flex items-center gap-1">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded px-2 py-1 text-[var(--cp-text-muted)] hover:bg-[var(--cp-surface-2)] hover:text-[var(--cp-text)]"
              aria-label={t('common.close', 'Schließen')}
            >
              <Icon icon={X} size="md" />
            </button>
          </div>
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
    </>
  )
}
