import { useState } from 'react'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { Download, Upload, Loader2, X } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation, format } from '../../../lib/i18n'
import { infoDialog } from '../../../lib/infoDialog'
import { pickImageAsDataUri } from '../../../lib/readImageAsDataUri'
import { SettingsCard } from '../SettingsCard'
import { DEFAULT_CABLE_NUMBERING, cableNumberExample } from '../../../lib/cableNumbering'
import { DEFAULT_LENGTH_ESTIMATION } from '../../../lib/cableLengthEstimate'
import { VIDEO_FORMATS, DEFAULT_VIDEO_FORMAT } from '../../../types/videoFormat'
import { POWER_STANDARDS, DEFAULT_POWER_STANDARD } from '../../../types/powerStandard'
import type { CableNumberingScheme, LengthEstimationScheme } from '../../../types/project'
import type { PowerStandardId } from '../../../types/powerStandard'

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
      <div className="flex flex-wrap items-center gap-2 text-cp-xs text-cp-text-bright">
        <button
          type="button"
          onClick={handleExport}
          className="rounded bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600"
          title={`${customLibrary.length} ${t('settings.project.libExport.devicesWord', 'Geräte')} + ${groupPresets.length} ${t('settings.project.libExport.groupsWord', 'Gruppen')} ${t('settings.project.libExport.exportVerb', 'exportieren')}`}
        >
          <Icon icon={Download} size="xs" className="mr-1 inline-block align-text-bottom" />{t('settings.project.libExport.exportBtn', 'Library exportieren')} ({customLibrary.length} {t('settings.project.libExport.devicesWord', 'Geräte')}, {groupPresets.length} {t('settings.project.libExport.groupsWord', 'Gruppen')})
        </button>
        <label className="rounded bg-sky-700 px-3 py-1.5 cursor-pointer hover:bg-sky-600">
          {importBusy ? (
            <><Icon icon={Loader2} size="xs" className="mr-1 inline-block align-text-bottom animate-spin" />{t('settings.project.libExport.importing', 'Importiere…')}</>
          ) : (
            <><Icon icon={Upload} size="xs" className="mr-1 inline-block align-text-bottom" />{t('settings.project.libExport.importBtn', 'Library importieren…')}</>
          )}
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

/**
 * Auto-Kabelnummerierung — Schema-Konfiguration + "Neu nummerieren".
 * Eigene Section (wie LibraryExportSection), schreibt direkt in die
 * Projekt-Metadaten statt ueber das draftMeta-Pattern des Tabs.
 */
