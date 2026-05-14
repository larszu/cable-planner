import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { CableProperties } from './CableProperties'
import { EquipmentProperties } from './EquipmentProperties'
import { LocationProperties } from './LocationProperties'
import { TemplateProperties } from './TemplateProperties'
import { FloatingPanelShell } from '../Layout/FloatingPanelShell'

export const PropertiesPanel = () => {
  const selectedEquipmentId = useProjectStore((state) => state.selectedEquipmentId)
  const selectedCableId = useProjectStore((state) => state.selectedCableId)
  const selectedLocationId = useProjectStore((state) => state.selectedLocationId)
  const selectedTemplateName = useProjectStore((state) => state.selectedTemplateName)
  const project = useProjectStore((state) => state.project)
  const collapsed = useUiStore((state) => state.propertiesCollapsed)
  const toggle = useUiStore((state) => state.togglePropertiesCollapsed)
  const floating = useUiStore((state) => state.propertiesFloating)
  const setFloating = useUiStore((state) => state.setPropertiesFloating)
  const floatingPos = useUiStore((state) => state.propertiesFloatingPos)
  const setFloatingPos = useUiStore((state) => state.setPropertiesFloatingPos)
  const propertiesWidth = useUiStore((state) => state.propertiesWidth)
  const selectedEquipment = selectedEquipmentId
    ? project.equipment.find((item) => item.id === selectedEquipmentId)
    : undefined
  const selectedCable = selectedCableId
    ? project.cables.find((item) => item.id === selectedCableId)
    : undefined
  const selectedLocation = selectedLocationId
    ? project.locations?.find((item) => item.id === selectedLocationId)
    : undefined
  const title = selectedEquipment
    ? `Gerät: ${selectedEquipment.name}`
    : selectedCable
      ? `Kabel: ${selectedCable.name}`
      : selectedLocation
        ? `Rahmen: ${selectedLocation.name}`
        : selectedTemplateName
          ? `Vorlage: ${selectedTemplateName}`
          : 'Inspector'

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-auto px-3 pb-3 pt-3">
        {selectedEquipmentId && <EquipmentProperties />}
        {selectedCableId && <CableProperties />}
        {selectedLocationId && <LocationProperties />}
        {selectedTemplateName && <TemplateProperties />}
        {!selectedEquipmentId && !selectedCableId && !selectedLocationId && !selectedTemplateName && (
          <div className="space-y-3 text-xs text-slate-400">
            <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
              <div className="mb-1 font-semibold text-slate-200">Nichts ausgewählt</div>
              <div>Wähle ein Gerät, Kabel, Rahmen oder eine Library-Vorlage aus.</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Schnelle Orientierung
              </div>
              <div className="space-y-1">
                <div>• Geräte links aus der Library auf den Canvas setzen.</div>
                <div>• Ports verbinden, um Kabel zu erstellen.</div>
                <div>• Mehrere Geräte auswählen und im Canvas als Gruppe speichern.</div>
                <div>• Rentman-Aktionen findest du im Equipment-Tab unter Rentman.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (floating) {
    return (
      <FloatingPanelShell
        title={
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-slate-100">{title}</span>
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Eigenschaften
            </span>
          </span>
        }
        position={floatingPos}
        onMove={setFloatingPos}
        onDock={() => setFloating(false)}
        width={propertiesWidth}
      >
        {body}
      </FloatingPanelShell>
    )
  }

  if (collapsed) {
    return (
      <aside className="group flex h-full w-8 flex-col items-center border-l border-slate-700 bg-slate-950 transition-colors hover:bg-slate-900">
        <button
          type="button"
          onClick={toggle}
          title="Eigenschaften einblenden"
          aria-label="Eigenschaften einblenden"
          className="mt-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 shadow-sm transition-all hover:border-sky-500 hover:bg-slate-800 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span className="text-base leading-none">‹</span>
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label="Eigenschaften einblenden"
          className="mt-3 flex-1 self-stretch text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:text-sky-300"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Eigenschaften
        </button>
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-slate-700 bg-slate-950 text-slate-100">
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
            Eigenschaften
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setFloating(true)}
            title="Eigenschaften abdocken (frei verschiebbar)"
            aria-label="Eigenschaften abdocken"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition-all hover:border-sky-500 hover:bg-slate-800 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span className="text-[11px] leading-none">⤢</span>
          </button>
          <button
            type="button"
            onClick={toggle}
            title="Eigenschaften ausblenden"
            aria-label="Eigenschaften ausblenden"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition-all hover:border-sky-500 hover:bg-slate-800 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span className="text-base leading-none">›</span>
          </button>
        </div>
      </div>
      {body}
    </aside>
  )
}
