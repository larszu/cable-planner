import { useEffect, useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
import { infoDialog } from '../../../lib/infoDialog'
import { pickImageAsDataUri } from '../../../lib/readImageAsDataUri'
import { SettingsCard } from '../SettingsCard'

/**
 * #307 — Project-Tab aus SettingsDialog ausgelagert. Enthaelt
 * Projekt-Metadaten + Logos + verknuepftes Rentman-Projekt + die
 * Library-Export/Import-Section (Issue #122).
 */

// v7.9.0 / Issue #122 — Library Export/Import. Erstes Stück eines
// zentralen Library-Speichers: bisher leben customLibrary +
// groupPresets in localStorage (pro Electron-Installation). Mit dem
// Export kann der User die ganze Library als JSON-Datei speichern
// (Dropbox-sync, Team-Backup, …) und auf einer anderen Installation
// importieren. Eine echte Datei-pro-Gerät + Versions-Tracking
// kommt in einer späteren Phase (#122 ist als Roadmap-Issue
// offen markiert).
interface LibraryExportFile {
  type: 'cable-planner-library'
  version: 1
  exportedAt: string
  customLibrary: import('../../../types/equipment').EquipmentTemplate[]
  groupPresets: import('../../../types/equipment').GroupPreset[]
  knownCategories: string[]
}

const LibraryExportSection = () => {
  const t = useTranslation()
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const groupPresets = useProjectStore((s) => s.groupPresets)
  const knownCategories = useProjectStore((s) => s.knownCategories)
  const addCustomTemplates = useProjectStore((s) => s.addCustomTemplates)
  const setGroupPresets = useProjectStore((s) => s.setGroupPresets)
  const addKnownCategories = useProjectStore((s) => s.addKnownCategories)
  const [importBusy, setImportBusy] = useState(false)

  const handleExport = () => {
    const payload: LibraryExportFile = {
      type: 'cable-planner-library',
      version: 1,
      exportedAt: new Date().toISOString(),
      customLibrary,
      groupPresets,
      knownCategories,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().slice(0, 10)
    a.download = `cable-planner-library-${ts}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // allow re-import of the same file
    setImportBusy(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text) as LibraryExportFile
      if (data?.type !== 'cable-planner-library') {
        await infoDialog(t('settings.project.libImport.badFormatTitle', 'Falsches Dateiformat'), {
          body: t('settings.project.libImport.badFormatBody', 'Diese Datei ist keine cable-planner-Library.'),
          tone: 'error',
        })
        return
      }
      // Merge-by-name: addCustomTemplates only adds entries whose name
      // doesn't exist yet. Damit überschreibt der Import nie eigene
      // Edits am gleichen Template.
      if (Array.isArray(data.customLibrary)) {
        addCustomTemplates(data.customLibrary)
      }
      if (Array.isArray(data.knownCategories)) {
        addKnownCategories(data.knownCategories)
      }
      // Group-Presets dürfen ebenfalls nur ergänzt werden, nicht
      // ersetzt — wir kombinieren.
      if (Array.isArray(data.groupPresets)) {
        const byId = new Map(groupPresets.map((p) => [p.id, p]))
        for (const p of data.groupPresets) {
          if (!byId.has(p.id)) byId.set(p.id, p)
        }
        setGroupPresets(Array.from(byId.values()))
      }
      await infoDialog(t('settings.project.libImport.okTitle', 'Library importiert'), {
        body:
          `${data.customLibrary?.length ?? 0} ${t('settings.project.libImport.templatesWord', 'Geräte-Templates')} · ` +
          `${data.groupPresets?.length ?? 0} ${t('settings.project.libImport.presetsWord', 'Gruppen-Presets')}\n\n` +
          t('settings.project.libImport.okBody', 'Nur neue Einträge wurden hinzugefügt — vorhandene Templates bleiben unverändert.'),
        tone: 'success',
      })
    } catch (err) {
      await infoDialog(t('settings.project.libImport.failTitle', 'Import fehlgeschlagen'), {
        body: err instanceof Error ? err.message : String(err),
        tone: 'error',
      })
    } finally {
      setImportBusy(false)
    }
  }

  return (
    <SettingsCard
      title={t('settings.project.libExport.title', 'Library Export / Import (#122)')}
      description={t(
        'settings.project.libExport.desc',
        'Sichere deine eigenen Geräte-Templates, Gruppen und Rack-Presets als JSON-Datei. Beim Import werden bestehende Einträge mit gleichem Namen NICHT überschrieben (merge-by-name).',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
        <button
          type="button"
          onClick={handleExport}
          className="rounded bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600"
          title={`${customLibrary.length} ${t('settings.project.libExport.devicesWord', 'Geräte')} + ${groupPresets.length} ${t('settings.project.libExport.groupsWord', 'Gruppen')} ${t('settings.project.libExport.exportVerb', 'exportieren')}`}
        >
          ⬇ {t('settings.project.libExport.exportBtn', 'Library exportieren')} ({customLibrary.length} {t('settings.project.libExport.devicesWord', 'Geräte')}, {groupPresets.length} {t('settings.project.libExport.groupsWord', 'Gruppen')})
        </button>
        <label className="rounded bg-sky-700 px-3 py-1.5 cursor-pointer hover:bg-sky-600">
          {importBusy
            ? t('settings.project.libExport.importing', 'Importiere…')
            : '⬆ ' + t('settings.project.libExport.importBtn', 'Library importieren…')}
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImport}
            disabled={importBusy}
          />
        </label>
      </div>
    </SettingsCard>
  )
}

export const ProjectTab = ({ onClose: _onClose }: { onClose: () => void }) => {
  const metadata = useProjectStore((s) => s.project.metadata)
  const updateProjectMetadata = useProjectStore((s) => s.updateProjectMetadata)
  const [draftMeta, setDraftMeta] = useState(metadata)
  const t = useTranslation()
  useEffect(() => setDraftMeta(metadata), [metadata])

  const persistMeta = () =>
    updateProjectMetadata({
      name: draftMeta.name,
      description: draftMeta.description,
      author: draftMeta.author,
      client: draftMeta.client,
      contractor: draftMeta.contractor,
      projectNumber: draftMeta.projectNumber,
      companyLogo: draftMeta.companyLogo,
      clientLogo: draftMeta.clientLogo,
    })

  const pickLogo = async (which: 'companyLogo' | 'clientLogo') => {
    const dataUri = await pickImageAsDataUri()
    if (dataUri) setDraftMeta((prev) => ({ ...prev, [which]: dataUri }))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        {t(
          'settings.project.intro',
          'Projekt-Metadaten — werden mit der Cable-Planner-Datei gespeichert.',
        )}
      </p>
      <label className="block text-sm">
        {t('settings.project.name', 'Projektname')}
        <input
          type="text"
          value={draftMeta.name}
          onChange={(e) => setDraftMeta({ ...draftMeta, name: e.target.value })}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
          placeholder={t('settings.project.name', 'Projektname')}
        />
      </label>
      <label className="block text-sm">
        {t('settings.project.description', 'Beschreibung')}
        <textarea
          value={draftMeta.description ?? ''}
          onChange={(e) => setDraftMeta({ ...draftMeta, description: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
          placeholder={t(
            'settings.project.descriptionPlaceholder',
            'Optionale Projektbeschreibung',
          )}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          {t('settings.project.client', 'Auftraggeber (Kunde)')}
          <input
            type="text"
            value={draftMeta.client ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, client: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder={t('settings.project.clientPlaceholder', 'Endkunde')}
          />
        </label>
        <label className="block text-sm">
          {t('settings.project.contractor', 'Auftragnehmer')}
          <input
            type="text"
            value={draftMeta.contractor ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, contractor: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder={t('settings.project.contractorPlaceholder', 'Ausführende Firma')}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          {t('settings.project.author', 'Autor')}
          <input
            type="text"
            value={draftMeta.author ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, author: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder={t('settings.project.authorPlaceholder', 'Dein Name')}
          />
        </label>
        <label className="block text-sm">
          {t('settings.project.number', 'Projekt-Nr.')}
          <input
            type="text"
            value={draftMeta.projectNumber ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, projectNumber: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder={t('settings.project.numberPlaceholder', 'z. B. 2026-042')}
          />
        </label>
      </div>

      <SettingsCard
        title={t('settings.project.logos', 'Bauplan-Signatur (Logos)')}
        description={t(
          'settings.project.logosHint',
          'Logos werden als Daten-URI in der Projektdatei gespeichert (PDF-Export & Canvas-Signatur).',
        )}
      >
        <div className="grid grid-cols-2 gap-3">
          {(['companyLogo', 'clientLogo'] as const).map((field) => {
            const label =
              field === 'companyLogo'
                ? t('settings.project.logo.contractor', 'Auftragnehmer')
                : t('settings.project.logo.client', 'Kunde')
            const current = draftMeta[field]
            return (
              <div key={field} className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded border border-slate-700 bg-white/5">
                  {current ? (
                    <img src={current} alt={label} className="max-h-16 max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-500">{label}</span>
                  )}
                </div>
                <div className="flex w-full gap-1">
                  <button
                    type="button"
                    onClick={() => pickLogo(field)}
                    className="flex-1 rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                  >
                    {t('common.choose', 'Wählen…')}
                  </button>
                  {current && (
                    <button
                      type="button"
                      onClick={() => setDraftMeta((prev) => ({ ...prev, [field]: undefined }))}
                      title={t('common.remove', 'Entfernen')}
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-red-700 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SettingsCard>

      <SettingsCard title={t('settings.project.linkedRentman', 'Verknüpftes Rentman-Projekt')}>
        {metadata.rentmanProjectId ? (
          <div className="text-xs text-slate-400">
            <span className="text-orange-300">
              {metadata.rentmanProjectName ?? `Projekt #${metadata.rentmanProjectId}`}
            </span>
            <span className="ml-2 text-slate-500">(ID: {metadata.rentmanProjectId})</span>
          </div>
        ) : (
          <div className="text-xs text-slate-500">
            {t(
              'settings.project.notLinked',
              'Kein Rentman-Projekt verknüpft. Verknüpfung im Tab „Integrationen" herstellen.',
            )}
          </div>
        )}
      </SettingsCard>

      <LibraryExportSection />

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => setDraftMeta(metadata)}
          className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
        >
          {t('common.reset', 'Zurücksetzen')}
        </button>
        <button
          type="button"
          onClick={persistMeta}
          className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
        >
          {t('common.save', 'Speichern')}
        </button>
      </div>
    </div>
  )
}
