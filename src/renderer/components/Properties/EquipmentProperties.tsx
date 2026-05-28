import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { detectDeviceKind, detectNetworkDevice } from '../../lib/deviceKind'
import { generateShortName } from '../../lib/shortName'
import { promptDialog } from '../../lib/promptDialog'
import { confirmDialog } from '../../lib/confirmDialog'
import { infoDialog } from '../../lib/infoDialog'
import { exportDevicePatchSheet } from '../../lib/exportDevicePdf'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import { effectivePortNumber, findDuplicatePortNumbers } from '../../lib/portNumbering'
import type { ConnectorType, Port } from '../../types/equipment'
import { ALL_SIGNAL_STANDARDS } from '../../types/cableSpec'
import type { SignalStandard } from '../../types/cableSpec'
import { RackImageCropDialog } from '../Rack/RackImageCropDialog'
import { CategorySelect } from '../shared/CategorySelect'
import { ColorField } from '../shared/ColorField'
import { pickImageAsDataUri } from '../../lib/readImageAsDataUri'
import { useTranslation } from '../../lib/i18n'
import { SortableSection } from './SortableSection'
import { DimensionsSection } from './sections/DimensionsSection'
import { PowerConsumptionSection } from './sections/PowerConsumptionSection'
import { DisplayPropertiesBlock } from './sections/DisplayPropertiesBlock'
import { GreenGoBeltpackSection } from './sections/GreenGoBeltpackSection'
import { DeviceConfigsBlock } from './sections/DeviceConfigsBlock'
import { NetworkConfig } from './sections/NetworkConfig'
import { RackFacePreview } from './sections/RackFacePreview'
import { DimensionsBlock } from './sections/DimensionsBlock'
import { PortAiSuggestButton } from './sections/PortAiSuggestButton'
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

const makePort = (name: string): Port => ({
  id: uuidv4(),
  name,
  type: 'Custom',
  connectorType: 'Custom',
})

interface PortListProps {
  title: string
  ports: Port[]
  onChange: (ports: Port[]) => void
  /** v7.9.63 / #185 — Wenn die PortList in einem details-Wrapper liegt
   *  der bereits Titel + Count zeigt, lassen wir die interne Headline
   *  weg um doppelten Text zu vermeiden. */
  hideTitle?: boolean
  /** v7.9.126 — Zeigt pro Port ein "ATEM Source-ID"-Input. Notwendig
   *  fuer offline-MV-Setup auf Outputs (AUX 8001+, PGM 10010, PVW
   *  10011, ME-Outs 10020+) damit der MV-Picker sie kennt. Wird vom
   *  Eltern-Component nur fuer ATEM-Devices gesetzt. */
  showAtemSourceId?: boolean
}

interface SortablePortItemProps {
  port: Port
  children: React.ReactNode
}

