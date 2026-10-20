/**
 * #427 — Inhalt der Einstellungen (Seiten-Navigation + aktiver Tab),
 * losgelöst vom Modal-Rahmen. So kann er sowohl im SettingsDialog (Modal)
 * als auch in einem ausgelagerten OS-Fenster (PopoutApp) gerendert werden.
 */
import { useState, type HTMLAttributes, type ReactNode } from 'react'
import {
  ClipboardList, Palette, Pencil, Keyboard, Plug, Database, RefreshCw, Settings, Blocks, X, ListPlus, Bot,
  BadgeCheck, Cable, ListChecks, Library,
  type LucideIcon,
} from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModulesTab } from './tabs/ModulesTab'
import { HotkeysTab } from './tabs/HotkeysTab'
import { SyncTab } from './tabs/SyncTab'
import { AdvancedTab } from './tabs/AdvancedTab'
import { ProjectTab } from './tabs/ProjectTab'
import { ConfigsTab } from './tabs/ConfigsTab'
import { EditingTab } from './tabs/EditingTab'
import { AppearanceTab } from './tabs/AppearanceTab'
import { IntegrationsTab } from './tabs/IntegrationsTab'
import { McpTab } from './tabs/McpTab'
import { DeviceLibraryTab } from './tabs/DeviceLibraryTab'
import { SchemaBuilderTab } from './tabs/SchemaBuilderTab'
import { NachweiseTab } from './tabs/NachweiseTab'
import { CableTypesTab } from './tabs/CableTypesTab'
import { StammdatenTab } from './tabs/StammdatenTab'
import { useTranslation } from '../../lib/i18n'

export type SettingsSection =
  | 'project'
  | 'modules'
  | 'appearance'
  | 'editing'
  | 'hotkeys'
  | 'integrations'
  | 'deviceLibrary'
  | 'mcp'
  | 'configs'
  | 'cableTypes'
  | 'stammdaten'
  | 'schema'
  | 'sync'
  | 'nachweise'
  | 'advanced'

const TAB_ICONS: Record<SettingsSection, LucideIcon> = {
  project: ClipboardList,
  modules: Blocks,
  appearance: Palette,
  editing: Pencil,
  hotkeys: Keyboard,
  integrations: Plug,
  deviceLibrary: Library,
  mcp: Bot,
  configs: Database,
  cableTypes: Cable,
  stammdaten: ListChecks,
  schema: ListPlus,
  sync: RefreshCw,
  nachweise: BadgeCheck,
  advanced: Settings,
}

// Statische t()-Aufrufe statt Fallback-Map: nur so sieht lang:check die Fallbacks (#971).
const tabLabels = (t: (key: string, fallback: string) => string): Record<SettingsSection, string> => ({
  project: t('settings.tab.project', 'Project'),
  modules: t('settings.tab.modules', 'Modules'),
  appearance: t('settings.tab.appearance', 'Appearance'),
  editing: t('settings.tab.editing', 'Editing'),
  hotkeys: t('settings.tab.hotkeys', 'Hotkeys'),
  integrations: t('settings.tab.integrations', 'Integrations'),
  deviceLibrary: t('settings.tab.deviceLibrary', 'Device library'),
  mcp: t('settings.tab.mcp', 'MCP'),
  configs: t('settings.tab.configs', 'Configurations'),
  cableTypes: t('settings.tab.cableTypes', 'Cable types'),
  stammdaten: t('settings.tab.stammdaten', 'Master data'),
  schema: t('settings.tab.schema', 'Categories & fields'),
  sync: t('settings.tab.sync', 'Network sync'),
  nachweise: t('settings.tab.nachweise', 'Credentials'),
  advanced: t('settings.tab.advanced', 'Advanced'),
})

