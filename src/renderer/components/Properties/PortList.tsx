import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Tooltip } from '../shared/Tooltip'
import { useUiStore } from '../../store/uiStore'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import type { ConnectorType, Port, PortGroupKind } from '../../types/equipment'
import { ALL_SIGNAL_STANDARDS, type SignalStandard } from '../../types/cableSpec'
import { confirmDialog } from '../../lib/confirmDialog'
import { infoDialog } from '../../lib/infoDialog'
import { promptDialog } from '../../lib/promptDialog'
import { effectivePortNumber, findDuplicatePortNumbers } from '../../lib/portNumbering'
import { format, useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { PORT_GROUP_INFO, gruppenBefunde, naechsteGruppenId, portGruppen } from '../../lib/portGroups'

/**
 * #306 — PortList + SortablePortItem + makePort aus EquipmentProperties
 * ausgelagert (groesster verbliebener Block, ~600 LOC).
 *
 * SortablePortItem implementiert die per-Port-Drag-Handle-Logik mit
 * dnd-kit's useSortable; rendert die Drag-Grip-Geometrie + listeners auf
 * dem Children-Wrapper. PortList umschliesst die List mit DndContext +
 * SortableContext und kapselt die ganze Edit-Logik fuer Connector-Type,
 * Signal-Standard, Direction, Port-Number, Content-Label und ATEM-
 * Source-ID-Override.
 */

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
  const t = useTranslation()
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
      className={`rounded border border-cp-border-muted bg-cp-surface-1 p-2 ${isDragging ? 'opacity-60 shadow-lg shadow-slate-950/50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 cursor-grab rounded border border-cp-border bg-cp-surface-3 px-1.5 py-1 text-cp-xs text-cp-text-muted hover:bg-cp-surface-1 active:cursor-grabbing"
          title={t('ports.dragHandle', 'Reorder port')}
          aria-label={format(t('ports.reorderAria', 'Reorder: {name}'), { name: port.name })}
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

/**
 * Per-Port SDI-Fähigkeiten ein-/ausklappbar. Der Block war bisher immer
 * offen, sobald ein Port BNC war; bei Geräten mit vielen BNC-Ports
 * (Kameras, Quad-Link-Router) blähte das die Port-Liste stark auf. Jetzt
 * als <details> mit dem gleichen ▾/▸-Muster wie sonst im UI.
 *
 * Default offen, wenn der Port bereits SDI-Caps oder eine Quad-Gruppe
 * gesetzt hat (defaultOpen), sonst eingeklappt — beim Einklappen zeigt das
 * Summary eine kurze Badge (z. B. „SDI-12G · QL-1") damit gesetzte Werte
 * nicht unsichtbar verschwinden.
 *
 * <details>/<summary> statt Button: ein <summary> ist kein Form-Control,
 * deshalb bleibt das Auf-/Zuklappen auch im gesperrten Properties-Fieldset
 * (viewer/finalized) bedienbar, während die Eingabefelder darin korrekt
 * deaktiviert sind.
 */
const CollapsibleSdiCaps = ({
  defaultOpen,
  badge,
  children,
}: {
  defaultOpen: boolean
  badge?: string
  children: ReactNode
}) => {
  const t = useTranslation()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="mt-1 rounded border border-amber-900/60 bg-amber-950/20 [&_summary]:cursor-pointer"
    >
      <summary className="flex items-center gap-1 p-1.5 text-cp-xs font-semibold uppercase tracking-wide text-amber-300 hover:text-amber-200 [&::-webkit-details-marker]:hidden">
        <Icon icon={open ? ChevronDown : ChevronRight} size="xs" className="text-amber-400/70" />
        <span className="flex-1">{t('ports.sdi.caps', 'SDI capabilities (port-specific)')}</span>
        {!open && badge && (
          <span className="rounded bg-amber-900/50 px-1 text-cp-xs normal-case text-amber-200">
            {badge}
          </span>
        )}
      </summary>
      <div className="px-1.5 pb-1.5">{children}</div>
    </details>
  )
}

export const PortList = ({ title, ports, onChange, hideTitle, showAtemSourceId }: PortListProps) => {
  const t = useTranslation()
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
      await infoDialog(
        format(t('quadLink.incompleteTitle', 'Quad-Link set {g} incomplete'), { g }),
        {
          body: format(
            t(
              'quadLink.incompleteBody',
              'Only has {have}/4 ports. No more free BNC ports available — please add BNC ports first or free up existing ones.',
            ),
            { have: String(haveCount) },
          ),
          tone: 'warning',
        },
      )
      return
    }
    const ok = await confirmDialog(
      format(t('quadLink.fillTitle', 'Fill quad-link set {g}?'), { g }),
      {
        body: format(
          t(
            'quadLink.fillBody',
            'Currently {have}/4 ports. Assign {add} more free BNC ports automatically to the set?',
          ),
          { have: String(haveCount), add: String(Math.min(needed, freeBncPorts.length)) },
        ),
        okLabel: t('quadLink.okFill', 'Yes, fill'),
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
          format(t('quadLink.createTitle', 'Create quad-link set {id}?'), { id: newId }),
          {
            body: format(
              t(
                'quadLink.createBody',
                '1/4 ports set. Assign {add} more free BNC ports automatically to the set?',
              ),
              { add: String(Math.min(needed, freeBncPorts.length)) },
            ),
            okLabel: t('quadLink.okFill', 'Yes, fill'),
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
        await infoDialog(
          format(t('quadLink.createdTitle', 'Quad-link set {id} created'), { id: newId }),
          {
            body: format(
              t(
                'quadLink.createdBody',
                'Currently has {have}/4 ports. Please add more BNC ports and assign them to the set.',
              ),
              { have: String(haveCount) },
            ),
            tone: 'info',
          },
        )
      }
      return
    }
    updatePort(portId, { quadLinkGroup: raw || undefined })
  }

  // #370 — Dual-Link Set Helpers. Analog zu den Quad-Link-Helfern oben,
  // aber ein Set besteht aus genau 2 BNC-Ports (Dual-Link HD/3G, SMPTE
  // 372M) mit gleichem dualLinkGroup-ID auf derselben Seite.
  const existingDualGroups = useMemo(() => {
    const set = new Set<string>()
    for (const p of ports) {
      if (p.dualLinkGroup) set.add(p.dualLinkGroup)
    }
    return Array.from(set).sort()
  }, [ports])
  const dualGroupCount = (g: string): number =>
    ports.filter((p) => p.dualLinkGroup === g).length
  const nextDualGroupId = (): string => {
    let i = 1
    while (existingDualGroups.includes(`DL-${i}`)) i++
    return `DL-${i}`
  }
  const autoFillDualGroup = async (g: string, sourcePortId: string) => {
    const haveCount = dualGroupCount(g)
    const needed = 2 - haveCount
    if (needed <= 0) return
    const freeBncPorts = ports.filter(
      (p) => p.id !== sourcePortId && p.connectorType === 'BNC' && !p.dualLinkGroup,
    )
    if (freeBncPorts.length === 0) {
      await infoDialog(
        format(t('dualLink.incompleteTitle', 'Dual-link set {g} incomplete'), { g }),
        {
          body: format(
            t(
              'dualLink.incompleteBody',
              'Only has {have}/2 ports. No more free BNC ports available — add BNC ports first or free up existing ones.',
            ),
            { have: String(haveCount) },
          ),
          tone: 'warning',
        },
      )
      return
    }
    const ok = await confirmDialog(
      format(t('dualLink.fillTitle', 'Fill dual-link set {g}?'), { g }),
      {
        body: format(
          t(
            'dualLink.fillBody',
            'Currently {have}/2 ports. Automatically assign {add} more free BNC port to the set?',
          ),
          { have: String(haveCount), add: String(Math.min(needed, freeBncPorts.length)) },
        ),
        okLabel: t('dualLink.okFill', 'Yes, fill'),
      },
    )
    if (!ok) return
    const toAdd = new Set(freeBncPorts.slice(0, needed).map((p) => p.id))
    onChange(
      ports.map((p) =>
        toAdd.has(p.id) ? { ...p, dualLinkGroup: g } : p,
      ),
    )
  }
  const assignDualGroup = async (portId: string, raw: string) => {
    if (raw === '__new__') {
      const newId = nextDualGroupId()
      const updated = ports.map((p) =>
        p.id === portId ? { ...p, dualLinkGroup: newId } : p,
      )
      onChange(updated)
      const haveCount = updated.filter((p) => p.dualLinkGroup === newId).length
      const freeBncPorts = updated.filter(
        (p) =>
          p.id !== portId &&
          p.connectorType === 'BNC' &&
          !p.dualLinkGroup,
      )
      const needed = 2 - haveCount
      if (needed > 0 && freeBncPorts.length > 0) {
        const ok = await confirmDialog(
          format(t('dualLink.createTitle', 'Create dual-link set {id}?'), { id: newId }),
          {
            body: format(
              t(
                'dualLink.createBody',
                '1/2 ports set. Automatically assign {add} more free BNC port to the set?',
              ),
              { add: String(Math.min(needed, freeBncPorts.length)) },
            ),
            okLabel: t('dualLink.okFill', 'Yes, fill'),
          },
        )
        if (ok) {
          const toAdd = new Set(freeBncPorts.slice(0, needed).map((p) => p.id))
          onChange(
            updated.map((p) =>
              toAdd.has(p.id) ? { ...p, dualLinkGroup: newId } : p,
            ),
          )
        }
      } else if (needed > 0) {
        await infoDialog(
          format(t('dualLink.createdTitle', 'Dual-link set {id} created'), { id: newId }),
          {
            body: format(
              t(
                'dualLink.createdBody',
                'Currently has {have}/2 ports. Please add another BNC port and assign it to the set too.',
              ),
              { have: String(haveCount) },
            ),
            tone: 'info',
          },
        )
      }
      return
    }
    updatePort(portId, { dualLinkGroup: raw || undefined })
  }

  // #832 — Die vorhandenen Gruppen DIESER Seite. Eine Gruppe ueber Ein- und
  // Ausgaenge hinweg waere kein Anschluss, sondern eine Durchschleife; die
  // Liste bietet deshalb nur an, was hier schon steht.
  const vorhandeneGruppen = portGruppen(ports).map((g) => g.id)
  const gruppenFehler = gruppenBefunde(ports)

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
    <div className="rounded border border-cp-border p-2">
      <div className="mb-2 flex items-center justify-between">
        {/* v7.9.63 / #185 — Wrapper-Details liefert eigene Headline mit
            Count; PortList-Title hier ausgeblendet damit's nicht doppelt
            steht. Bei direkter Verwendung (ohne Wrapper) bleibt der
            Titel sichtbar. */}
        <span className="text-cp-xs font-semibold uppercase tracking-wide text-cp-text-secondary">{hideTitle ? '' : title}</span>
        <button
          type="button"
          onClick={addPort}
          className="rounded bg-cp-surface-4 px-2 py-0.5 text-cp-xs hover:bg-cp-surface-5"
        >
          {t('ports.add', '+ Port')}
        </button>
      </div>
      {ports.length === 0 && <div className="text-cp-xs text-cp-text-muted">{t('ports.none', 'None')}</div>}
      {duplicatePortNumbers.length > 0 && (
        <div className="mb-2 rounded border border-amber-700 bg-amber-950/40 px-2 py-1 text-cp-xs text-amber-200">
          {format(t('ports.duplicateNumbers', 'Duplicate port numbers: {nums} — ambiguous for labels / patch list.'), {
            nums: duplicatePortNumbers.join(', '),
          })}
        </div>
      )}
      {/*
        #832 — Der Widerspruch steht DORT, wo er entsteht, und wartet nicht auf
        den Plan-Check. Eine halb markierte Stereo-Gruppe faellt beim Eintragen
        auf; wer sie erst auf dem Blatt bemerkt, steht schon im Saal.

        Gemeldet wird nur, was sich WIDERSPRICHT — nicht, was fehlt. Eine
        Gruppe ohne Art ist vollstaendig („die gehoeren zusammen"), und wer
        dafuer eine Warnung bekaeme, schaltete sie nach der dritten ab.
      */}
      {gruppenFehler.map((f, i) => (
        <div
          key={`${f.art}:${f.gruppe}:${i}`}
          className="mb-2 rounded border border-amber-700 bg-amber-950/40 px-2 py-1 text-cp-xs text-amber-200"
        >
          {f.art === 'groesse' &&
            format(
              t(
                'ports.group.sizeMismatch',
                'Group "{group}": {is} of {expected} ports — the group says one connector, the plan shows another number.',
              ),
              { group: f.gruppe, is: String(f.ist), expected: String(f.erwartet) },
            )}
          {f.art === 'artenmix' &&
            format(
              t(
                'ports.group.kindMismatch',
                'Group "{group}" is declared as {kinds} at the same time — only one of them can be true.',
              ),
              { group: f.gruppe, kinds: f.arten.join(' / ') },
            )}
          {f.art === 'rolle-doppelt' &&
            format(
              t(
                'ports.group.roleTwice',
                'Group "{group}" has "{role}" twice — two left channels are not a stereo pair.',
              ),
              { group: f.gruppe, role: f.rolle },
            )}
        </div>
      ))}
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
                title={format(t('ports.numberTitle', 'Display number (default {n}). Empty = automatic.'), { n: portIdx + 1 })}
                className="w-12 shrink-0 rounded border border-cp-border bg-cp-surface-3 p-1 text-center text-cp-xs tabular-nums"
              />
              <input
                value={port.name}
                onChange={(event) => updatePort(port.id, { name: event.target.value })}
                placeholder={t('ports.namePlaceholder', 'Port name')}
                className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
              />
              <Tooltip label={t('ports.remove', 'Remove port')}>
                <button
                  type="button"
                  onClick={() => removePort(port.id)}
                  aria-label={t('ports.remove', 'Remove port')}
                  className="rounded bg-red-900/60 px-2 py-1 text-cp-xs hover:bg-red-800"
                >
                  ×
                </button>
              </Tooltip>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <div className="flex items-stretch gap-0.5">
                <select
                  aria-label={t('ports.aria.connector', 'Connector type')}
                  value={port.connectorType}
                  onChange={async (event) => {
                    const v = event.target.value
                    if (v === '__new__') {
                      const name = (await promptDialog(t('ports.newConnectorPrompt', 'New connector type (e.g. "Speakon NL4"):')))?.trim()
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
                  className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                >
                  {allConnectorTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                      {customConnectorTypes.includes(type as string) ? ' (' + t('ports.customSuffix', 'custom') + ')' : ''}
                    </option>
                  ))}
                  <option value="__new__">+ {t('ports.newConnectorType', 'New connector type…')}</option>
                </select>
              </div>
              <div className="flex items-stretch gap-0.5">
                <select
                  aria-label={t('ports.aria.signal', 'Signal standard')}
                  value={port.standard ?? ''}
                  onChange={async (event) => {
                    const v = event.target.value
                    if (v === '__new__') {
                      const name = (await promptDialog(t('ports.newStandardPrompt', 'New signal standard (e.g. "Dante Primary"):')))?.trim()
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
                  className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                >
                  <option value="">-</option>
                  {allSignalStandardOptions.map((std) => (
                    <option key={std} value={std}>
                      {std}
                      {customSignalStandards.includes(std as string) ? ' (' + t('ports.customSuffix', 'custom') + ')' : ''}
                    </option>
                  ))}
                  <option value="__new__">+ {t('ports.newStandard', 'New standard…')}</option>
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
                aria-label={t('ports.aria.contentLabel', 'Content / function')}
                value={port.contentLabel ?? ''}
                onChange={(event) => {
                  const v = event.target.value
                  updatePort(port.id, { contentLabel: v ? v : undefined })
                }}
                placeholder={t('ports.contentLabelPlaceholder', 'Content / function (e.g. PGM, PVW, MV1, Cam1) — optional')}
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                title={t('ports.contentLabelTitle', "What goes through this port? Separates 'content' (PGM/PVW) from the hardware standard (SDI 3G/12G).")}
              />
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <select
                aria-label={t('ports.aria.direction', 'Port direction')}
                value={port.direction ?? ''}
                onChange={(event) =>
                  updatePort(port.id, {
                    direction: event.target.value
                      ? (event.target.value as 'in' | 'out' | 'bidirectional')
                      : undefined,
                  })
                }
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                title={t('ports.directionTitle', 'Direction — bidirectional is useful for network/RJ45 ports.')}
              >
                <option value="">{t('ports.direction.auto', 'Direction (auto)')}</option>
                <option value="in">{t('ports.direction.in', 'Input only')}</option>
                <option value="out">{t('ports.direction.out', 'Output only')}</option>
                <option value="bidirectional">{t('ports.direction.bi', 'Bidirectional (e.g. network)')}</option>
              </select>
              <select
                aria-label={t('ports.aria.side', 'Port side')}
                value={port.side ?? ''}
                onChange={(event) =>
                  updatePort(port.id, {
                    side: event.target.value ? (event.target.value as 'left' | 'right') : undefined,
                  })
                }
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                title={t('ports.sideTitle', 'Port side on the device: auto uses input/output + global mirroring')}
              >
                <option value="">{t('ports.side.auto', 'Side (auto)')}</option>
                <option value="left">{t('ports.side.left', 'Left')}</option>
                <option value="right">{t('ports.side.right', 'Right')}</option>
              </select>
            </div>
            {/* #410 — Steckverbinder-Geschlecht (male/female). Optional. */}
            <div className="mt-1">
              <select
                aria-label={t('ports.aria.gender', 'Connector gender')}
                value={port.gender ?? ''}
                onChange={(event) =>
                  updatePort(port.id, {
                    gender: event.target.value
                      ? (event.target.value as 'male' | 'female')
                      : undefined,
                  })
                }
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                title={t('ports.genderTitle', 'Connector gender (for cable assembly)')}
              >
                <option value="">{t('ports.gender.none', 'Gender (–)')}</option>
                <option value="male">{t('ports.gender.male', '♂ Male / plug')}</option>
                <option value="female">{t('ports.gender.female', '♀ Female / socket')}</option>
              </select>
            </div>
            {showAtemSourceId && (
              <div className="mt-1 flex items-center gap-1.5 rounded border border-emerald-900/60 bg-emerald-950/30 px-1.5 py-1">
                <span className="text-cp-xs font-semibold uppercase tracking-wide text-emerald-300">
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
                  placeholder={t('ports.atemSourceIdPlaceholder', 'e.g. 8001 for AUX 1')}
                  title={t('ports.atemSourceIdTitle', 'Source ID addressed in the MV-Config dialog. AUX = 8001+, PGM = 10010, PVW = 10011, ME 2 PGM = 10020 …. Leave empty on inputs for idx+1 default.')}
                  className="w-32 rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                />
                <span className="text-cp-xs text-cp-text-muted">
                  AUX 8001+ · PGM 10010 · PVW 10011
                </span>
              </div>
            )}
            {(port.connectorType === 'Fiber' || port.connectorType === 'SFP' || port.connectorType === 'SFP+') && (
              <div className="mt-1 rounded border border-sky-900/60 bg-sky-950/30 p-1.5">
                <div className="mb-1 text-cp-xs font-semibold uppercase tracking-wide text-sky-400">SFP-Modul</div>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    value={port.sfpType ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpType: event.target.value || undefined })}
                    placeholder={t('ports.sfp.typePlaceholder', 'Form factor (SFP+)')}
                    className="rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                    title={t('ports.sfp.typeTitle', 'SFP form factor: SFP, SFP+, SFP28, QSFP+')}
                  />
                  <input
                    value={port.sfpStandard ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpStandard: event.target.value || undefined })}
                    placeholder={t('ports.sfp.standardPlaceholder', 'Standard (10G-LR)')}
                    className="rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                    title={t('ports.sfp.standardTitle', 'Transceiver standard: 1G-SX, 1G-LX, 10G-SR, 10G-LR, 25G-SR …')}
                  />
                  <input
                    value={port.sfpWavelength ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpWavelength: event.target.value || undefined })}
                    placeholder={t('ports.sfp.wavelengthPlaceholder', 'Wavelength nm (1310)')}
                    className="rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                    title={t('ports.sfp.wavelengthTitle', 'Wavelength in nm: 850, 1310, 1550')}
                  />
                  <input
                    value={port.sfpVendor ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpVendor: event.target.value || undefined })}
                    placeholder={t('ports.sfp.vendorPlaceholder', 'Vendor (Cisco)')}
                    className="rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                    title={t('ports.sfp.vendorTitle', 'Module vendor: Cisco, Aruba, Ubiquiti, FS.com …')}
                  />
                  {/* #362 — Optischer Steckverbinder + Faserklasse (LWL-Detail). */}
                  <select
                    value={port.fiberConnector ?? ''}
                    onChange={(event) => updatePort(port.id, { fiberConnector: event.target.value || undefined })}
                    className="rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                    title={t('ports.fiber.connectorTitle', 'Optical connector type')}
                  >
                    <option value="">{t('ports.fiber.connectorPlaceholder', 'Connector (LC/SC/…)')}</option>
                    {['LC', 'SC', 'ST', 'FC', 'E2000', 'MPO-MTP', 'opticalCON', 'LEMO'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={port.fiberClass ?? ''}
                    onChange={(event) => updatePort(port.id, { fiberClass: event.target.value || undefined })}
                    className="rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                    title={t('ports.fiber.classTitle', 'Fibre class: OM1–OM5 (multimode), OS1/OS2 (singlemode)')}
                  >
                    <option value="">{t('ports.fiber.classPlaceholder', 'Fibre class (OM/OS)')}</option>
                    {['OM1', 'OM2', 'OM3', 'OM4', 'OM5', 'OS1', 'OS2'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {/*
              #832 — „Inputs und Outputs gruppieren. Z.b 2 Mono Klinken als ein
              Stereo kennzeichnen."

              Die Zeile steht bei JEDEM Port und nicht nur bei Audio: die
              Gruppe sagt nichts ueber ein Signal, sondern „diese Buchsen
              gehoeren zusammen". Das gilt fuer zwei Klinken genauso wie fuer
              zwei Adern einer Steuerleitung.

              Sie liegt AUSSERHALB von `CollapsibleSdiCaps` — der Kasten
              erscheint nur bei BNC, und eine Klinken-Gruppe waere darin nicht
              erreichbar.
            */}
            <div className="mt-1 flex flex-wrap items-center gap-1 text-cp-xs">
              <span className="text-cp-text-muted">{t('ports.group.label', 'Group:')}</span>
              <select
                aria-label={t('ports.group.aria', 'Port group')}
                value={port.portGroup ?? ''}
                onChange={(event) => {
                  const v = event.target.value
                  if (v === '__new__') {
                    updatePort(port.id, {
                      portGroup: naechsteGruppenId(ports),
                      portGroupKind: port.portGroupKind ?? 'stereo',
                    })
                    return
                  }
                  // Die Gruppe zu loeschen nimmt Art und Rolle MIT. Sie
                  // beschreiben die Zugehoerigkeit; ohne sie stuenden sie am
                  // Port und meinten nichts.
                  updatePort(
                    port.id,
                    v
                      ? { portGroup: v }
                      : { portGroup: undefined, portGroupKind: undefined, portGroupRole: undefined },
                  )
                }}
                className="rounded border border-cp-border bg-cp-surface-3 px-1 py-0.5 text-cp-xs"
              >
                <option value="">{t('ports.set.none', '— None —')}</option>
                {vorhandeneGruppen.map((gid) => (
                  <option key={gid} value={gid}>{gid}</option>
                ))}
                <option value="__new__">{t('ports.group.new', '+ New group…')}</option>
              </select>
              {port.portGroup && (
                <>
                  <select
                    aria-label={t('ports.group.kindAria', 'Group kind')}
                    value={port.portGroupKind ?? ''}
                    onChange={(event) =>
                      updatePort(port.id, {
                        portGroupKind: (event.target.value || undefined) as
                          | PortGroupKind
                          | undefined,
                      })
                    }
                    className="rounded border border-cp-border bg-cp-surface-3 px-1 py-0.5 text-cp-xs"
                  >
                    {/* Leer ist erlaubt und heisst „gehoeren zusammen, ohne
                        zu sagen wie" — eine vollstaendige Aussage. */}
                    <option value="">{t('ports.group.kindNone', '— not stated —')}</option>
                    <option value="stereo">{t('ports.group.stereo', 'Stereo (L/R)')}</option>
                    <option value="ms">{t('ports.group.ms', 'M/S')}</option>
                    <option value="sum">{t('ports.group.sum', 'Sum (A/B)')}</option>
                    <option value="bridge">{t('ports.group.bridge', 'Bridged (+/-)')}</option>
                    <option value="sonstige">{t('ports.group.other', 'Other')}</option>
                  </select>
                  <select
                    aria-label={t('ports.group.roleAria', 'Role in the group')}
                    value={port.portGroupRole ?? ''}
                    onChange={(event) =>
                      updatePort(port.id, { portGroupRole: event.target.value || undefined })
                    }
                    className="rounded border border-cp-border bg-cp-surface-3 px-1 py-0.5 text-cp-xs"
                  >
                    <option value="">{t('ports.group.roleNone', '— role? —')}</option>
                    {(port.portGroupKind ? PORT_GROUP_INFO[port.portGroupKind].rollen : []).map(
                      (r) => (
                        <option key={r} value={r}>{r}</option>
                      ),
                    )}
                  </select>
                </>
              )}
            </div>
            {port.connectorType === 'BNC' && (
              <CollapsibleSdiCaps
                defaultOpen={
                  !!(
                    port.sdiCaps?.maxSingleLink ||
                    port.sdiCaps?.levelA ||
                    port.sdiCaps?.levelB ||
                    port.quadLinkGroup ||
                    port.dualLinkGroup
                  )
                }
                badge={[port.sdiCaps?.maxSingleLink, port.quadLinkGroup, port.dualLinkGroup]
                  .filter(Boolean)
                  .join(' · ')}
              >
                <div className="grid grid-cols-2 gap-1 text-cp-xs">
                  {/* v7.9.63 / #176 — 3G Level A/B nur anzeigen wenn das
                      Port-Max tatsächlich SDI-3G ist. Für 6G/12G/HD sind die
                      Level-Optionen bedeutungslos und nur visueller Lärm. */}
                  {port.sdiCaps?.maxSingleLink === 'SDI-3G' && (
                    <>
                      <label className="flex items-center gap-1 text-cp-text-secondary">
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
                      <label className="flex items-center gap-1 text-cp-text-secondary">
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
                    <span className="text-cp-text-muted">{t('ports.sdi.maxSingleLink', 'Max single-link')}</span>
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
                      className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                    >
                      <option value="">({t('ports.sdi.deviceDefault', 'Device default')})</option>
                      <option value="SDI-HD">SDI-HD (1.5G)</option>
                      <option value="SDI-3G">SDI-3G</option>
                      <option value="SDI-6G">SDI-6G</option>
                      <option value="SDI-12G">SDI-12G</option>
                    </select>
                  </label>
                </div>
                <div className="mt-1 text-cp-xs text-cp-text-muted">
                  {t(
                    'ports.sdi.overrideHint',
                    'Overrides the device SDI capabilities for this port. Empty = device default.',
                  )}
                </div>
                {(() => {
                  const g = port.quadLinkGroup
                  const count = g ? quadGroupCount(g) : 0
                  const ok = count === 4
                  return (
                    <div className="mt-1.5 flex items-center gap-1 text-cp-xs">
                      <span className="text-cp-text-muted">{t('ports.sdi.quadSet', 'Quad-link set:')}</span>
                      <select
                        value={g ?? ''}
                        onChange={(e) => void assignQuadGroup(port.id, e.target.value)}
                        className="rounded border border-cp-border bg-cp-surface-3 px-1 py-0.5 text-cp-xs"
                      >
                        <option value="">{t('ports.set.none', '— None —')}</option>
                        {existingQuadGroups.map((gid) => (
                          <option key={gid} value={gid}>{gid}</option>
                        ))}
                        <option value="__new__">{t('ports.set.new', '+ New set…')}</option>
                      </select>
                      {g && (
                        <>
                          <span
                            className={`rounded px-1 py-0.5 text-cp-xs font-bold ${
                              ok
                                ? 'bg-emerald-900/60 text-emerald-300'
                                : 'bg-amber-900/60 text-amber-300'
                            }`}
                            title={ok
                              ? t('quadLink.complete', 'Set complete')
                              : t('quadLink.incomplete', 'Set incomplete — 4 ports required')}
                          >
                            {count}/4
                          </span>
                          {!ok && (
                            <button
                              type="button"
                              onClick={() => void autoFillQuadGroup(g, port.id)}
                              className="rounded bg-sky-800 px-1 py-0.5 text-cp-xs text-sky-100 hover:bg-sky-700"
                              title={t('ports.quadAuto', 'Auto-assign free BNC ports to this set')}
                            >
                              auto-fill
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}
                {(() => {
                  const g = port.dualLinkGroup
                  const count = g ? dualGroupCount(g) : 0
                  const ok = count === 2
                  return (
                    <div className="mt-1 flex items-center gap-1 text-cp-xs">
                      <span className="text-cp-text-muted">{t('ports.sdi.dualSet', 'Dual-link set:')}</span>
                      <select
                        value={g ?? ''}
                        onChange={(e) => void assignDualGroup(port.id, e.target.value)}
                        className="rounded border border-cp-border bg-cp-surface-3 px-1 py-0.5 text-cp-xs"
                      >
                        <option value="">{t('ports.set.none', '— None —')}</option>
                        {existingDualGroups.map((gid) => (
                          <option key={gid} value={gid}>{gid}</option>
                        ))}
                        <option value="__new__">{t('ports.set.new', '+ New set…')}</option>
                      </select>
                      {g && (
                        <>
                          <span
                            className={`rounded px-1 py-0.5 text-cp-xs font-bold ${
                              ok
                                ? 'bg-emerald-900/60 text-emerald-300'
                                : 'bg-amber-900/60 text-amber-300'
                            }`}
                            title={ok
                              ? t('dualLink.complete', 'Set complete')
                              : t('dualLink.incomplete', 'Set incomplete — 2 ports required')}
                          >
                            {count}/2
                          </span>
                          {!ok && (
                            <button
                              type="button"
                              onClick={() => void autoFillDualGroup(g, port.id)}
                              className="rounded bg-sky-800 px-1 py-0.5 text-cp-xs text-sky-100 hover:bg-sky-700"
                              title={t('ports.dualAuto', 'Auto-assign free BNC ports to this set')}
                            >
                              auto-fill
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}
              </CollapsibleSdiCaps>
            )}
          </SortablePortItem>
        ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}