const CableNumberingSection = () => {
  const t = useTranslation()
  const scheme = useProjectStore((s) => s.project.metadata.cableNumbering)
  const updateProjectMetadata = useProjectStore((s) => s.updateProjectMetadata)
  const renumberCables = useProjectStore((s) => s.renumberCables)
  const cableCount = useProjectStore((s) => s.project.cables.length)
  const eff: CableNumberingScheme = scheme ?? DEFAULT_CABLE_NUMBERING
  const [doneCount, setDoneCount] = useState<number | null>(null)

  const patch = (p: Partial<CableNumberingScheme>) =>
    updateProjectMetadata({ cableNumbering: { ...eff, ...p } })

  const handleRenumber = () => {
    // Schema sicher in den Metadaten verankern, falls noch nie gesetzt.
    if (!scheme) updateProjectMetadata({ cableNumbering: eff })
    renumberCables()
    setDoneCount(cableCount)
  }

  return (
    <SettingsCard
      title={t('settings.project.numbering.title', 'Kabelnummerierung')}
      description={t(
        'settings.project.numbering.desc',
        'Automatische, kollisionsfreie Kabel-IDs nach festem Schema — sichtbar auf dem Canvas, in der Patchliste und auf den Etiketten.',
      )}
    >
      <div className="space-y-2 text-cp-xs text-cp-text-bright">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={eff.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          {t('settings.project.numbering.enabled', 'Neuen Kabeln automatisch eine Nummer geben')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">{t('settings.project.numbering.prefix', 'Präfix')}</span>
            <input
              type="text"
              value={eff.prefix}
              onChange={(e) => patch({ prefix: e.target.value })}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              placeholder="C"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">{t('settings.project.numbering.separator', 'Trennzeichen')}</span>
            <input
              type="text"
              value={eff.separator}
              maxLength={2}
              onChange={(e) => patch({ separator: e.target.value })}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              placeholder="-"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">{t('settings.project.numbering.padding', 'Stellen')}</span>
            <input
              type="number"
              min={1}
              max={6}
              value={eff.padding}
              onChange={(e) => patch({ padding: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">{t('settings.project.numbering.start', 'Start-Nummer')}</span>
            <input
              type="number"
              min={0}
              value={eff.start}
              onChange={(e) => patch({ start: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={eff.perLayer}
            onChange={(e) => patch({ perLayer: e.target.checked })}
          />
          {t('settings.project.numbering.perLayer', 'Eigener Zähler je Layer (V/A/N/P …)')}
        </label>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-cp-text-muted">
            {t('settings.project.numbering.example', 'Beispiel')}:{' '}
            <span className="font-mono text-sky-300">{cableNumberExample(eff)}</span>
          </span>
          <button
            type="button"
            onClick={handleRenumber}
            disabled={cableCount === 0}
            className="rounded bg-sky-700 px-3 py-1.5 hover:bg-sky-600 disabled:opacity-50"
          >
            {t('settings.project.numbering.renumber', 'Alle Kabel neu nummerieren')} ({cableCount})
          </button>
        </div>
        {doneCount !== null && (
          <p className="text-[11px] text-emerald-400">
            {format(t('settings.project.numbering.done', '{n} Kabel neu nummeriert.'), { n: doneCount })}
          </p>
        )}
      </div>
    </SettingsCard>
  )
}

/**
 * #350 — Kabellängen-Schätzung aus der Canvas-Geometrie (Luftlinie ×
 * Maßstab × Slack). Erste Ausbaustufe; überschreibt die Längen aller
 * nicht-wireless Kabel.
 */
const LengthEstimationSection = () => {
  const t = useTranslation()
  const scheme = useProjectStore((s) => s.project.metadata.lengthEstimation)
  const updateProjectMetadata = useProjectStore((s) => s.updateProjectMetadata)
  const estimateCableLengths = useProjectStore((s) => s.estimateCableLengths)
  const cableCount = useProjectStore((s) => s.project.cables.length)
  const eff: LengthEstimationScheme = scheme ?? DEFAULT_LENGTH_ESTIMATION
  const [doneCount, setDoneCount] = useState<number | null>(null)

  const patch = (p: Partial<LengthEstimationScheme>) =>
    updateProjectMetadata({ lengthEstimation: { ...eff, ...p } })

  const handleEstimate = () => {
    if (!scheme) updateProjectMetadata({ lengthEstimation: eff })
    const n = estimateCableLengths()
    setDoneCount(n)
  }

  return (
    <SettingsCard
      title={t('settings.project.lengthEst.title', 'Kabellängen schätzen')}
      description={t(
        'settings.project.lengthEst.desc',
        'Schätzt die Kabellängen aus der Canvas-Distanz der Geräte (Luftlinie × Maßstab + Reserve). Überschreibt vorhandene Längen.',
      )}
    >
      <div className="space-y-2 text-cp-xs text-cp-text-bright">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">
              {t('settings.project.lengthEst.scale', 'Meter pro 100 px')}
            </span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={eff.metersPer100px}
              onChange={(e) => patch({ metersPer100px: Math.max(0.1, Number(e.target.value) || 0.1) })}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">
              {t('settings.project.lengthEst.slack', 'Reserve (%)')}
            </span>
            <input
              type="number"
              min={0}
              max={200}
              value={eff.slackPercent}
              onChange={(e) => patch({ slackPercent: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={eff.roundUp}
            onChange={(e) => patch({ roundUp: e.target.checked })}
          />
          {t('settings.project.lengthEst.roundUp', 'Auf ganze Meter aufrunden')}
        </label>
        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={handleEstimate}
            disabled={cableCount === 0}
            className="rounded bg-sky-700 px-3 py-1.5 hover:bg-sky-600 disabled:opacity-50"
          >
            {t('settings.project.lengthEst.run', 'Längen jetzt schätzen')} ({cableCount})
          </button>
        </div>
        {doneCount !== null && (
          <p className="text-[11px] text-emerald-400">
            {format(t('settings.project.lengthEst.done', '{n} Kabellängen aktualisiert.'), { n: doneCount })}
          </p>
        )}
      </div>
    </SettingsCard>
  )
}

/**
 * Plan-Standards — technische Vorgaben für DIESEN Plan, je Gewerk. Der Cable
 * Planner deckt mehr als Video ab; das frühere „Format"-Feld in der Kopfzeile
 * ist hierher (und um den Strom-/Netz-Standard erweitert) gewandert.
 */
const PlanDefaultsSection = () => {
  const t = useTranslation()
  const videoFormat = useProjectStore((s) => s.project.metadata.defaultVideoFormat)
  const powerStandard = useProjectStore((s) => s.project.metadata.defaultPowerStandard)
  const lightingControl = useProjectStore((s) => s.project.metadata.defaultLightingControl)
  const setDefaultVideoFormat = useProjectStore((s) => s.setDefaultVideoFormat)
  const updateProjectMetadata = useProjectStore((s) => s.updateProjectMetadata)
  return (
    <SettingsCard
      title={t('settings.project.defaults.title', 'Plan-Standards')}
      description={t(
        'settings.project.defaults.desc',
        'Technische Vorgaben für diesen Plan, je nach Gewerk. Das Video-Format steuert die SDI-Standardverkabelung, der Strom-/Netz-Standard die Spannung im Stromrechner (Watt ↔ Ampere).',
      )}
    >
      <div className="grid grid-cols-1 gap-3 text-cp-xs text-cp-text-bright sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">
            {t('settings.project.defaults.video', 'Video-Format (SDI)')}
          </span>
          <select
            value={videoFormat ?? DEFAULT_VIDEO_FORMAT}
            onChange={(e) => setDefaultVideoFormat(e.target.value)}
            className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
          >
            {VIDEO_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">
            {t('settings.project.defaults.power', 'Strom-/Netz-Standard')}
          </span>
          <select
            value={powerStandard ?? DEFAULT_POWER_STANDARD}
            onChange={(e) =>
              updateProjectMetadata({ defaultPowerStandard: e.target.value as PowerStandardId })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
          >
            {POWER_STANDARDS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">
            {t('settings.project.defaults.lighting', 'Licht-Steuerung (Default)')}
          </span>
          <select
            value={lightingControl ?? 'dmx512'}
            onChange={(e) =>
              updateProjectMetadata({
                defaultLightingControl: e.target.value as 'dmx512' | 'artnet' | 'sacn',
              })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
          >
            <option value="dmx512">DMX512 / RDM (5-pin XLR)</option>
            <option value="artnet">Art-Net (Ethernet)</option>
            <option value="sacn">sACN — ANSI E1.31 (Ethernet)</option>
          </select>
        </label>
      </div>
    </SettingsCard>
  )
}

export const ProjectTab = ({ onClose: _onClose }: { onClose: () => void }) => {
  const metadata = useProjectStore((s) => s.project.metadata)
  const updateProjectMetadata = useProjectStore((s) => s.updateProjectMetadata)
  const [draftMeta, setDraftMeta] = useSyncedState(metadata)
  const t = useTranslation()

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
      <p className="text-cp-xs text-cp-text-muted">
        {t(
          'settings.project.intro',
          'Projekt-Metadaten — werden mit der Cable-Planner-Datei gespeichert.',
        )}
      </p>
      <label className="block text-cp-base">
        {t('settings.project.name', 'Projektname')}
        <input
          type="text"
          value={draftMeta.name}
          onChange={(e) => setDraftMeta({ ...draftMeta, name: e.target.value })}
          className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
          placeholder={t('settings.project.name', 'Projektname')}
        />
      </label>
      <label className="block text-cp-base">
        {t('settings.project.description', 'Beschreibung')}
        <textarea
          value={draftMeta.description ?? ''}
          onChange={(e) => setDraftMeta({ ...draftMeta, description: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
          placeholder={t(
            'settings.project.descriptionPlaceholder',
            'Optionale Projektbeschreibung',
          )}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-cp-base">
          {t('settings.project.client', 'Auftraggeber (Kunde)')}
          <input
            type="text"
            value={draftMeta.client ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, client: e.target.value })}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
            placeholder={t('settings.project.clientPlaceholder', 'Endkunde')}
          />
        </label>
        <label className="block text-cp-base">
          {t('settings.project.contractor', 'Auftragnehmer')}
          <input
            type="text"
            value={draftMeta.contractor ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, contractor: e.target.value })}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
            placeholder={t('settings.project.contractorPlaceholder', 'Ausführende Firma')}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-cp-base">
          {t('settings.project.author', 'Autor')}
          <input
            type="text"
            value={draftMeta.author ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, author: e.target.value })}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
            placeholder={t('settings.project.authorPlaceholder', 'Dein Name')}
          />
        </label>
        <label className="block text-cp-base">
          {t('settings.project.number', 'Projekt-Nr.')}
          <input
            type="text"
            value={draftMeta.projectNumber ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, projectNumber: e.target.value })}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
            placeholder={t('settings.project.numberPlaceholder', 'z. B. 2026-042')}
          />
        </label>
      </div>

      <PlanDefaultsSection />

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
                <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded border border-cp-border bg-white/5">
                  {current ? (
                    <img src={current} alt={label} className="max-h-16 max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-cp-text-muted">{label}</span>
                  )}
                </div>
                <div className="flex w-full gap-1">
                  <button
                    type="button"
                    onClick={() => pickLogo(field)}
                    className="flex-1 rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
                  >
                    {t('common.choose', 'Wählen…')}
                  </button>
                  {current && (
                    <button
                      type="button"
                      onClick={() => setDraftMeta((prev) => ({ ...prev, [field]: undefined }))}
                      title={t('common.remove', 'Entfernen')}
                      aria-label={t('common.remove', 'Entfernen')}
                      className="rounded bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-muted hover:bg-red-700 hover:text-white"
                    >
                      <Icon icon={X} size="sm" />
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
          <div className="text-cp-xs text-cp-text-muted">
            <span className="text-orange-300">
              {metadata.rentmanProjectName ?? `Projekt #${metadata.rentmanProjectId}`}
            </span>
            <span className="ml-2 text-cp-text-faint">(ID: {metadata.rentmanProjectId})</span>
          </div>
        ) : (
          <div className="text-cp-xs text-cp-text-faint">
            {t(
              'settings.project.notLinked',
              'Kein Rentman-Projekt verknüpft. Verknüpfung im Tab „Integrationen" herstellen.',
            )}
          </div>
        )}
      </SettingsCard>

      <CableNumberingSection />
      <LengthEstimationSection />

      <LibraryExportSection />

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => setDraftMeta(metadata)}
          className="rounded bg-cp-surface-4 px-3 py-1 text-cp-base hover:bg-cp-surface-5"
        >
          {t('common.reset', 'Zurücksetzen')}
        </button>
        <button
          type="button"
          onClick={persistMeta}
          className="rounded bg-emerald-600 px-3 py-1 text-cp-base hover:bg-emerald-500"
        >
          {t('common.save', 'Speichern')}
        </button>
      </div>
    </div>
  )
}