const tabTitles = (t: (key: string, fallback: string) => string): Record<SettingsSection, string> => ({
  project: t('settings.tabTitle.project', 'Project settings'),
  modules: t('settings.tabTitle.modules', 'Modules'),
  appearance: t('settings.tabTitle.appearance', 'Appearance'),
  editing: t('settings.tabTitle.editing', 'Editing'),
  hotkeys: t('settings.tabTitle.hotkeys', 'Keyboard shortcuts'),
  integrations: t('settings.tabTitle.integrations', 'Integrations'),
  deviceLibrary: t('settings.tabTitle.deviceLibrary', 'Device library (devices.zumpelars.de)'),
  mcp: t('settings.tabTitle.mcp', 'MCP server (Claude queries the plan)'),
  configs: t('settings.tabTitle.configs', 'Device configurations'),
  cableTypes: t('settings.tabTitle.cableTypes', 'Cable types'),
  stammdaten: t('settings.tabTitle.stammdaten', 'Master data (connectors, standards, layers)'),
  schema: t('settings.tabTitle.schema', 'Categories & fields (field builder)'),
  sync: t('settings.tabTitle.sync', 'Network sync'),
  nachweise: t('settings.tabTitle.nachweise', 'Credentials (qualifications, insurance)'),
  advanced: t('settings.tabTitle.advanced', 'Advanced'),
})

/**
 * Die Liste kommt aus der Icon-Tabelle statt noch einmal hingeschrieben zu
 * werden (Bedarf 120).
 *
 * Vorher stand hier eine eigene Aufzaehlung — die VIERTE Stelle, an der jeder
 * Abschnitt genannt sein musste, und die einzige ohne Typ-Pruefung. Wer einen
 * Tab ergaenzte und sie vergass, bekam einen Abschnitt, der sich zwar
 * anklicken, aber nicht per `initialSection` oeffnen liess — still und ohne
 * Fehlermeldung. Die drei `Record<SettingsSection, …>`-Tabellen daneben
 * erzwingen die Vollstaendigkeit; diese Zeile erbt sie jetzt.
 */
const isSection = (v: unknown): v is SettingsSection =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(TAB_ICONS, v)

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
  const labels = tabLabels(t)

  const navItem = (id: SettingsSection) => (
    <button
      key={id}
      type="button"
      onClick={() => setSection(id)}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-cp-full px-3 py-2 text-left text-cp-base sm:w-full sm:shrink sm:rounded-cp-control ${
        section === id ? 'bg-cp-accent text-cp-accent-text' : 'text-cp-text-secondary hover:bg-cp-surface-2'
      }`}
    >
      <Icon icon={TAB_ICONS[id]} size="sm" />
      <span>{labels[id]}</span>
    </button>
  )

  return (
    <>
      <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-cp-border-muted bg-cp-surface-3/40 p-3 sm:w-52 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r">
        <h3 className="mb-2 hidden px-2 text-cp-xs font-semibold text-cp-text-faint sm:block">
          {t('settings.section', 'Settings')}
        </h3>
        {(Object.keys(TAB_ICONS) as SettingsSection[]).map((id) => navItem(id))}
      </aside>

      <main className="flex min-w-0 min-h-0 flex-1 flex-col">
        <header
          {...headerProps}
          className="flex shrink-0 items-center justify-between border-b border-cp-border-muted px-4 py-2 select-none"
        >
          <h2 id={titleId} className="text-cp-xl font-semibold">
            {tabTitles(t)[section]}
          </h2>
          <div className="flex items-center gap-1">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center px-2 py-1 text-[var(--cp-text-muted)] hover:bg-[var(--cp-surface-2)] hover:text-[var(--cp-text)]"
              aria-label={t('common.close', 'Close')}
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
          {section === 'modules' && <ModulesTab />}
          {section === 'appearance' && <AppearanceTab />}
          {section === 'editing' && <EditingTab />}
          {section === 'hotkeys' && <HotkeysTab />}
          {section === 'integrations' && <IntegrationsTab onClose={onClose} />}
          {section === 'deviceLibrary' && <DeviceLibraryTab />}
          {section === 'mcp' && <McpTab />}
          {section === 'configs' && <ConfigsTab />}
          {section === 'cableTypes' && <CableTypesTab />}
          {section === 'stammdaten' && <StammdatenTab />}
          {section === 'schema' && <SchemaBuilderTab />}
          {section === 'sync' && <SyncTab />}
          {section === 'nachweise' && <NachweiseTab />}
          {section === 'advanced' && <AdvancedTab />}
        </div>
      </main>
    </>
  )
}
