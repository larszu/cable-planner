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
      t('settings.advanced.categories.renamePrompt', 'Kategorie umbenennen'),
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
      t('settings.advanced.categories.addPrompt', 'Neue Kategorie'),
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
        format(t('settings.advanced.caches.confirm', '{label} leeren?'), { label }),
        { destructive: true, okLabel: t('settings.advanced.caches.confirmBtn', 'Leeren') },
      ))
    )
      return
    try {
      localStorage.removeItem(key)
      await infoDialog(
        format(
          t('settings.advanced.caches.cleared', '{label} geleert.'),
          { label },
        ),
        {
          body: t('settings.advanced.caches.cleared.body', 'Beim nächsten Start wird neu geladen.'),
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
          'Willkommens-Dialog beim nächsten Start wieder anzeigen?',
        ),
        { okLabel: t('common.reset', 'Zurücksetzen') },
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
          'Wie oft das aktuelle Projekt automatisch in localStorage gespeichert wird. Standard: 400 ms.',
        )}
      >
        <label className="block text-cp-base text-cp-text-secondary">
          {t('settings.advanced.autosaveInterval', 'Autosave-Intervall (ms)')}
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
        title={t('settings.advanced.categories', 'Kategorienverwaltung')}
        description={t(
          'settings.advanced.categoriesDesc',
          'Bibliothek-Kategorien umbenennen oder neue anlegen. Beim Umbenennen wandern alle zugeordneten Vorlagen mit.',
        )}
      >
        <div className="max-h-56 overflow-auto rounded border border-cp-border-muted bg-cp-surface-3/50">
          <table className="w-full text-cp-xs">
            <thead className="sticky top-0 bg-cp-surface-1 text-cp-text-muted">
              <tr>
                <th className="px-2 py-1 text-left">
                  {t('settings.advanced.categories.col.name', 'Kategorie')}
                </th>
                <th className="px-2 py-1 text-right">
                  {t('settings.advanced.categories.col.count', 'Vorlagen')}
                </th>
                <th className="px-2 py-1" aria-label={t('settings.advanced.actionsAria', 'Aktionen')} />
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
                        {t('common.rename', 'Umbenennen')}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {allCategories.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-2 py-3 text-center text-cp-text-faint">
                    {t('settings.advanced.categories.empty', 'Noch keine Kategorien.')}
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
          {t('settings.advanced.categories.addBtn', '+ Neue Kategorie')}
        </button>
      </SettingsCard>

      <SettingsCard
        title={t('settings.advanced.caches', 'Caches & Lokale Daten')}
        description={t(
          'settings.advanced.cachesDesc',
          'Cache-Inhalte werden bei Bedarf neu geladen. Daten gehen nicht verloren — nur die Performance-Caches.',
        )}
      >
        <div className="grid grid-cols-1 gap-1">
          <button
            type="button"
            onClick={() =>
              clearCache('cable-planner:rentmanTemplateCache:v1', t('settings.advanced.caches.rentmanLabel', 'Rentman-Template-Cache'))
            }
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs text-left hover:bg-cp-surface-5"
          >
            {t('settings.advanced.caches.rentman', 'Rentman-Template-Cache leeren')}
          </button>
          {/* v7.6.0 — NetBox import removed; cache entry will not be populated. */}
          <button
            type="button"
            onClick={() => clearCache('cable-planner:web:recents', t('settings.advanced.caches.webLabel', 'Web-Suchverlauf'))}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs text-left hover:bg-cp-surface-5"
          >
            {t('settings.advanced.caches.web', 'Web-Suchverlauf leeren')}
          </button>
          <button
            type="button"
            onClick={resetWelcome}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs text-left hover:bg-cp-surface-5"
          >
            {t('settings.advanced.caches.welcome', 'Willkommens-Dialog beim nächsten Start zeigen')}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.advanced.export', 'Datenexport')}
        description={t(
          'settings.advanced.exportDesc',
          'Lokal gespeicherte Cable-Planner-Daten als JSON exportieren — z. B. zum Übertragen auf eine andere Maschine.',
        )}
      >
        <button
          type="button"
          onClick={exportAllData}
          className="rounded bg-amber-700 px-3 py-1 text-cp-xs hover:bg-amber-600"
        >
          {t('settings.advanced.exportBtn', 'Alle localStorage-Daten exportieren')}
        </button>
      </SettingsCard>
    </div>
  )
}
