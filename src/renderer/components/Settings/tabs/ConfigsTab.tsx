import { useMemo, useState } from 'react'
import {
  Download, X, Monitor, SlidersHorizontal, Tag, Shuffle, Headphones, FileText, Upload, Save,
  type LucideIcon,
} from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { useUiStore } from '../../../store/uiStore'
import { useProjectStore } from '../../../store/projectStore'
import { format, useTranslation } from '../../../lib/i18n'
import { confirmDialog } from '../../../lib/confirmDialog'
import { infoDialog } from '../../../lib/infoDialog'
import { downloadBlob } from '../../../lib/downloadBlob'
import { pickTextFile } from '../../../lib/pickFile'
import { SettingsCard } from '../SettingsCard'
import type { DeviceConfigEntry, DeviceConfigKind } from '../../../store/uiStore'
import { PanelHint } from '../../shared/PanelHint'

/**
 * #307 — Configs-Tab (Issue #80) aus SettingsDialog ausgelagert. Verwaltet
 * die globale Bibliothek von Geräte-Konfigurationen (ATEM/Videohub/GreenGo)
 * + Upload + Filter + Equipment-Zuordnung.
 */

const CONFIG_KIND_LABEL: Record<DeviceConfigKind, string> = {
  'atem-mv': 'ATEM Multiviewer Layout',
  'atem-audio': 'ATEM Audio-Routing',
  'videohub-labels': 'Videohub Labels',
  'videohub-routing': 'Videohub Routing',
  greengo: 'GreenGo Intercom (.gg5)',
  other: 'Sonstige',
}

const CONFIG_KIND_ICON: Record<DeviceConfigKind, LucideIcon> = {
  'atem-mv': Monitor,
  'atem-audio': SlidersHorizontal,
  'videohub-labels': Tag,
  'videohub-routing': Shuffle,
  greengo: Headphones,
  other: FileText,
}

const guessKindFromFileName = (fileName: string): DeviceConfigKind => {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.gg5')) return 'greengo'
  if (lower.includes('multiview') || lower.includes('mvw') || lower.includes('mv-layout'))
    return 'atem-mv'
  if (lower.includes('audio') || lower.includes('fairlight')) return 'atem-audio'
  if (lower.includes('label')) return 'videohub-labels'
  if (lower.includes('routing') || lower.includes('matrix')) return 'videohub-routing'
  if (lower.endsWith('.xml') && lower.includes('atem')) return 'atem-mv'
  return 'other'
}

const downloadConfig = (entry: DeviceConfigEntry) => {
  downloadBlob(entry.fileName || `${entry.name}.txt`, entry.content, entry.mimeType)
}

const CONFIG_PICKER_ACCEPT =
  '.xml,.json,.gg5,.txt,.csv,application/xml,application/json,text/plain'

