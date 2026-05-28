import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { detectNetworkDevice } from '../../lib/deviceKind'
import { generateShortName } from '../../lib/shortName'
import { promptDialog } from '../../lib/promptDialog'
import { confirmDialog } from '../../lib/confirmDialog'
import { infoDialog } from '../../lib/infoDialog'
import { exportDevicePatchSheet } from '../../lib/exportDevicePdf'
import { RackImageCropDialog } from '../Rack/RackImageCropDialog'
import { CategorySelect } from '../shared/CategorySelect'
import { pickImageAsDataUri } from '../../lib/readImageAsDataUri'
import { useTranslation } from '../../lib/i18n'
import { SortableSection } from './SortableSection'
import { DimensionsSection } from './sections/DimensionsSection'
import { PowerConsumptionSection } from './sections/PowerConsumptionSection'
import { DisplayPropertiesBlock } from './sections/DisplayPropertiesBlock'
import { DeviceConfigsBlock } from './sections/DeviceConfigsBlock'
import { NetworkConfig } from './sections/NetworkConfig'
import { NetworkAccessSection } from './sections/NetworkAccessSection'
import { DeviceKindCards } from './sections/DeviceKindCards'
import { OptionalFieldsSection } from './sections/OptionalFieldsSection'
import { DisplayFlagsSection } from './sections/DisplayFlagsSection'
import { RentmanSyncBadge } from './sections/RentmanSyncBadge'
import { PortsSection } from './sections/PortsSection'
import { RackFacePreview } from './sections/RackFacePreview'
import { DimensionsBlock } from './sections/DimensionsBlock'
import { DeviceModePicker } from './sections/DeviceModePicker'

/** Module-level sensor options so re-renders don't churn the sensor
 *  instances. Stable references are critical for DnDContext's
 *  internal subscriptions — fresh sensor objects on every render
 *  was a known #185 contributor before. */
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 6 } } as const
const KEYBOARD_SENSOR_OPTIONS = {
  coordinateGetter: sortableKeyboardCoordinates,
} as const

/**
 * v7.4.0 / v7.6.0 — drag-reorderable accordion section. Each section
 * lives in its own `<details>` for independent collapse, and uses
 * dnd-kit's `useSortable` to participate in the parent's drag
 * context. We rely on `useSortable`'s `index` (the position in the
 * SortableContext items array) for CSS `order` so that ALL sections
 * don't need to subscribe to the uiStore order array — that was
 * causing every section to re-render on every reorder and possibly
 * trigping React #185 during heavy drag activity.
 *
 * The `⋮⋮` handle on the summary triggers drag via spread attributes
 * + listeners (dnd-kit's contract); the rest of the summary keeps
 * the click-to-toggle behaviour for the accordion.
 */
// SortableSection lebt in eigener Datei (#306).



// v7.9.7 — Device-Level "SDI Fähigkeiten" Block entfernt. Quad-Link
// passiert jetzt pro Port via `port.quadLinkGroup`. Level A/B + Max
// Single-Link bleiben pro BNC-Port erhalten. Falls die Device-Level
// API noch von Importern / Exportern gelesen wird (z.B. Rentman-
// Templates), bleibt das Datenmodell-Feld `equipment.sdiCaps`
// vorerst bestehen — nur die UI ist weg.



/**
 * Monitor/display properties block (resolution + size).
 * Shown when the device looks like a display based on category, name, or
 * when the user has already set one of these fields.
 */
/**
 * v7.9.131 / Issue #216 — Physische Geraete-Dimensionen (Hoehe x Breite x Tiefe).
 * Optional, nur zur Information / fuer spaetere 3D-Rack-Layouts. Schritt
 * waehlbar in mm. Tab-Reihenfolge: H -> B -> T.
 */


/**
 * v7.5.0 / v7.6.0 — Operating-mode picker + inline editor for multi-mode
 * devices (media servers, modular processors like Pixelhue P20, Parco
 * S3, Brompton Tessera).
 *
 * Workflow:
 *   1. Edit ports normally with the PortList accordion → layout A.
 *   2. Click "+ aus aktuellem Layout" → name it "Layout A". Now the
 *      current ports are captured as a mode, and that mode is active.
 *   3. Edit ports → layout B → "+ aus aktuellem Layout" → "Layout B".
 *   4. Switch modes via the cards. Each card has rename + delete.
 *
 * Switching activates the mode and copies its snapshot to the live
 * inputs/outputs (via setActiveDeviceMode in the store). Editing the
 * ports later doesn't automatically sync back to the mode — there's
 * an "Aktuelle Ports in Modus übernehmen" button per active mode for
 * that, so the user controls when a mode definition is updated.
 */

