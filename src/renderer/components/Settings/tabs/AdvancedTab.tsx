import { useMemo } from 'react'
import { useSettingsStore } from '../../../store/settingsStore'
import { useProjectStore } from '../../../store/projectStore'
import { useUiStore } from '../../../store/uiStore'
import { useTranslation, format } from '../../../lib/i18n'
import { confirmDialog } from '../../../lib/confirmDialog'
import { infoDialog } from '../../../lib/infoDialog'
import { bilingualCategoryDialog } from '../../../lib/bilingualCategoryDialog'
import { categoryDisplay } from '../../../lib/categoryTranslations'
import { downloadBlob } from '../../../lib/downloadBlob'
import { SettingsCard } from '../SettingsCard'

/**
 * #307 — Advanced-Tab aus SettingsDialog ausgelagert. Enthaelt Autosave-
 * Intervall, Kategorienverwaltung, Caches/lokale Daten und Datenexport.
 */
export const AdvancedTab = () => {
  const autosaveIntervalMs = useSettingsStore((s) => s.autosaveIntervalMs)
  const setAutosaveIntervalMs = useSettingsStore((s) => s.setAutosaveIntervalMs)
  const knownCategories = useProjectStore((s) => s.knownCategories)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const renameCustomCategory = useProjectStore((s) => s.renameCustomCategory)
  const addKnownCategories = useProjectStore((s) => s.addKnownCategories)
  const categoryTranslations = useProjectStore((s) => s.categoryTranslations)
  const setCategoryTranslation = useProjectStore((s) => s.setCategoryTranslation)
  const lang = useUiStore((s) => s.language)
  const t = useTranslation()

  const allCategories = useMemo(
    () =>
      Array.from(
        new Set([
          ...knownCategories,
          ...customLibrary.map((tpl) => tpl.category).filter(Boolean),
        ]),
      ).sort((a, b) => a.localeCompare(b)),
    [knownCategories, customLibrary],
  )

  const usageCount = (cat: string) =>
    customLibrary.filter((tpl) => tpl.category === cat).length

  const handleRename = async (cat: string) => {
    // #309 — Bilinguale Bearbeitung: zeigt beide Sprachen, vorbefüllt
    // mit dem aktuellen Map-Eintrag (oder canonical als Fallback in der
    // aktiven UI-Sprache).
    const existing = categoryTranslations[cat] ?? {}
    const initial: { de?: string; en?: string } = {
      de: existing.de ?? (lang === 'de' ? cat : undefined),
      en: existing.en ?? (lang === 'en' ? cat : undefined),
    }
    const result = await bilingualCategoryDialog(
      t('settings.advanced.categories.renamePrompt', 'Rename category'),
      initial,
    )
    if (!result || !result.canonical) return
    // Wenn der canonical-Name sich geändert hat, klassisches Rename
    // (migriert auch Templates + verbaute Equipment).
    if (result.canonical !== cat) {
      renameCustomCategory(cat, result.canonical)
      setCategoryTranslation(result.canonical, { de: result.de, en: result.en })
    } else {
      setCategoryTranslation(cat, { de: result.de, en: result.en })
    }
  }

  const handleAdd = async () => {
    const result = await bilingualCategoryDialog(
      t('settings.advanced.categories.addPrompt', 'New category'),
    )
    if (!result || !result.canonical) return
    addKnownCategories([result.canonical])
    if (result.de || result.en) {
      setCategoryTranslation(result.canonical, { de: result.de, en: result.en })
    }
  }

  const clearCache = async (key: string, label: string) => {
    if (
      !(await confirmDialog(
        format(t('settings.advanced.caches.confirm', 'Clear {label}?'), { label }),
        { destructive: true, okLabel: t('settings.advanced.caches.confirmBtn', 'Clear') },
      ))
    )
      return
    try {
      localStorage.removeItem(key)
      await infoDialog(
        format(
          t('settings.advanced.caches.cleared', '{label} cleared. Will be reloaded on next start.'),
          { label },
        ),
        {
          body: t('settings.advanced.caches.cleared.body', 'The next start will reload from scratch.'),
          tone: 'success',
        },
      )
    } catch {
      /* ignore */
    }
  }

  const exportAllData = () => {
    const dump: Record<string, string | null> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('cable-planner:')) dump[k] = localStorage.getItem(k)
    }
    downloadBlob(
      `cable-planner-localStorage-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(dump, null, 2),
      'application/json',
    )
  }

  const resetWelcome = async () => {
    if (
      !(await confirmDialog(
        t(
          'settings.advanced.caches.welcomeConfirm',
          'Show the welcome dialog on next start?',
        ),
        { okLabel: t('common.reset', 'Reset') },
      ))
    )
      return
    localStorage.removeItem('cable-planner:welcomed')
  }

  return (
    <div className="space-y-3">
      <SettingsCard
        title={t('settings.advanced.autosave', 'Autosave')}
        description={t(
          'settings.advanced.autosaveDesc',
          'How often the current project is automatically saved to localStorage. Default: 400 ms.',
        )}
      >
        <label className="block text-cp-base text-cp-text-secondary">
          {t('settings.advanced.autosaveInterval', 'Autosave interval (ms)')}
          <input
            type="number"
            min={100}
            max={30000}
            step={100}
            value={autosaveIntervalMs}
            onChange={(e) => setAutosaveIntervalMs(Number(e.target.value) || 400)}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
          />
        </label>
      </SettingsCard>

      <SettingsCard
        title={t('settings.advanced.categories', 'Category management')}
        description={t(
          'settings.advanced.categoriesDesc',
          'Rename library categories or add new ones. When renaming, all assigned templates move along.',
        )}
      >
        <div className="max-h-56 overflow-auto rounded border border-cp-border-muted bg-cp-surface-3/50">
          <table className="w-full text-cp-xs">
            <thead className="sticky top-0 bg-cp-surface-1 text-cp-text-muted">
              <tr>
                <th className="px-2 py-1 text-left">
                  {t('settings.advanced.categories.col.name', 'Category')}
                </th>
                <th className="px-2 py-1 text-right">
                  {t('settings.advanced.categories.col.count', 'Templates')}
                </th>
                <th className="px-2 py-1" aria-label={t('settings.advanced.actionsAria', 'Actions')} />
              </tr>
            </thead>
            <tbody>
              {allCategories.map((cat) => {
                const display = categoryDisplay(cat, lang, categoryTranslations)
                const showCanonical = display !== cat
                return (
                  <tr key={cat} className="border-t border-cp-border-muted">
                    <td className="px-2 py-1 text-cp-text">
                      {display}
                      {showCanonical && (
                        <span className="ml-1 text-[10px] text-cp-text-muted">({cat})</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-cp-text-muted">{usageCount(cat)}</td>
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleRename(cat)}
                        className="rounded bg-cp-surface-4 px-2 py-0.5 text-[10px] hover:bg-cp-surface-5"
                      >
                        {t('common.rename', 'Rename')}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {allCategories.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-2 py-3 text-center text-cp-text-faint">
                    {t('settings.advanced.categories.empty', 'No categories yet.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="mt-2 rounded bg-emerald-700 px-3 py-1 text-cp-xs hover:bg-emerald-600"
        >
          {t('settings.advanced.categories.addBtn', '+ New category')}
        </button>
      </SettingsCard>

      <SettingsCard
        title={t('settings.advanced.caches', 'Caches & local data')}
        description={t(
          'settings.advanced.cachesDesc',
          'Cache contents are reloaded on demand. Your data is safe — only performance caches are cleared.',
        )}
      >
        <div className="grid grid-cols-1 gap-1">
          <button
            type="button"
            onClick={() =>
              clearCache('cable-planner:rentmanTemplateCache:v1', t('settings.advanced.caches.rentmanLabel', 'Rentman template cache'))
            }
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs text-left hover:bg-cp-surface-5"
          >
            {t('settings.advanced.caches.rentman', 'Clear Rentman template cache')}
          </button>
          {/* v7.6.0 — NetBox import removed; cache entry will not be populated. */}
          <button
            type="button"
            onClick={() => clearCache('cable-planner:web:recents', t('settings.advanced.caches.webLabel', 'Web search history'))}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs text-left hover:bg-cp-surface-5"
          >
            {t('settings.advanced.caches.web', 'Clear web search history')}
          </button>
          <button
            type="button"
            onClick={resetWelcome}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs text-left hover:bg-cp-surface-5"
          >
            {t('settings.advanced.caches.welcome', 'Show welcome dialog on next start')}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.advanced.export', 'Data export')}
        description={t(
          'settings.advanced.exportDesc',
          'Export Cable Planner data stored locally as JSON — e.g. to migrate to another machine.',
        )}
      >
        <button
          type="button"
          onClick={exportAllData}
          className="rounded bg-amber-700 px-3 py-1 text-cp-xs hover:bg-amber-600"
        >
          {t('settings.advanced.exportBtn', 'Export all localStorage data')}
        </button>
      </SettingsCard>
    </div>
  )
}
