import { useState } from 'react'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { Download, Upload, Loader2, X } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation, format } from '../../../lib/i18n'
import { infoDialog } from '../../../lib/infoDialog'
import { EMPTY_TEMPLATE_ADD_REPORT, hasOmissions } from '../../../lib/templateAddReport'
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
        await infoDialog(t('settings.project.libImport.badFormatTitle', 'Wrong file format'), {
          body: t('settings.project.libImport.badFormatBody', 'This file is not a cable-planner library.'),
          tone: 'error',
        })
        return
      }
      // Merge-by-name: addCustomTemplates only adds entries whose name
      // doesn't exist yet. Damit überschreibt der Import nie eigene
      // Edits am gleichen Template.
      // Bedarf 65: der Bericht sagt, was WIRKLICH angelegt wurde. Bis hierher
      // meldete das Fenster `data.customLibrary.length` — die Zahl aus der
      // DATEI. Zweihundert importiert, drei angelegt, gemeldet: „200".
      let bericht = EMPTY_TEMPLATE_ADD_REPORT
      if (Array.isArray(data.customLibrary)) {
        bericht = addCustomTemplates(data.customLibrary)
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
      await infoDialog(t('settings.project.libImport.okTitle', 'Library imported'), {
        body:
          `${bericht.added.length} ${t('settings.project.libImport.templatesWord', 'device templates')} · ` +
          `${data.groupPresets?.length ?? 0} ${t('settings.project.libImport.presetsWord', 'group presets')}\n\n` +
          t('settings.project.libImport.okBody', 'Only new entries were added — existing templates remain unchanged.') +
          // Was NICHT angelegt wurde, mit Namen. „Vorhandene bleiben
          // unveraendert" allein sagt nicht, WELCHE und WIE VIELE — und wer
          // die Datei geschickt hat, will genau das wissen.
          (hasOmissions(bericht)
            ? '\n\n' +
              format(
                t(
                  'settings.project.libImport.skipped',
                  'Not created: {n} name(s) that already existed{namen}{ohneName}',
                ),
                {
                  n: bericht.skipped.length,
                  namen: bericht.skipped.length > 0 ? ` — ${bericht.skipped.slice(0, 12).join(', ')}` : '',
                  ohneName:
                    bericht.unnamed > 0
                      ? format(t('settings.project.libImport.unnamed', ' · {n} without a name'), {
                          n: bericht.unnamed,
                        })
                      : '',
                },
              )
            : ''),
        tone: 'success',
      })
    } catch (err) {
      await infoDialog(t('settings.project.libImport.failTitle', 'Import failed'), {
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
        'Save your own device templates, groups and rack presets as a JSON file. On import, existing entries with the same name are NOT overwritten (merge-by-name).',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-cp-xs text-cp-text-bright">
        <button
          type="button"
          onClick={handleExport}
          className="bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600"
          title={`${customLibrary.length} ${t('settings.project.libExport.devicesWord', 'devices')} + ${groupPresets.length} ${t('settings.project.libExport.groupsWord', 'groups')} ${t('settings.project.libExport.exportVerb', 'export')}`}
        >
          <Icon icon={Download} size="xs" className="mr-1 inline-block align-text-bottom" />{t('settings.project.libExport.exportBtn', 'Export library')} ({customLibrary.length} {t('settings.project.libExport.devicesWord', 'devices')}, {groupPresets.length} {t('settings.project.libExport.groupsWord', 'groups')})
        </button>
        <label className="bg-sky-700 px-3 py-1.5 cursor-pointer hover:bg-sky-600">
          {importBusy ? (
            <><Icon icon={Loader2} size="xs" className="mr-1 inline-block align-text-bottom animate-spin" />{t('settings.project.libExport.importing', 'Importing…')}</>
          ) : (
            <><Icon icon={Upload} size="xs" className="mr-1 inline-block align-text-bottom" />{t('settings.project.libExport.importBtn', 'Import library…')}</>
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
      title={t('settings.project.numbering.title', 'Cable numbering')}
      description={t(
        'settings.project.numbering.desc',
        'Automatic, collision-free cable IDs from a fixed scheme — shown on the canvas, in the patch list and on the labels.',
      )}
    >
      <div className="space-y-2 text-cp-xs text-cp-text-bright">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={eff.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          {t('settings.project.numbering.enabled', 'Auto-assign a number to new cables')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">{t('settings.project.numbering.prefix', 'Prefix')}</span>
            <input
              type="text"
              value={eff.prefix}
              onChange={(e) => patch({ prefix: e.target.value })}
              className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
              placeholder="C"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">{t('settings.project.numbering.separator', 'Separator')}</span>
            <input
              type="text"
              value={eff.separator}
              maxLength={2}
              onChange={(e) => patch({ separator: e.target.value })}
              className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
              placeholder="-"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">{t('settings.project.numbering.padding', 'Digits')}</span>
            <input
              type="number"
              min={1}
              max={6}
              value={eff.padding}
              onChange={(e) => patch({ padding: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })}
              className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">{t('settings.project.numbering.start', 'Start number')}</span>
            <input
              type="number"
              min={0}
              value={eff.start}
              onChange={(e) => patch({ start: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={eff.perLayer}
            onChange={(e) => patch({ perLayer: e.target.checked })}
          />
          {t('settings.project.numbering.perLayer', 'Separate counter per layer (V/A/N/P …)')}
        </label>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-cp-text-muted">
            {t('settings.project.numbering.example', 'Example')}:{' '}
            <span className="font-mono text-sky-300">{cableNumberExample(eff)}</span>
          </span>
          <button
            type="button"
            onClick={handleRenumber}
            disabled={cableCount === 0}
            className="bg-sky-700 px-3 py-1.5 hover:bg-sky-600 disabled:opacity-50"
          >
            {t('settings.project.numbering.renumber', 'Renumber all cables')} ({cableCount})
          </button>
        </div>
        {doneCount !== null && (
          <p className="text-cp-xs text-emerald-400">
            {format(t('settings.project.numbering.done', '{n} cables renumbered.'), { n: doneCount })}
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
      title={t('settings.project.lengthEst.title', 'Estimate cable lengths')}
      description={t(
        'settings.project.lengthEst.desc',
        'Estimates cable lengths from the on-canvas distance between devices (straight line × scale + slack). Overwrites existing lengths.',
      )}
    >
      <div className="space-y-2 text-cp-xs text-cp-text-bright">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">
              {t('settings.project.lengthEst.scale', 'Metres per 100 px')}
            </span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={eff.metersPer100px}
              onChange={(e) => patch({ metersPer100px: Math.max(0.1, Number(e.target.value) || 0.1) })}
              className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-muted">
              {t('settings.project.lengthEst.slack', 'Slack (%)')}
            </span>
            <input
              type="number"
              min={0}
              max={200}
              value={eff.slackPercent}
              onChange={(e) => patch({ slackPercent: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={eff.roundUp}
            onChange={(e) => patch({ roundUp: e.target.checked })}
          />
          {t('settings.project.lengthEst.roundUp', 'Round up to whole metres')}
        </label>
        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={handleEstimate}
            disabled={cableCount === 0}
            className="bg-sky-700 px-3 py-1.5 hover:bg-sky-600 disabled:opacity-50"
          >
            {t('settings.project.lengthEst.run', 'Estimate lengths now')} ({cableCount})
          </button>
        </div>
        {doneCount !== null && (
          <p className="text-cp-xs text-emerald-400">
            {format(t('settings.project.lengthEst.done', '{n} cable lengths updated.'), { n: doneCount })}
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
      title={t('settings.project.defaults.title', 'Plan defaults')}
      description={t(
        'settings.project.defaults.desc',
        'Technical defaults for this plan, by discipline. The video format drives the default SDI cabling; the power/mains standard sets the voltage used by the power calculator (watts ↔ amps).',
      )}
    >
      <div className="grid grid-cols-1 gap-3 text-cp-xs text-cp-text-bright sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">
            {t('settings.project.defaults.video', 'Video format (SDI)')}
          </span>
          <select
            value={videoFormat ?? DEFAULT_VIDEO_FORMAT}
            onChange={(e) => setDefaultVideoFormat(e.target.value)}
            className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
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
            {t('settings.project.defaults.power', 'Power / mains standard')}
          </span>
          <select
            value={powerStandard ?? DEFAULT_POWER_STANDARD}
            onChange={(e) =>
              updateProjectMetadata({ defaultPowerStandard: e.target.value as PowerStandardId })
            }
            className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
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
            {t('settings.project.defaults.lighting', 'Lighting control (default)')}
          </span>
          <select
            value={lightingControl ?? 'dmx512'}
            onChange={(e) =>
              updateProjectMetadata({
                defaultLightingControl: e.target.value as 'dmx512' | 'artnet' | 'sacn',
              })
            }
            className="w-full border border-cp-border bg-cp-surface-3 p-1.5"
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
          'Project metadata — saved with the Cable Planner file.',
        )}
      </p>
      <label className="block text-cp-base">
        {t('settings.project.name', 'Project name')}
        <input
          type="text"
          value={draftMeta.name}
          onChange={(e) => setDraftMeta({ ...draftMeta, name: e.target.value })}
          className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
          placeholder={t('settings.project.name', 'Project name')}
        />
      </label>
      <label className="block text-cp-base">
        {t('settings.project.description', 'Description')}
        <textarea
          value={draftMeta.description ?? ''}
          onChange={(e) => setDraftMeta({ ...draftMeta, description: e.target.value })}
          rows={3}
          className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
          placeholder={t(
            'settings.project.descriptionPlaceholder',
            'Optional project description',
          )}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-cp-base">
          {t('settings.project.client', 'Client')}
          <input
            type="text"
            value={draftMeta.client ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, client: e.target.value })}
            className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
            placeholder={t('settings.project.clientPlaceholder', 'End customer')}
          />
        </label>
        <label className="block text-cp-base">
          {t('settings.project.contractor', 'Contractor')}
          <input
            type="text"
            value={draftMeta.contractor ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, contractor: e.target.value })}
            className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
            placeholder={t('settings.project.contractorPlaceholder', 'Executing company')}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-cp-base">
          {t('settings.project.author', 'Author')}
          <input
            type="text"
            value={draftMeta.author ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, author: e.target.value })}
            className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
            placeholder={t('settings.project.authorPlaceholder', 'Your name')}
          />
        </label>
        <label className="block text-cp-base">
          {t('settings.project.number', 'Project no.')}
          <input
            type="text"
            value={draftMeta.projectNumber ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, projectNumber: e.target.value })}
            className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
            placeholder={t('settings.project.numberPlaceholder', 'e.g. 2026-042')}
          />
        </label>
      </div>

      <PlanDefaultsSection />

      <SettingsCard
        title={t('settings.project.logos', 'Plan signature (logos)')}
        description={t(
          'settings.project.logosHint',
          'Logos are stored as data URI in the project file (PDF export & canvas signature).',
        )}
      >
        <div className="grid grid-cols-2 gap-3">
          {(['companyLogo', 'clientLogo'] as const).map((field) => {
            const label =
              field === 'companyLogo'
                ? t('settings.project.logo.contractor', 'Contractor')
                : t('settings.project.logo.client', 'Client')
            const current = draftMeta[field]
            return (
              <div key={field} className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-full items-center justify-center overflow-hidden border border-cp-border bg-white/5">
                  {current ? (
                    <img src={current} alt={label} className="max-h-16 max-w-full object-contain" />
                  ) : (
                    <span className="text-cp-xs text-cp-text-muted">{label}</span>
                  )}
                </div>
                <div className="flex w-full gap-1">
                  <button
                    type="button"
                    onClick={() => pickLogo(field)}
                    className="flex-1 bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
                  >
                    {t('common.choose', 'Choose…')}
                  </button>
                  {current && (
                    <button
                      type="button"
                      onClick={() => setDraftMeta((prev) => ({ ...prev, [field]: undefined }))}
                      title={t('common.remove', 'Remove')}
                      aria-label={t('common.remove', 'Remove')}
                      className="bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-muted hover:bg-red-700 hover:text-white"
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

      <SettingsCard title={t('settings.project.linkedRentman', 'Linked Rentman project')}>
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
              'No Rentman project linked. Link via the “Integrations” tab.',
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
          className="bg-cp-surface-4 px-3 py-1 text-cp-base hover:bg-cp-surface-5"
        >
          {t('common.reset', 'Reset')}
        </button>
        <button
          type="button"
          onClick={persistMeta}
          className="bg-emerald-600 px-3 py-1 text-cp-base hover:bg-emerald-500"
        >
          {t('common.save', 'Save')}
        </button>
      </div>
    </div>
  )
}