/**
 * v7.9.108 / Issue #225 — AI-Suggest-Button im Ports-Panel.
 *
 * Sitzt oben im Inputs/Outputs-Bereich der EquipmentProperties-Sidebar.
 * Klick → ruft suggestFromAI(equipment.name, equipment.category) via
 * den im Settings → AI konfigurierten Provider (Gemini / Claude /
 * OpenAI). Wenn die KI Port-Vorschlaege liefert, kann der User:
 *  - Vorhandene Ports ERSETZEN (zerstoerende Aktion, mit Confirm)
 *  - Vorschlaege ANHAENGEN an die bestehenden Ports (additive Aktion)
 * Fehler werden inline ausgegeben.
 */

/**
 * v7.9.105 / Issue #216 — Physische Dimensionen (Hoehe / Breite / Tiefe
 * in mm). Bisher waren widthMm/heightMm/depthMm im Schema definiert,
 * aber nur ueber den Rack-Builder editierbar. Jetzt auch im
 * Eigenschaften-Panel — sinnvoll fuer Rack-Planung, Logistik, Platzbedarf.
 */

export const EquipmentProperties = () => {
  const t = useTranslation()
  const selectedEquipmentId = useProjectStore((state) => state.selectedEquipmentId)
  const equipment = useProjectStore((state) =>
    state.project.equipment.find((item) => item.id === selectedEquipmentId),
  )
  // Reactive selector statt useProjectStore.getState() (das gibt's auf der
  // Context-Variante nicht). Werden in den Patch-Sheet-Druck-Buttons unten
  // benoetigt; durch Selector aktualisieren sich die PDFs automatisch wenn
  // sich Verkabelung aendert.
  const allEquipment = useProjectStore((state) => state.project.equipment)
  const allCables = useProjectStore((state) => state.project.cables)
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const saveEquipmentAsTemplate = useProjectStore((state) => state.saveEquipmentAsTemplate)
  const saveEquipmentAsNewTemplate = useProjectStore((state) => state.saveEquipmentAsNewTemplate)
  const [rackViewMode, setRackViewMode] = useState<'front' | 'rear' | 'both'>('front')
  const [cropDialog, setCropDialog] = useState<
    { side: 'front' | 'rear'; src: string } | null
  >(null)

  if (!equipment) {
    return <div className="text-xs text-slate-400">Select an equipment node.</div>
  }

  const networkKind = detectNetworkDevice(equipment)

  // v7.4.0 — sortable accordion sections. The parent is `flex flex-col`
  // so CSS `order` works. Non-movable elements (device-kind cards,
  // Name, Category, Rentman badge) have no `order` declared → they
  // default to 0 → render first in JSX order. Each SortableSection
  // sets its own `order` based on the uiStore-persisted user order.
  const sectionOrder = useUiStore((s) => s.equipmentSectionOrder)
  const setSectionOrder = useUiStore((s) => s.setEquipmentSectionOrder)
  const dragSensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  )
  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sectionOrder.indexOf(String(active.id))
    const newIndex = sectionOrder.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    setSectionOrder(arrayMove(sectionOrder, oldIndex, newIndex))
  }

  // v7.9.5 — Property-Panel im Lock-Modus visuell + funktional sperren.
  // fieldset/disabled blockiert ALLE Form-Controls darunter; das CSS
  // greift dann mit grauerem Look (pointer-events:none + opacity).
  const projectMode = useProjectStore((s) => s.project.mode ?? 'editing')
  const projectIsLocked = projectMode === 'finalized' || projectMode === 'viewer'

  return (
    <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
    <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
    <fieldset
      disabled={projectIsLocked}
      className="flex flex-col gap-3 text-xs disabled:cursor-default disabled:opacity-60"
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
    >
      {projectIsLocked && (
        <div className="rounded border border-amber-700/60 bg-amber-900/30 px-2 py-1.5 text-[11px] text-amber-200">
          {projectMode === 'viewer'
            ? 'Viewer-Modus — Felder können nicht bearbeitet werden.'
            : 'Plan abgeschlossen — Felder gesperrt. Im Canvas-Banner „Bearbeitung freigeben" klicken.'}
        </div>
      )}
      <DeviceKindCards equipment={equipment} />
      <label className="block">
        <span className="mb-1 block text-slate-300">{t('eq.field.name', 'Name')}</span>
        <input
          value={equipment.name}
          onChange={(event) => updateEquipment(equipment.id, { name: event.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>

      {/* v7.9.127 — Short-Form-Name. Wird in platzknappen Kontexten
          benutzt (Cable-Endpoint-Labels, Patch-Sheets). Wenn leer:
          auto-generiert aus name (Placeholder zeigt den Vorschlag).
          Refresh-Button setzt den Override auf den Auto-Vorschlag. */}
      {(() => {
        const autoSuggestion = generateShortName(equipment.name)
        return (
          <label className="block">
            <span className="mb-1 block text-slate-300">
              {t('eq.field.shortName', 'Short-Name')}{' '}
              <span className="text-slate-500">
                ({t('common.optional', 'optional')},{' '}
                {t(
                  'eq.field.shortNameHint',
                  'fuer Port-/Endpoint-Labels — z.B. "ATEM8K" statt "ATEM Constellation 8K"',
                )}
                )
              </span>
            </span>
            <div className="flex gap-1">
              <input
                value={equipment.shortName ?? ''}
                placeholder={autoSuggestion || t('eq.field.shortNamePlaceholder', 'Kurzform…')}
                onChange={(event) =>
                  updateEquipment(equipment.id, {
                    shortName: event.target.value || undefined,
                  })
                }
                className="flex-1 rounded border border-slate-700 bg-slate-900 p-2"
              />
              <button
                type="button"
                onClick={() =>
                  updateEquipment(equipment.id, { shortName: autoSuggestion || undefined })
                }
                disabled={!autoSuggestion}
                title={
                  autoSuggestion
                    ? `${t('eq.field.shortNameAuto', 'Aus Namen neu generieren')} (${autoSuggestion})`
                    : t('eq.field.shortNameAutoEmpty', 'Kein Vorschlag — Name pflegen.')
                }
                className="shrink-0 rounded border border-slate-700 bg-slate-800 px-2 text-xs text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('eq.field.shortNameAutoBtn', '↻ auto')}
              </button>
            </div>
            {!equipment.shortName?.trim() && autoSuggestion && (
              <p className="mt-1 text-[10px] text-slate-500">
                {t('eq.field.shortNameAutoUsed', 'Verwendet automatisch:')}{' '}
                <span className="font-mono text-slate-400">{autoSuggestion}</span>
              </p>
            )}
          </label>
        )
      })()}

      <label className="block">
        <span className="mb-1 block text-slate-300">
          {t('eq.field.subtitle', 'Untertitel')}{' '}
          <span className="text-slate-500">
            ({t('common.optional', 'optional')}, {t('eq.field.subtitleHint', 'z.B. "PGM Monitor"')})
          </span>
        </span>
        <input
          value={equipment.subtitle ?? ''}
          placeholder={t('eq.field.subtitlePlaceholder', 'Untertitel…')}
          onChange={(event) => updateEquipment(equipment.id, { subtitle: event.target.value || undefined })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>

      <OptionalFieldsSection equipment={equipment} />

      <DisplayFlagsSection equipment={equipment} />

      <RentmanSyncBadge equipment={equipment} />
      <label className="block">
        <span className="mb-1 block text-slate-300">{t('eq.field.category', 'Kategorie')}</span>
        <CategorySelect
          value={equipment.category}
          onChange={(category) => updateEquipment(equipment.id, { category })}
          extraOptions={[equipment.category]}
        />
      </label>

      <DisplayPropertiesBlock equipment={equipment} />
      <DimensionsBlock equipment={equipment} />

      <NetworkAccessSection equipment={equipment} />

      <PowerConsumptionSection equipment={equipment} />

      {/* v7.9.105 / Issue #216 — Physische Dimensionen (Breite/Höhe/Tiefe). */}
      <DimensionsSection equipment={equipment} />

      {networkKind && (
        <SortableSection
          id="network-config"
          title={networkKind === 'router' ? 'Router Config' : 'Switch Config'}
          subtitle="VLAN · Port-Map · Gateway"
        >
          <NetworkConfig
            equipmentId={equipment.id}
            item={equipment}
            allPorts={[...equipment.inputs, ...equipment.outputs]}
            kind={networkKind}
          />
        </SortableSection>
      )}

      <SortableSection
        id="modes"
        title="Betriebsmodi"
        subtitle={
          (equipment.modes ?? []).length === 0
            ? 'keiner — anlegen unten'
            : (equipment.modes?.find((m) => m.id === equipment.activeModeId)?.name ??
              `${equipment.modes?.length} definiert`)
        }
      >
        <DeviceModePicker equipment={equipment} />
      </SortableSection>

      <PortsSection equipment={equipment} />

      <SortableSection
        id="rack"
        title={`Rack / 19" Einstellungen`}
        subtitle={equipment.isRackDevice ? `${equipment.rackUnits ?? 1} HE` : 'nicht aktiv'}
        defaultOpen={!!equipment.isRackDevice}
      >
        <fieldset className="border-0 p-0">
        <label className="mb-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={!!equipment.isRackDevice}
            onChange={(event) =>
              updateEquipment(equipment.id, {
                isRackDevice: event.target.checked,
                rackUnits: event.target.checked ? equipment.rackUnits ?? 1 : undefined,
              })
            }
          />
          <span>Ist ein 19" Rack-Gerät</span>
        </label>

        {!equipment.isRackDevice && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-2 text-[11px] text-slate-400">
            Rack-Felder erscheinen nur, wenn das Gerät als 19" Rack-Gerät markiert ist.
          </div>
        )}

        {equipment.isRackDevice && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-slate-300">Hohe (HE)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={equipment.rackUnits ?? 1}
                  onChange={(event) =>
                    updateEquipment(equipment.id, {
                      rackUnits: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-slate-300">Ansicht</span>
                <select
                  value={rackViewMode}
                  onChange={(event) => setRackViewMode(event.target.value as 'front' | 'rear' | 'both')}
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2"
                >
                  <option value="front">Nur vorne</option>
                  <option value="rear">Nur hinten</option>
                  <option value="both">Vorne + hinten</option>
                </select>
              </label>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  const dataUri = await pickImageAsDataUri('image/png,image/jpeg,image/webp')
                  if (dataUri) setCropDialog({ side: 'front', src: dataUri })
                }}
                className="rounded bg-sky-700 px-2 py-1 text-xs hover:bg-sky-600"
              >
                Frontgrafik importieren + zuschneiden
              </button>
              <button
                type="button"
                onClick={async () => {
                  const dataUri = await pickImageAsDataUri('image/png,image/jpeg,image/webp')
                  if (dataUri) setCropDialog({ side: 'rear', src: dataUri })
                }}
                className="rounded bg-purple-700 px-2 py-1 text-xs hover:bg-purple-600"
              >
                Reargrafik importieren + zuschneiden
              </button>
            </div>
            {/* v7.9.76 / #170 — Swap-Button: tauscht Front/Rear-Foto-
                Zuordnung am Gerät. Hilft wenn man versehentlich das
                falsche Foto als Front hochgeladen hat. Tauscht auch
                die Crop-Meta-Daten mit, damit der Zuschnitt erhalten
                bleibt. */}
            {(equipment.frontPanelImageUrl || equipment.rearPanelImageUrl) && (
              <button
                type="button"
                onClick={() =>
                  updateEquipment(equipment.id, {
                    frontPanelImageUrl: equipment.rearPanelImageUrl,
                    rearPanelImageUrl: equipment.frontPanelImageUrl,
                    frontPanelCrop: equipment.rearPanelCrop,
                    rearPanelCrop: equipment.frontPanelCrop,
                  })
                }
                className="mt-2 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                title="Front- und Rear-Foto vertauschen (samt Crop-Meta)"
              >
                ↔ Front-/Rear-Foto vertauschen
              </button>
            )}

            {equipment.netboxPath && (
              <div className="mt-2 text-[10px] text-slate-500">
                Quelle: NetBox device-type-library · {equipment.netboxPath}
              </div>
            )}

            <RackFacePreview equipment={equipment} viewMode={rackViewMode} />
          </>
        )}
        </fieldset>
      </SortableSection>

      <SortableSection
        id="library"
        title="Bibliothek"
        subtitle="als Vorlage speichern"
      >
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={async () => {
              const existing = customLibrary.find((t) => t.name === equipment.name)
              const ok = existing
                ? await confirmDialog(`"${equipment.name}" überschreiben?`, {
                    body: 'Existiert bereits in der Bibliothek. Mit den aktuellen Einstellungen dieses Geräts überschreiben?',
                    okLabel: 'Überschreiben',
                    destructive: true,
                  })
                : await confirmDialog(`"${equipment.name}" speichern?`, {
                    body: 'Als neue Standard-Vorlage in der Bibliothek speichern.',
                  })
              if (ok) {
                saveEquipmentAsTemplate(equipment.id)
              }
            }}
            className="w-full rounded bg-amber-700 px-2 py-1 text-xs hover:bg-amber-600"
            title="Speichert das aktuelle Gerät (Ports, Netzwerk, SDI-Caps, MV-Config …) als Vorlage in der Bibliothek."
          >
            {customLibrary.find((t) => t.name === equipment.name)
              ? 'Als Standard-Vorlage überschreiben ↺'
              : 'Als neue Standard-Vorlage speichern ✚'}
          </button>
          <button
            type="button"
            onClick={async () => {
              const suggestion = `${equipment.name} (Custom)`
              const input = await promptDialog(
                'Als neues Gerät in der Bibliothek speichern.\nName:',
                suggestion,
              )
              if (!input) return
              const trimmed = input.trim()
              if (!trimmed) return
              if (customLibrary.some((t) => t.name === trimmed)) {
                await infoDialog(`"${trimmed}" existiert bereits`, {
                  body: 'Bitte einen anderen Namen wählen oder die bestehende Vorlage überschreiben.',
                  tone: 'warning',
                })
                return
              }
              saveEquipmentAsNewTemplate(equipment.id, trimmed, equipment.category)
            }}
            className="w-full rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
            title="Erstellt eine neue Vorlage unter anderem Namen — bestehende bleibt unverändert."
          >
            Als neues Gerät in Library speichern ✚
          </button>
        </div>
      </SortableSection>

      {equipment.rackInstanceId && (
        <div className="rounded border border-cyan-700 bg-cyan-950/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-cyan-300">
            Rack-Instanz · {equipment.rackInstanceLabel ?? 'Rack'}
          </div>
          <p className="mb-2 text-[10px] text-slate-400">
            Dieses Gerät gehört zu einer Rack-Instanz. Der Rack-Editor zeigt eine
            gefilterte Sub-Canvas mit nur diesem Rack — Änderungen an der Position werden
            beim Loslassen auf ganze HU gerundet.
          </p>
          <button
            type="button"
            onClick={() => useUiStore.getState().openRackEditor(equipment.rackInstanceId!)}
            className="w-full rounded bg-cyan-700 px-2 py-1 text-xs text-white hover:bg-cyan-600"
          >
            🗄 Rack-Editor öffnen
          </button>
          {typeof equipment.rackInstanceStartUnit === 'number' && (
            <div className="mt-1 text-[10px] text-slate-500">
              Position: ab HU {equipment.rackInstanceStartUnit + 1}
              {equipment.rackUnits ? ` (${equipment.rackUnits} HE)` : ''}
            </div>
          )}
        </div>
      )}

      <DeviceConfigsBlock equipmentId={equipment.id} />

      <SortableSection
        id="print"
        title="Druck / Dokumentation"
        subtitle="Patch-Sheet A4/A3"
      >
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() =>
              void exportDevicePatchSheet(equipment, allEquipment, allCables, {
                format: 'a4',
              })
            }
            className="w-full rounded bg-sky-700 px-2 py-1 text-xs text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            title="Erzeugt eine einseitige A4-Patch-Liste mit allen Ports + verbundenen Kabeln — zum Aufkleben am Gerät."
          >
            🖨 Patch-Sheet (A4 PDF) drucken
          </button>
          <button
            type="button"
            onClick={() =>
              void exportDevicePatchSheet(equipment, allEquipment, allCables, {
                format: 'a3',
              })
            }
            className="w-full rounded bg-sky-800 px-2 py-1 text-xs text-white hover:bg-sky-700"
            title="A3-Variante für Geräte mit vielen Ports."
          >
            🖨 Patch-Sheet (A3 PDF) drucken
          </button>
        </div>
      </SortableSection>

      <RackImageCropDialog
        open={!!cropDialog}
        imageSrc={cropDialog?.src ?? null}
        rackUnits={equipment.rackUnits ?? 1}
        side={cropDialog?.side ?? 'front'}
        onCancel={() => setCropDialog(null)}
        onConfirm={({ dataUrl, crop }) => {
          if (!cropDialog) return
          if (cropDialog.side === 'front') {
            updateEquipment(equipment.id, { frontPanelImageUrl: dataUrl, frontPanelCrop: crop })
          } else {
            updateEquipment(equipment.id, { rearPanelImageUrl: dataUrl, rearPanelCrop: crop })
          }
          setCropDialog(null)
        }}
      />
    </fieldset>
    </SortableContext>
    </DndContext>
  )
}