export const ConfigsTab = () => {
  const t = useTranslation()
  const library = useUiStore((s) => s.deviceConfigLibrary)
  const addDeviceConfig = useUiStore((s) => s.addDeviceConfig)
  const updateDeviceConfig = useUiStore((s) => s.updateDeviceConfig)
  const removeDeviceConfig = useUiStore((s) => s.removeDeviceConfig)
  const replaceDeviceConfigLibrary = useUiStore((s) => s.replaceDeviceConfigLibrary)
  const equipment = useProjectStore((s) => s.project.equipment)
  const [filter, setFilter] = useState<DeviceConfigKind | 'all'>('all')

  const grouped = useMemo(() => {
    const filtered = filter === 'all' ? library : library.filter((e) => e.kind === filter)
    const byKind = new Map<DeviceConfigKind, DeviceConfigEntry[]>()
    for (const entry of filtered) {
      const list = byKind.get(entry.kind) ?? []
      list.push(entry)
      byKind.set(entry.kind, list)
    }
    return byKind
  }, [library, filter])

  const handleUpload = async () => {
    const file = await pickTextFile(CONFIG_PICKER_ACCEPT)
    if (!file) return
    const kind = guessKindFromFileName(file.name)
    addDeviceConfig({
      kind,
      name: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      mimeType: file.mimeType,
      content: file.content,
    })
  }

  const handleExportBundle = () => {
    downloadBlob(
      `cable-planner-konfigurationen-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 1, library }, null, 2),
      'application/json',
    )
  }

  const handleImportBundle = async () => {
    const file = await pickTextFile(CONFIG_PICKER_ACCEPT)
    if (!file) return
    try {
      const parsed = JSON.parse(file.content) as { version?: number; library?: DeviceConfigEntry[] }
      if (!parsed.library || !Array.isArray(parsed.library)) {
        await infoDialog(t('settings.configs.invalidBundleTitle', 'Invalid configuration bundle'), {
          body: t(
            'settings.configs.invalidBundleBody',
            'The file does not contain a cable-planner configuration bundle.',
          ),
          tone: 'error',
        })
        return
      }
      const replace = await confirmDialog(
        format(t('settings.configs.loadCount', 'Load {n} configurations'), {
          n: parsed.library.length,
        }),
        {
          body: t(
            'settings.configs.replaceOrAppend',
            '"Replace" = existing library is overwritten.\n"Append" = new configurations are added, existing ones kept.',
          ),
          okLabel: t('settings.configs.replace', 'Replace'),
          cancelLabel: t('settings.configs.append', 'Append'),
          destructive: true,
        },
      )
      if (replace) {
        replaceDeviceConfigLibrary(parsed.library)
      } else {
        // Append, but assign fresh ids so we never collide with existing ones.
        for (const entry of parsed.library) {
          const { id: _drop, savedAt: _drop2, ...rest } = entry
          void _drop
          void _drop2
          addDeviceConfig(rest)
        }
      }
    } catch (err) {
      await infoDialog(t('settings.configs.importErrorTitle', 'Import error'), {
        body: err instanceof Error ? err.message : String(err),
        tone: 'error',
      })
    }
  }

  return (
    <div className="space-y-3">
      <PanelHint
        className="text-cp-xs text-cp-text-muted"
        text={t(
          'settings.configs.intro',
          'Global library of device configurations (ATEM, Videohub, GreenGo). Upload files here, download them again as a file, or assign the matching config to a canvas device (in the device properties panel).',
        )}
      />

      <SettingsCard
        title={t('settings.configs.upload.title', 'Upload new configuration')}
        description={t(
          'settings.configs.upload.desc',
          'XML / JSON / TXT / .gg5 — the type is guessed from the file name and can be changed below.',
        )}
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleUpload()}
            className="inline-flex items-center gap-1.5 rounded bg-sky-700 px-3 py-1 text-cp-xs text-white hover:bg-sky-600"
          >
            <Icon icon={Upload} size="xs" />
            {t('settings.configs.pickFile', 'Choose file…')}
          </button>
          <button
            type="button"
            onClick={handleExportBundle}
            disabled={library.length === 0}
            className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1 text-cp-xs text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon={Save} size="xs" />
            {t('settings.configs.exportBundle', 'Export library as JSON')}
          </button>
          <button
            type="button"
            onClick={() => void handleImportBundle()}
            className="rounded bg-amber-700 px-3 py-1 text-cp-xs text-white hover:bg-amber-600"
          >
            {t('settings.configs.importBundle', '⤵ Import JSON library…')}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.configs.library.title', 'Configuration library')}
        description={
          library.length === 0
            ? t(
                'settings.configs.library.empty',
                'No configurations uploaded yet.',
              )
            : format(t('settings.configs.entriesCount', '{n} entries'), { n: library.length })
        }
      >
        <div className="mb-2 flex flex-wrap gap-1">
          {(['all', 'atem-mv', 'atem-audio', 'videohub-labels', 'videohub-routing', 'greengo', 'other'] as const).map(
            (k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] ${
                  filter === k
                    ? 'bg-sky-700 text-white'
                    : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
                }`}
              >
                {k === 'all' ? (
                  format(t('settings.configs.filterAll', 'All ({n})'), { n: library.length })
                ) : (
                  <>
                    <Icon icon={CONFIG_KIND_ICON[k]} size="xs" />
                    {t(`settings.configs.kind.${k}`, CONFIG_KIND_LABEL[k])} (
                    {library.filter((e) => e.kind === k).length})
                  </>
                )}
              </button>
            ),
          )}
        </div>

        {library.length === 0 ? (
          <div className="rounded border border-dashed border-cp-border p-4 text-center text-[11px] text-cp-text-muted">
            {t(
              'settings.configs.emptyHint',
              'Upload your first configuration file — it will be listed here and can then be assigned to a device on the canvas.',
            )}
          </div>
        ) : grouped.size === 0 ? (
          <div className="rounded border border-dashed border-cp-border p-4 text-center text-[11px] text-cp-text-muted">
            {t('settings.configs.noFilterMatch', 'No entry matches the selected filter.')}
          </div>
        ) : (
          <ul className="space-y-2">
            {Array.from(grouped.entries()).map(([kind, entries]) => (
              <li key={kind}>
                <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-cp-text-muted">
                  <Icon icon={CONFIG_KIND_ICON[kind]} size="xs" />
                  {t(`settings.configs.kind.${kind}`, CONFIG_KIND_LABEL[kind])}
                </div>
                <ul className="space-y-1">
                  {entries.map((entry) => {
                    const linked = entry.equipmentId
                      ? equipment.find((eq) => eq.id === entry.equipmentId)
                      : undefined
                    return (
                      <li
                        key={entry.id}
                        className="flex flex-wrap items-center gap-2 rounded border border-cp-border-muted bg-cp-surface-3 px-2 py-1.5 text-cp-xs"
                      >
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) => updateDeviceConfig(entry.id, { name: e.target.value })}
                          className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-3 px-1.5 py-0.5 text-cp-text"
                        />
                        <select
                          value={entry.kind}
                          onChange={(e) =>
                            updateDeviceConfig(entry.id, {
                              kind: e.target.value as DeviceConfigKind,
                            })
                          }
                          className="rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 text-[11px] text-cp-text-bright"
                        >
                          {(Object.keys(CONFIG_KIND_LABEL) as DeviceConfigKind[]).map((k) => (
                            <option key={k} value={k}>
                              {t(`settings.configs.kind.${k}`, CONFIG_KIND_LABEL[k])}
                            </option>
                          ))}
                        </select>
                        <select
                          value={entry.equipmentId ?? ''}
                          onChange={(e) =>
                            updateDeviceConfig(entry.id, {
                              equipmentId: e.target.value || undefined,
                            })
                          }
                          className="rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 text-[11px] text-cp-text-bright"
                          title={t(
                            'settings.configs.assignTitle',
                            'Device on the canvas this configuration is assigned to',
                          )}
                        >
                          <option value="">{t('settings.configs.unassigned', '(unassigned)')}</option>
                          {equipment.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.name}
                            </option>
                          ))}
                        </select>
                        <span
                          className="hidden text-[10px] text-cp-text-muted sm:inline"
                          title={format(
                            t(
                              'settings.configs.fileMeta',
                              'Original file: {fileName}\nUploaded: {savedAt}\n{chars} characters',
                            ),
                            {
                              fileName: entry.fileName,
                              savedAt: new Date(entry.savedAt).toLocaleString(),
                              chars: entry.content.length.toLocaleString(),
                            },
                          )}
                        >
                          {entry.fileName}{linked ? ' · ✓' : ''}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => downloadConfig(entry)}
                            className="rounded bg-cp-surface-4 px-2 py-0.5 text-[11px] text-cp-text hover:bg-cp-surface-5"
                            title={t('settings.configs.downloadTitle', 'Download original file')}
                          >
                            <Icon icon={Download} size="xs" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (
                                await confirmDialog(
                                  format(t('settings.configs.confirmDelete', 'Delete configuration "{name}"?'), {
                                    name: entry.name,
                                  }),
                                  {
                                    body: t(
                                      'settings.configs.deleteHint',
                                      'The file on disk is not modified.',
                                    ),
                                    okLabel: t('common.delete', 'Delete'),
                                    destructive: true,
                                  },
                                )
                              ) {
                                removeDeviceConfig(entry.id)
                              }
                            }}
                            className="rounded bg-cp-surface-2 px-2 py-0.5 text-[11px] text-cp-text-secondary hover:bg-red-700 hover:text-white"
                            title={t('settings.configs.removeTitle', 'Remove from library')}
                          >
                            <Icon icon={X} size="sm" />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </div>
  )
}