const SortablePortItem = ({ port, children }: SortablePortItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: port.id })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`rounded border border-slate-800 bg-slate-900 p-2 ${isDragging ? 'opacity-60 shadow-lg shadow-slate-950/50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 cursor-grab rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-400 hover:bg-slate-900 active:cursor-grabbing"
          title="Port-Reihenfolge ändern"
          aria-label={`Reorder ${port.name}`}
          {...attributes}
          {...listeners}
        >
          ≡
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </li>
  )
}

const PortList = ({ title, ports, onChange, hideTitle, showAtemSourceId }: PortListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  // v7.9.3 — gleiche Custom-Stecker/Signal-Logik wie im Kabeltyp-Editor.
  // Beides nutzt jetzt die gleiche Quelle: useUiStore.customConnectorTypes
  // und customSignalStandards (User-Request: "das greift ja alles auf die
  // gleiche kabel stecker und signaltyp logik zu").
  const customConnectorTypes = useUiStore((s) => s.customConnectorTypes)
  const addCustomConnectorType = useUiStore((s) => s.addCustomConnectorType)
  const customSignalStandards = useUiStore((s) => s.customSignalStandards)
  const addCustomSignalStandard = useUiStore((s) => s.addCustomSignalStandard)
  const allConnectorTypeOptions = useMemo(
    () =>
      [
        ...ALL_CONNECTOR_TYPES,
        ...customConnectorTypes.filter((c) => !ALL_CONNECTOR_TYPES.includes(c as ConnectorType)),
      ] as ConnectorType[],
    [customConnectorTypes],
  )
  const allSignalStandardOptions = useMemo(
    () =>
      [
        ...ALL_SIGNAL_STANDARDS,
        ...customSignalStandards.filter((s) => !ALL_SIGNAL_STANDARDS.includes(s as SignalStandard)),
      ] as SignalStandard[],
    [customSignalStandards],
  )

  // v7.9.63 / #175 — Default-Port-Name-Pattern. Wenn der User noch nicht
  // umbenannt hat (Name = "Input 1", "Output 2", "In 3", "Out 4"), wird
  // bei Wechsel von Connector-Type oder Signal-Standard automatisch
  // ein passender Name vorgeschlagen (z.B. "SDI 1" statt "Input 1").
  // Hat der User schon einen Custom-Namen vergeben, wird er nicht
  // überschrieben.
  const DEFAULT_NAME_PATTERN = /^(input|output|in|out)\s*\d*$/i
  const isDefaultName = (name: string): boolean =>
    DEFAULT_NAME_PATTERN.test(name.trim())
  const renameIfDefault = (portId: string, prefix: string) => {
    const port = ports.find((p) => p.id === portId)
    if (!port || !isDefaultName(port.name)) return null
    // Index aus dem aktuellen Default-Namen ziehen, sonst Index im Array.
    const numMatch = port.name.match(/\d+/)
    const idx = numMatch ? numMatch[0] : String(ports.indexOf(port) + 1)
    return `${prefix} ${idx}`.trim()
  }

  const updatePort = (portId: string, patch: Partial<Port>) => {
    // v7.9.63 / #175 — Auto-Rename ankoppeln. Wenn der User connectorType
    // oder standard ändert UND der Name noch der Default ist, schlagen
    // wir einen besseren vor. Das passiert IM SELBEN Patch damit
    // Undo/Redo es als einen Schritt sieht.
    let nameOverride: string | null = null
    if (patch.connectorType !== undefined && patch.name === undefined) {
      nameOverride = renameIfDefault(portId, String(patch.connectorType))
    }
    if (!nameOverride && patch.standard !== undefined && patch.name === undefined) {
      nameOverride = renameIfDefault(portId, String(patch.standard))
    }
    const finalPatch = nameOverride ? { ...patch, name: nameOverride } : patch
    onChange(ports.map((port) => (port.id === portId ? { ...port, ...finalPatch } : port)))
  }
  const addPort = () => onChange([...ports, makePort(`${title.slice(0, -1)} ${ports.length + 1}`)])
  const removePort = (portId: string) => onChange(ports.filter((port) => port.id !== portId))

  // v7.9.7 — Quad-Link Set Helpers. Ein Set besteht aus 4 BNC-Ports auf
  // derselben Seite (Inputs ODER Outputs) mit gleichem quadLinkGroup-ID.
  // Die Sets werden pro Seite verwaltet — eine Kamera mit Quad-Out hat
  // ihre 4 BNC-Outs als ein Set; ein Monitor mit Quad-In dito.
  const existingQuadGroups = useMemo(() => {
    const set = new Set<string>()
    for (const p of ports) {
      if (p.quadLinkGroup) set.add(p.quadLinkGroup)
    }
    return Array.from(set).sort()
  }, [ports])
  const quadGroupCount = (g: string): number =>
    ports.filter((p) => p.quadLinkGroup === g).length
  const nextQuadGroupId = (): string => {
    let i = 1
    while (existingQuadGroups.includes(`QL-${i}`)) i++
    return `QL-${i}`
  }
  const autoFillQuadGroup = async (g: string, sourcePortId: string) => {
    const haveCount = quadGroupCount(g)
    const needed = 4 - haveCount
    if (needed <= 0) return
    const freeBncPorts = ports.filter(
      (p) => p.id !== sourcePortId && p.connectorType === 'BNC' && !p.quadLinkGroup,
    )
    if (freeBncPorts.length === 0) {
      await infoDialog(`Quad-Link Set ${g} unvollständig`, {
        body: `Hat nur ${haveCount}/4 Ports. Keine weiteren freien BNC-Ports verfügbar — bitte zuerst BNC-Ports hinzufügen oder bestehende freigeben.`,
        tone: 'warning',
      })
      return
    }
    const ok = await confirmDialog(
      `Quad-Link Set ${g} ergänzen?`,
      {
        body: `Aktuell ${haveCount}/4 Ports. ${Math.min(needed, freeBncPorts.length)} weitere freie BNC-Ports automatisch dem Set zuweisen?`,
        okLabel: 'Ja, ergänzen',
      },
    )
    if (!ok) return
    const toAdd = new Set(freeBncPorts.slice(0, needed).map((p) => p.id))
    onChange(
      ports.map((p) =>
        toAdd.has(p.id) ? { ...p, quadLinkGroup: g } : p,
      ),
    )
  }
  const assignQuadGroup = async (portId: string, raw: string) => {
    if (raw === '__new__') {
      const newId = nextQuadGroupId()
      const updated = ports.map((p) =>
        p.id === portId ? { ...p, quadLinkGroup: newId } : p,
      )
      onChange(updated)
      // Direkt im Anschluss versuchen, das Set zu vervollständigen.
      // Wir nutzen einen Microtask damit `ports` im autoFill noch
      // den frischen Wert hat — autoFillQuadGroup verlässt sich auf
      // den aktuellen `ports`-Closure-Wert, daher pre-compute hier.
      const haveCount = updated.filter((p) => p.quadLinkGroup === newId).length
      const freeBncPorts = updated.filter(
        (p) =>
          p.id !== portId &&
          p.connectorType === 'BNC' &&
          !p.quadLinkGroup,
      )
      const needed = 4 - haveCount
      if (needed > 0 && freeBncPorts.length > 0) {
        const ok = await confirmDialog(
          `Quad-Link Set ${newId} anlegen?`,
          {
            body: `1/4 Ports gesetzt. ${Math.min(needed, freeBncPorts.length)} weitere freie BNC-Ports automatisch dem Set zuweisen?`,
            okLabel: 'Ja, ergänzen',
          },
        )
        if (ok) {
          const toAdd = new Set(freeBncPorts.slice(0, needed).map((p) => p.id))
          onChange(
            updated.map((p) =>
              toAdd.has(p.id) ? { ...p, quadLinkGroup: newId } : p,
            ),
          )
        }
      } else if (needed > 0) {
        await infoDialog(`Quad-Link Set ${newId} angelegt`, {
          body: `Hat aktuell ${haveCount}/4 Ports. Bitte weitere BNC-Ports anlegen und ebenfalls dem Set zuweisen.`,
          tone: 'info',
        })
      }
      return
    }
    updatePort(portId, { quadLinkGroup: raw || undefined })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ports.findIndex((port) => port.id === active.id)
    const newIndex = ports.findIndex((port) => port.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(ports, oldIndex, newIndex))
  }

  // Issue #251 — Doppelte Anzeige-Nummern erkennen damit der User
  // sich nicht versehentlich zwei "Port 3" anlegt (passiert leicht wenn
  // er manuell ueberschreibt). Anzeige als Warnbox oben in der Liste.
  const duplicatePortNumbers = useMemo(
    () => findDuplicatePortNumbers(ports),
    [ports],
  )
  // Touch-Use damit der Linter effectivePortNumber-Import nicht weg-shaket
  // (wird im JSX nicht direkt referenziert da wir den Array-Index als
  // Placeholder zeigen — die Effektiv-Nummer fliesst in andere Module).
  void effectivePortNumber

  return (
    <div className="rounded border border-slate-700 p-2">
      <div className="mb-2 flex items-center justify-between">
        {/* v7.9.63 / #185 — Wrapper-Details liefert eigene Headline mit
            Count; PortList-Title hier ausgeblendet damit's nicht doppelt
            steht. Bei direkter Verwendung (ohne Wrapper) bleibt der
            Titel sichtbar. */}
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">{hideTitle ? '' : title}</span>
        <button
          type="button"
          onClick={addPort}
          className="rounded bg-slate-700 px-2 py-0.5 text-[11px] hover:bg-slate-600"
        >
          + Add
        </button>
      </div>
      {ports.length === 0 && <div className="text-[11px] text-slate-500">None</div>}
      {duplicatePortNumbers.length > 0 && (
        <div className="mb-2 rounded border border-amber-700 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-200">
          Doppelte Port-Nummern: {duplicatePortNumbers.join(', ')} — fuer Beschriftung/Patchliste mehrdeutig.
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ports.map((port) => port.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
        {ports.map((port, portIdx) => (
          <SortablePortItem key={port.id} port={port}>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                value={port.portNumber ?? ''}
                onChange={(event) => {
                  const raw = event.target.value.trim()
                  const n = raw === '' ? undefined : Math.max(1, Math.floor(Number(raw)))
                  updatePort(port.id, {
                    portNumber: Number.isFinite(n as number) ? (n as number) : undefined,
                  })
                }}
                placeholder={String(portIdx + 1)}
                title={`Anzeige-Nummer (Default ${portIdx + 1}). Leer = automatisch.`}
                className="w-12 shrink-0 rounded border border-slate-700 bg-slate-950 p-1 text-center text-xs tabular-nums"
              />
              <input
                value={port.name}
                onChange={(event) => updatePort(port.id, { name: event.target.value })}
                placeholder="Port name"
                className="flex-1 rounded border border-slate-700 bg-slate-950 p-1 text-xs"
              />
              <button
                type="button"
                onClick={() => removePort(port.id)}
                title="Remove port"
                className="rounded bg-red-900/60 px-2 py-1 text-[11px] hover:bg-red-800"
              >
                ×
              </button>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <div className="flex items-stretch gap-0.5">
                <select
                  aria-label="Connector type"
                  value={port.connectorType}
                  onChange={async (event) => {
                    const v = event.target.value
                    if (v === '__new__') {
                      const name = (await promptDialog('Neuer Stecker-Typ (z.B. "Speakon NL4"):'))?.trim()
                      if (name) {
                        addCustomConnectorType(name)
                        updatePort(port.id, { connectorType: name as ConnectorType, type: name })
                      }
                      return
                    }
                    updatePort(port.id, {
                      connectorType: v as ConnectorType,
                      type: v,
                    })
                  }}
                  className="flex-1 rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                >
                  {allConnectorTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                      {customConnectorTypes.includes(type as string) ? ' (custom)' : ''}
                    </option>
                  ))}
                  <option value="__new__">+ Neuer Stecker-Typ…</option>
                </select>
              </div>
              <div className="flex items-stretch gap-0.5">
                <select
                  aria-label="Signal standard"
                  value={port.standard ?? ''}
                  onChange={async (event) => {
                    const v = event.target.value
                    if (v === '__new__') {
                      const name = (await promptDialog('Neuer Signal-Standard (z.B. "Dante Primary"):'))?.trim()
                      if (name) {
                        addCustomSignalStandard(name)
                        updatePort(port.id, { standard: name as SignalStandard })
                      }
                      return
                    }
                    updatePort(port.id, {
                      standard: v ? (v as SignalStandard) : undefined,
                    })
                  }}
                  className="flex-1 rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                >
                  <option value="">-</option>
                  {allSignalStandardOptions.map((std) => (
                    <option key={std} value={std}>
                      {std}
                      {customSignalStandards.includes(std as string) ? ' (custom)' : ''}
                    </option>
                  ))}
                  <option value="__new__">+ Neuer Standard…</option>
                </select>
              </div>
            </div>
            {/* #286 — Inhaltliches Label fuer das gefuehrte Signal (PGM,
                PVW, MV1, Cam1, Slot 3). Optional; bleibt leer wenn der
                Port kein semantisch fixes Signal traegt. Wenn gesetzt
                wird es auf dem Canvas als Haupt-Label gerendert und im
                ATEM-/Videohub-Export bevorzugt. */}
            <div className="mt-1">
              <input
                aria-label="Inhalt / Funktion"
                value={port.contentLabel ?? ''}
                onChange={(event) => {
                  const v = event.target.value
                  updatePort(port.id, { contentLabel: v ? v : undefined })
                }}
                placeholder="Inhalt / Funktion (z.B. PGM, PVW, MV1, Cam1) — optional"
                className="w-full rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                title="Was geht durch diesen Port? Trennt 'Inhalt' (PGM/PVW) vom Hardware-Standard (SDI 3G/12G)."
              />
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <select
                aria-label="Port direction"
                value={port.direction ?? ''}
                onChange={(event) =>
                  updatePort(port.id, {
                    direction: event.target.value
                      ? (event.target.value as 'in' | 'out' | 'bidirectional')
                      : undefined,
                  })
                }
                className="w-full rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                title="Richtung - bidirektional ist z.B. für Netzwerk-/RJ45-Ports sinnvoll"
              >
                <option value="">Richtung (auto)</option>
                <option value="in">Nur Input</option>
                <option value="out">Nur Output</option>
                <option value="bidirectional">Bidirektional (z.B. Netzwerk)</option>
              </select>
              <select
                aria-label="Port side"
                value={port.side ?? ''}
                onChange={(event) =>
                  updatePort(port.id, {
                    side: event.target.value ? (event.target.value as 'left' | 'right') : undefined,
                  })
                }
                className="w-full rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                title="Port-Seite am Gerät: Auto nutzt Input/Output + globale Spiegelung"
              >
                <option value="">Seite (auto)</option>
                <option value="left">Links</option>
                <option value="right">Rechts</option>
              </select>
            </div>
            {showAtemSourceId && (
              <div className="mt-1 flex items-center gap-1.5 rounded border border-emerald-900/60 bg-emerald-950/30 px-1.5 py-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  ATEM Source-ID
                </span>
                <input
                  type="number"
                  min={0}
                  max={99999}
                  value={port.atemSourceId ?? ''}
                  onChange={(event) => {
                    const v = event.target.value.trim()
                    updatePort(port.id, {
                      atemSourceId: v === '' ? undefined : Math.max(0, Number(v) || 0),
                    })
                  }}
                  placeholder="z.B. 8001 für AUX 1"
                  title="Source-ID die im MV-Config-Dialog adressiert wird. AUX = 8001+, PGM = 10010, PVW = 10011, ME 2 PGM = 10020 …. Bei Inputs leer lassen für idx+1-Default."
                  className="w-32 rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                />
                <span className="text-[10px] text-slate-400">
                  AUX 8001+ · PGM 10010 · PVW 10011
                </span>
              </div>
            )}
            {(port.connectorType === 'Fiber' || port.connectorType === 'SFP' || port.connectorType === 'SFP+') && (
              <div className="mt-1 rounded border border-sky-900/60 bg-sky-950/30 p-1.5">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-400">SFP-Modul</div>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    value={port.sfpType ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpType: event.target.value || undefined })}
                    placeholder="Formfaktor (SFP+)"
                    className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                    title="SFP-Formfaktor: SFP, SFP+, SFP28, QSFP+"
                  />
                  <input
                    value={port.sfpStandard ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpStandard: event.target.value || undefined })}
                    placeholder="Standard (10G-LR)"
                    className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                    title="Transceiver-Standard: 1G-SX, 1G-LX, 10G-SR, 10G-LR, 25G-SR …"
                  />
                  <input
                    value={port.sfpWavelength ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpWavelength: event.target.value || undefined })}
                    placeholder="Wellenlänge nm (1310)"
                    className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                    title="Wellenlänge in nm: 850, 1310, 1550"
                  />
                  <input
                    value={port.sfpVendor ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpVendor: event.target.value || undefined })}
                    placeholder="Hersteller (Cisco)"
                    className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                    title="Modulhersteller: Cisco, Aruba, Ubiquiti, FS.com …"
                  />
                </div>
              </div>
            )}
            {port.connectorType === 'BNC' && (
              <div className="mt-1 rounded border border-amber-900/60 bg-amber-950/20 p-1.5">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  SDI-Fähigkeiten (port-spezifisch)
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  {/* v7.9.63 / #176 — 3G Level A/B nur anzeigen wenn das
                      Port-Max tatsächlich SDI-3G ist. Für 6G/12G/HD sind die
                      Level-Optionen bedeutungslos und nur visueller Lärm. */}
                  {port.sdiCaps?.maxSingleLink === 'SDI-3G' && (
                    <>
                      <label className="flex items-center gap-1 text-slate-300">
                        <input
                          type="checkbox"
                          checked={!!port.sdiCaps?.levelA}
                          onChange={(e) =>
                            updatePort(port.id, {
                              sdiCaps: {
                                ...(port.sdiCaps ?? {}),
                                levelA: e.target.checked || undefined,
                              },
                            })
                          }
                        />
                        3G Level A
                      </label>
                      <label className="flex items-center gap-1 text-slate-300">
                        <input
                          type="checkbox"
                          checked={!!port.sdiCaps?.levelB}
                          onChange={(e) =>
                            updatePort(port.id, {
                              sdiCaps: {
                                ...(port.sdiCaps ?? {}),
                                levelB: e.target.checked || undefined,
                              },
                            })
                          }
                        />
                        3G Level B
                      </label>
                    </>
                  )}
                  <label className="col-span-2 block">
                    <span className="text-slate-400">Max Single-Link</span>
                    <select
                      value={port.sdiCaps?.maxSingleLink ?? ''}
                      onChange={(e) =>
                        updatePort(port.id, {
                          sdiCaps: {
                            ...(port.sdiCaps ?? {}),
                            maxSingleLink: (e.target.value || undefined) as NonNullable<
                              NonNullable<typeof port.sdiCaps>['maxSingleLink']
                            >,
                          },
                        })
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                    >
                      <option value="">(Geräte-Default)</option>
                      <option value="SDI-HD">SDI-HD (1.5G)</option>
                      <option value="SDI-3G">SDI-3G</option>
                      <option value="SDI-6G">SDI-6G</option>
                      <option value="SDI-12G">SDI-12G</option>
                    </select>
                  </label>
                </div>
                <div className="mt-1 text-[9px] text-slate-500">
                  Überschreibt die Geräte-SDI-Fähigkeiten für diesen Port.
                  Leer = Default vom Gerät.
                </div>
                {(() => {
                  const g = port.quadLinkGroup
                  const count = g ? quadGroupCount(g) : 0
                  const ok = count === 4
                  return (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px]">
                      <span className="text-slate-400">Quad-Link Set:</span>
                      <select
                        value={g ?? ''}
                        onChange={(e) => void assignQuadGroup(port.id, e.target.value)}
                        className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px]"
                      >
                        <option value="">— Kein —</option>
                        {existingQuadGroups.map((gid) => (
                          <option key={gid} value={gid}>{gid}</option>
                        ))}
                        <option value="__new__">+ Neues Set…</option>
                      </select>
                      {g && (
                        <>
                          <span
                            className={`rounded px-1 py-0.5 text-[9px] font-bold ${
                              ok
                                ? 'bg-emerald-900/60 text-emerald-300'
                                : 'bg-amber-900/60 text-amber-300'
                            }`}
                            title={ok ? 'Set komplett' : 'Set unvollständig — 4 Ports nötig'}
                          >
                            {count}/4
                          </span>
                          {!ok && (
                            <button
                              type="button"
                              onClick={() => void autoFillQuadGroup(g, port.id)}
                              className="rounded bg-sky-800 px-1 py-0.5 text-[9px] text-sky-100 hover:bg-sky-700"
                              title="Freie BNC-Ports automatisch dem Set zuweisen"
                            >
                              auto-fill
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </SortablePortItem>
        ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}


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
  const rentmanEnabled = useUiStore((state) => state.rentmanEnabled)
  const openVideohubExport = useUiStore((state) => state.openVideohubExport)
  const openGreenGoExport = useUiStore((state) => state.openGreenGoExport)
  const openAtemDialog = useUiStore((state) => state.openAtemDialog)
  const openAtemMvConfig = useUiStore((state) => state.openAtemMvConfig)
  const openAtemAudioConfig = useUiStore((state) => state.openAtemAudioConfig)
  const saveEquipmentAsTemplate = useProjectStore((state) => state.saveEquipmentAsTemplate)
  const saveEquipmentAsNewTemplate = useProjectStore((state) => state.saveEquipmentAsNewTemplate)
  const [rackViewMode, setRackViewMode] = useState<'front' | 'rear' | 'both'>('front')
  const [showPassword, setShowPassword] = useState(false)
  const [cropDialog, setCropDialog] = useState<
    { side: 'front' | 'rear'; src: string } | null
  >(null)

  if (!equipment) {
    return <div className="text-xs text-slate-400">Select an equipment node.</div>
  }

  const deviceKind = detectDeviceKind(equipment)
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
      {deviceKind === 'greengo' && (
        <div className="rounded border border-emerald-700 bg-emerald-900/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-emerald-300">
            GreenGo Intercom erkannt
          </div>
          <GreenGoBeltpackSection equipmentId={equipment.id} />
          <button
            type="button"
            onClick={() => openGreenGoExport()}
            className="w-full rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
          >
            Intercom-Planung / .gg5 exportieren →
          </button>
        </div>
      )}
      {deviceKind === 'videohub' && (
        <div className="rounded border border-purple-700 bg-purple-900/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-purple-300">
            Blackmagic Videohub erkannt
          </div>
          <div className="flex flex-col gap-1">
            {/* v7.9.128 — Vereinheitlicht: ein einziger Eintrag zum
                Videohub-Tool. Im Dialog selber kann der User offline
                Labels + Routing aufbauen und das Hub-Push (Labels,
                Routing, Beides, oder gar nicht) als separate Aktion
                ausloesen wenn er im Netz ist. */}
            <button
              type="button"
              onClick={() => openVideohubExport(equipment.id, true)}
              className="w-full rounded bg-purple-700 px-2 py-1 text-xs font-semibold hover:bg-purple-600"
            >
              🎚 Videohub konfigurieren · Labels + Routing →
            </button>
          </div>
        </div>
      )}
      {deviceKind === 'atem' && (
        <div className="rounded border border-sky-700 bg-sky-900/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-sky-300">
            Blackmagic ATEM erkannt
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => openAtemDialog(equipment.id)}
              className="w-full rounded bg-sky-700 px-2 py-1 text-xs hover:bg-sky-600"
              title="Verbindet per UDP mit dem ATEM und überträgt Input-Namen."
            >
              ATEM verbinden / Setup übertragen →
            </button>
            <button
              type="button"
              onClick={() => openAtemMvConfig(equipment.id)}
              className="w-full rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
              title="Multiviewer-Layout offline konfigurieren. Wird beim nächsten Connect übertragen."
            >
              Multiviewer-Layout konfigurieren →
            </button>
            <button
              type="button"
              onClick={() => openAtemAudioConfig(equipment.id)}
              className="w-full rounded bg-fuchsia-700 px-2 py-1 text-xs hover:bg-fuchsia-600"
              title="ATEM Audio-Router offline planen (Routing-Matrix oder klassischer Mixer)."
            >
              Audio-Router konfigurieren →
            </button>
          </div>
        </div>
      )}
      {deviceKind === 'multiviewer' && (
        <div className="rounded border border-emerald-700 bg-emerald-900/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-emerald-300">
            Multiviewer erkannt
          </div>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded bg-slate-700 px-2 py-1 text-xs opacity-60"
            title="Multiviewer-Layout Export kommt in v0.4.0"
          >
            Multiviewer Layout Export (v0.4.0)
          </button>
        </div>
      )}
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

      <SortableSection id="optional" title="Optionale Felder" subtitle="Hersteller-Link, Referenzbild, Icon">
        <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-slate-300">
          {t('eq.field.manufacturerUrl', 'Hersteller-Link')}{' '}
          <span className="text-slate-500">
            ({t('common.optional', 'optional')}, {t('eq.field.manufacturerUrlHint', 'für Datenblatt-Aufruf')})
          </span>
        </span>
        <div className="flex gap-1">
          <input
            type="url"
            value={equipment.manufacturerUrl ?? ''}
            placeholder="https://…"
            onChange={(event) =>
              updateEquipment(equipment.id, { manufacturerUrl: event.target.value || undefined })
            }
            className="flex-1 rounded border border-slate-700 bg-slate-900 p-2"
          />
          {equipment.manufacturerUrl && (
            <a
              href={equipment.manufacturerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-sky-700 px-2 py-1 text-xs hover:bg-sky-600"
              title={t('eq.field.manufacturerUrlOpenTitle', 'In externem Browser öffnen')}
            >
              {t('eq.field.manufacturerUrlOpen', 'Öffnen ↗')}
            </a>
          )}
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-slate-300">
          {t('eq.field.refImage', 'Referenzbild')}{' '}
          <span className="text-slate-500">({t('eq.field.refImageHint', 'z. B. Port-Belegung')})</span>
        </span>
        <div className="flex items-start gap-2">
          {equipment.imageUrl ? (
            <a
              href={equipment.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block max-h-24 max-w-[120px] overflow-hidden rounded border border-slate-700"
              title={t('eq.field.refImageFullsize', 'In voller Größe öffnen')}
            >
              <img src={equipment.imageUrl} alt="" className="max-h-24 max-w-[120px] object-contain" />
            </a>
          ) : (
            <div className="flex h-24 w-[120px] items-center justify-center rounded border border-dashed border-slate-700 text-[10px] text-slate-500">
              {t('eq.field.refImageNone', 'Kein Bild')}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={async () => {
                const dataUri = await pickImageAsDataUri()
                if (dataUri) updateEquipment(equipment.id, { imageUrl: dataUri })
              }}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              {equipment.imageUrl
                ? t('eq.field.refImageReplace', 'Ersetzen…')
                : t('common.choose', 'Auswählen…')}
            </button>
            {equipment.imageUrl && (
              <button
                type="button"
                onClick={() => updateEquipment(equipment.id, { imageUrl: undefined })}
                className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-red-700 hover:text-white"
              >
                {t('common.remove', 'Entfernen')}
              </button>
            )}
          </div>
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-slate-300">
          Icon <span className="text-slate-500">(Glyph oder Emoji, max 2 Zeichen — leer = automatisch)</span>
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <input
            value={equipment.icon ?? ''}
            placeholder="auto"
            onChange={(event) => {
              const v = event.target.value
              updateEquipment(equipment.id, { icon: v.length === 0 ? undefined : v.slice(0, 2) })
            }}
            className="w-20 rounded border border-slate-700 bg-slate-900 p-2 text-center text-base"
            maxLength={2}
          />
          {(['📷', '🖥', '💻', '📺', '🎙', '💡', '🌐', '⚡', '🔌', '🔧', '⇄'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => updateEquipment(equipment.id, { icon: g })}
              className={`rounded border px-1.5 py-1 text-base ${
                equipment.icon === g
                  ? 'border-sky-500 bg-sky-700/30'
                  : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
              }`}
              title={`Icon ${g}`}
            >
              {g}
            </button>
          ))}
          {equipment.icon && (
            <button
              type="button"
              onClick={() => updateEquipment(equipment.id, { icon: undefined })}
              className="rounded bg-slate-700 px-1.5 py-1 text-[10px] hover:bg-slate-600"
              title="Auf automatisch zurücksetzen"
            >
              auto
            </button>
          )}
        </div>
      </label>
        </div>
      </SortableSection>

      <SortableSection id="flags" title="Darstellung & Flags" subtitle="kompakt · Farbe · Ports spiegeln · gepackt">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[12px] text-slate-300">
            <input
              type="checkbox"
              checked={!!equipment.collapsed}
              onChange={(event) =>
                updateEquipment(equipment.id, { collapsed: event.target.checked || undefined })
              }
            />
            {t('eq.field.compact', 'Kompakte Darstellung')}{' '}
            <span className="text-slate-500">({t('eq.field.compactHint', 'nur Icon + Name, Ports als Punkte')})</span>
          </label>

          <ColorField
            layout="inline"
            label={t('eq.field.color', 'Gerätefarbe')}
            value={equipment.nodeColor ?? '#475569'}
            onChange={(nodeColor) => updateEquipment(equipment.id, { nodeColor })}
            onReset={equipment.nodeColor ? () => updateEquipment(equipment.id, { nodeColor: undefined }) : undefined}
            title="Farbe des Geräte-Knotens"
          />

          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={!!equipment.portsFlipped}
              onChange={(event) => updateEquipment(equipment.id, { portsFlipped: event.target.checked || undefined })}
            />
            Ports spiegeln (Inputs rechts, Outputs links)
          </label>
          <label
            className="flex items-center gap-2 text-[11px] text-slate-300"
            title="Markiert das Gerät als gepackt. Erscheint als ✓ auf dem Canvas und als eigene Spalte in der Geräte-BOM."
          >
            <input
              type="checkbox"
              checked={!!equipment.packed}
              onChange={(event) => updateEquipment(equipment.id, { packed: event.target.checked || undefined })}
            />
            Gepackt / Pack-Status
          </label>
          {/* #285 — Wandler-Flag. Wenn aktiv, "ueberspringt" die
              Patchliste dieses Geraet und zeigt direkt das naechste
              echte Ziel ("Kamera -> [Konverter] -> ATEM"). Nur fuer
              eindeutige 1-In/1-Out-Wandler relevant; bei mehrdeutigen
              Geraeten wird trotzdem ohne Pass-Through angezeigt. */}
          <label
            className="flex items-center gap-2 text-[11px] text-slate-300"
            title="Wandler-Marker: in der Patchliste wird dieses Gerät übersprungen und das nächste echte Ziel direkt angezeigt. Sinnvoll für SDI-HDMI-Konverter, Format-Wandler, Embedder/De-Embedder etc."
          >
            <input
              type="checkbox"
              checked={!!equipment.isConverter}
              onChange={(event) =>
                updateEquipment(equipment.id, {
                  isConverter: event.target.checked || undefined,
                })
              }
            />
            Wandler (Patchliste folgt Durchgangskabel)
          </label>
        </div>
      </SortableSection>

      {/* Rentman sync status — komplett ausgeblendet wenn Integration global aus */}
      {rentmanEnabled && (
        equipment.rentmanRemoved ? (
          <div className="flex items-center gap-1.5 rounded border border-red-700/50 bg-red-900/20 px-2 py-1 text-[11px] text-red-300">
            <span>⚠</span>
            <span>In Rentman nicht mehr vorhanden!</span>
          </div>
        ) : equipment.rentmanId ? (
          <div className="flex items-center gap-1.5 rounded border border-orange-700/50 bg-orange-900/20 px-2 py-1 text-[11px] text-orange-300">
            <span className="rounded bg-orange-700 px-1 font-bold text-white">R</span>
            Rentman-ID: {equipment.rentmanId}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded border border-amber-700/40 bg-amber-900/10 px-2 py-1 text-[11px] text-amber-400">
            <span>⚠</span>
            <span>Nicht im Rentman-Plan erfasst</span>
          </div>
        )
      )}
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

      <SortableSection
        id="network"
        title="Network & Access"
        subtitle="IP · S/N · Login"
        defaultOpen
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-slate-300">IP Address</span>
            <input
              value={equipment.ipAddress ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { ipAddress: event.target.value })
              }
              placeholder="192.168.1.10"
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">{t('eq.field.serial', 'Seriennummer')}</span>
            <input
              value={equipment.serialNumber ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { serialNumber: event.target.value || undefined })
              }
              placeholder={t('eq.field.serialPlaceholder', 'S/N')}
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">{t('eq.field.subnet', 'Subnet Mask')}</span>
            <input
              value={equipment.subnetMask ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { subnetMask: event.target.value })
              }
              placeholder={t('eq.field.subnetPlaceholder', '255.255.255.0 oder /24')}
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">{t('eq.field.username', 'Username')}</span>
            <input
              value={equipment.username ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { username: event.target.value })
              }
              autoComplete="off"
              className="w-full rounded border border-slate-700 bg-slate-900 p-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">{t('eq.field.password', 'Password')}</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={equipment.password ?? ''}
                onChange={(event) =>
                  updateEquipment(equipment.id, { password: event.target.value })
                }
                autoComplete="new-password"
                className="w-full rounded border border-slate-700 bg-slate-900 p-2 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                title={
                  showPassword
                    ? t('eq.field.passwordHide', 'Passwort verbergen')
                    : t('eq.field.passwordShow', 'Passwort anzeigen')
                }
                className="absolute inset-y-0 right-0 flex items-center px-2 text-xs text-slate-400 hover:text-slate-200"
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </label>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-slate-300">Notes</span>
          <textarea
            value={equipment.notes ?? ''}
            onChange={(event) => updateEquipment(equipment.id, { notes: event.target.value })}
            rows={3}
            placeholder="Web UI URL, firmware version, wiring notes, …"
            className="w-full rounded border border-slate-700 bg-slate-900 p-2"
          />
        </label>
      </SortableSection>

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

      <SortableSection
        id="ports"
        title="Inputs & Outputs"
        subtitle={`${equipment.inputs.length} In · ${equipment.outputs.length} Out`}
        defaultOpen
      >
        <div className="space-y-2">
          {/* v7.9.108 / Issue #225 — AI-Suggest-Button fuer Ports. Fragt
              Gemini (oder den im Settings konfigurierten Provider) was
              ein Geraet mit diesem Namen + Kategorie ueblicherweise
              fuer Ports hat. Mit Confirm-Step weil's existing Ports
              ersetzt — User koennte sonst aus Versehen alles ueberbuegeln. */}
          <PortAiSuggestButton equipment={equipment} />
          {/* v7.9.63 / #185 — Inputs und Outputs unabhängig collapsible.
              Vorher musste der User immer durch alle Inputs scrollen um
              die Outputs zu erreichen. Beide Defaults auf open damit
              alte UX nicht plötzlich anders aussieht. */}
          <details open className="rounded border border-slate-800 bg-slate-950/30">
            <summary className="cursor-pointer select-none px-2 py-1 text-xs font-semibold text-slate-300 hover:text-slate-100">
              Inputs <span className="text-slate-500">({equipment.inputs.length})</span>
            </summary>
            <div className="px-2 pb-2">
              <PortList
                title="Inputs"
                ports={equipment.inputs}
                onChange={(inputs) => updateEquipment(equipment.id, { inputs })}
                hideTitle
                showAtemSourceId={deviceKind === 'atem'}
              />
            </div>
          </details>
          <details open className="rounded border border-slate-800 bg-slate-950/30">
            <summary className="cursor-pointer select-none px-2 py-1 text-xs font-semibold text-slate-300 hover:text-slate-100">
              Outputs <span className="text-slate-500">({equipment.outputs.length})</span>
            </summary>
            <div className="px-2 pb-2">
              <PortList
                title="Outputs"
                ports={equipment.outputs}
                onChange={(outputs) => updateEquipment(equipment.id, { outputs })}
                hideTitle
                showAtemSourceId={deviceKind === 'atem'}
              />
            </div>
          </details>
        </div>
      </SortableSection>

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
