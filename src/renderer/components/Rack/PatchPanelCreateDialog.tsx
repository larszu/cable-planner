/**
 * v7.9.75 / #170 — Quick-Erstellung einer Patchblende für den Rack-Builder.
 *
 * UX: User wählt HE-Höhe (typisch 1HU), Port-Anzahl (12/16/24/32/48 etc.),
 * default-Connector-Typ (BNC für Video, RJ45 für IT, XLR für Audio...) und
 * optional ob die Patchblende rear-mounted ist. Per-Port-Editing (Label +
 * Connector-Typ-Override) wird in einem zweiten Schritt im Tab "Detail"
 * gemacht — beim Bestätigen ohne Detail-Edit kriegt jeder Port ein
 * generiertes Label "P1", "P2", ... mit dem default-Connector.
 *
 * Die Patchblende wird als EquipmentTemplate erzeugt (isPatchPanel: true)
 * und über onCreated als Template dem Rack-Builder zurückgegeben. Der ruft
 * die normale Add-Placement-Logik auf, damit die Patchblende wie ein
 * gewöhnliches 19"-Gerät durch alle nachgelagerten Mechaniken läuft.
 */
import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ALL_CONNECTOR_TYPES, type ConnectorType, type EquipmentTemplate, type Port } from '../../types/equipment'
import { useUiStore } from '../../store/uiStore'

interface PatchPanelCreateDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (template: EquipmentTemplate) => void
}

interface PortDraft {
  id: string
  label: string
  connectorType: ConnectorType
}

const COMMON_PORT_COUNTS = [12, 16, 24, 32, 48]

export const PatchPanelCreateDialog = ({ open, onClose, onCreated }: PatchPanelCreateDialogProps) => {
  const [name, setName] = useState('Patchblende')
  const [heightUnits, setHeightUnits] = useState(1)
  const [portCount, setPortCount] = useState(24)
  const [defaultConnector, setDefaultConnector] = useState<ConnectorType>('BNC')
  const [tab, setTab] = useState<'basics' | 'ports'>('basics')
  const [perPortOverrides, setPerPortOverrides] = useState<Record<number, { label?: string; connector?: ConnectorType }>>({})
  const [mountSide, setMountSide] = useState<'front' | 'rear' | 'full'>('full')
  // v7.9.75 — Custom Connector-Typen sind in uiStore.customConnectorTypes
  // hinterlegt und sollen im Patch-Builder ebenfalls verfügbar sein.
  const customConnectorTypes = useUiStore((s) => s.customConnectorTypes)

  const allConnectors = useMemo<ConnectorType[]>(
    () => [...ALL_CONNECTOR_TYPES, ...customConnectorTypes] as ConnectorType[],
    [customConnectorTypes],
  )

  const ports = useMemo<PortDraft[]>(
    () =>
      Array.from({ length: portCount }, (_, idx) => {
        const override = perPortOverrides[idx]
        return {
          id: uuidv4(),
          label: override?.label ?? `P${idx + 1}`,
          connectorType: override?.connector ?? defaultConnector,
        }
      }),
    [portCount, defaultConnector, perPortOverrides],
  )

  if (!open) return null

  const handleCreate = () => {
    const built: Port[] = ports.map((p) => ({
      id: p.id,
      name: p.label,
      type: p.connectorType,
      connectorType: p.connectorType,
    }))
    // Patchblenden sind klassisch passive Crossfields — beide Seiten sind
    // gleichberechtigt. Wir legen alle Ports als BOTH-Sides an, indem wir
    // sie sowohl in inputs als auch in outputs spiegeln. So zeigt das 2D-
    // Panel die Ports vorne UND hinten an, was der Realität entspricht.
    const template: EquipmentTemplate = {
      name: name.trim() || 'Patchblende',
      category: 'Patchblende',
      inputs: built.map((p) => ({ ...p, id: uuidv4(), name: `${p.name} (Front)` })),
      outputs: built.map((p) => ({ ...p, id: uuidv4(), name: `${p.name} (Rear)` })),
      isRackDevice: true,
      isPatchPanel: true,
      rackUnits: heightUnits,
      depthMm: 50,
      width: 240,
      height: 80 + Math.max(heightUnits, 1) * 22,
      notes: `${portCount}-fach Patchfeld, default ${defaultConnector}.${mountSide !== 'full' ? ` Mount: ${mountSide}.` : ''}`,
    }
    onCreated(template)
    onClose()
  }

  const setOverride = (idx: number, patch: { label?: string; connector?: ConnectorType }) => {
    setPerPortOverrides((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], ...patch },
    }))
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-w-[95vw] rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Patchblende anlegen</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex overflow-hidden rounded border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => setTab('basics')}
            className={`flex-1 px-3 py-1.5 ${
              tab === 'basics' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Basics
          </button>
          <button
            type="button"
            onClick={() => setTab('ports')}
            className={`flex-1 px-3 py-1.5 ${
              tab === 'ports' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Per-Port-Detail ({portCount})
          </button>
        </div>

        {tab === 'basics' && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Höhe (HE)</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={heightUnits}
                  onChange={(e) => setHeightUnits(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Montage</span>
                <select
                  value={mountSide}
                  onChange={(e) => setMountSide(e.target.value as 'front' | 'rear' | 'full')}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                  title="Patchblenden sind häufig rear-mounted hinter vorderen Geräten."
                >
                  <option value="full">Full-Depth (vorne)</option>
                  <option value="front">Nur vorne</option>
                  <option value="rear">Nur hinten</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Anzahl Ports</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={128}
                  value={portCount}
                  onChange={(e) => setPortCount(Math.max(1, Math.min(128, Number(e.target.value) || 1)))}
                  className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
                <div className="flex gap-1">
                  {COMMON_PORT_COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPortCount(n)}
                      className={`rounded px-2 py-0.5 text-[10px] ${
                        portCount === n
                          ? 'bg-sky-700 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Default Connector-Typ</span>
              <select
                value={defaultConnector}
                onChange={(e) => setDefaultConnector(e.target.value as ConnectorType)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
              >
                {allConnectors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[10px] text-slate-500">
                Wirkt auf alle {portCount} Ports. Einzeln im Tab "Per-Port-Detail" anpassbar.
              </span>
            </label>
          </div>
        )}

        {tab === 'ports' && (
          <div className="space-y-2">
            <div className="text-[10px] text-slate-500">
              Pro Port Label und Connector-Typ überschreibbar. Leerlassen = Default.
            </div>
            <div className="max-h-[40vh] overflow-y-auto rounded border border-slate-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800 text-slate-400">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Label</th>
                    <th className="px-2 py-1 text-left">Connector</th>
                  </tr>
                </thead>
                <tbody>
                  {ports.map((p, idx) => (
                    <tr key={p.id} className="border-t border-slate-800">
                      <td className="px-2 py-0.5 text-slate-500">{idx + 1}</td>
                      <td className="px-2 py-0.5">
                        <input
                          value={perPortOverrides[idx]?.label ?? ''}
                          placeholder={`P${idx + 1}`}
                          onChange={(e) => setOverride(idx, { label: e.target.value || undefined })}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5"
                        />
                      </td>
                      <td className="px-2 py-0.5">
                        <select
                          value={perPortOverrides[idx]?.connector ?? defaultConnector}
                          onChange={(e) =>
                            setOverride(idx, { connector: e.target.value as ConnectorType })
                          }
                          className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5"
                        >
                          {allConnectors.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold hover:bg-sky-600"
          >
            Patchblende erstellen
          </button>
        </div>
      </div>
    </div>
  )
}
