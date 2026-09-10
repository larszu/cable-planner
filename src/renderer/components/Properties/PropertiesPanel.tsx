import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { CableProperties } from './CableProperties'
import { EquipmentProperties } from './EquipmentProperties'
import { LocationProperties } from './LocationProperties'
import { TemplateProperties } from './TemplateProperties'
import { FloatingPanelShell } from '../Layout/FloatingPanelShell'
import { openPanelPopout, isPopout } from '../../lib/panelPopout'
import { usePanelTearOff } from '../../lib/usePanelTearOff'
import { PanelWindowMenu } from '../shared/PanelWindowMenu'
import { triggerCanvasFitView } from '../../lib/canvasViewport'
import { format, useTranslation } from '../../lib/i18n'

export const PropertiesPanel = () => {
  const t = useTranslation()
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
  const setPropertiesWidth = useUiStore((state) => state.setPropertiesWidth)
  // #427 — In separates OS-Fenster ausgelagert / sind wir dieses Fenster?
  const poppedOut = useUiStore((state) => state.propertiesPoppedOut)
  const inPopout = isPopout()
  // #427 — Header herausziehen = abdocken; folgt danach dem Cursor.
  const tearOff = usePanelTearOff({
    onUndock: (p) => {
      setFloatingPos(p)
      setFloating(true)
    },
    onDragMove: setFloatingPos,
    onDrop: () => window.setTimeout(triggerCanvasFitView, 60),
  })
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
    ? format(t('inspector.title.equipment', 'Device: {name}'), { name: selectedEquipment.name })
    : selectedCable
      ? format(t('inspector.title.cable', 'Cable: {name}'), { name: selectedCable.name })
      : selectedLocation
        ? format(t('inspector.title.location', 'Frame: {name}'), { name: selectedLocation.name })
        : selectedTemplateName
          ? format(t('inspector.title.template', 'Template: {name}'), { name: selectedTemplateName })
          : t('inspector.title', 'Inspector')

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-auto px-3 pb-3 pt-3">
        {selectedEquipmentId && <EquipmentProperties />}
        {selectedCableId && <CableProperties />}
        {selectedLocationId && <LocationProperties />}
        {selectedTemplateName && <TemplateProperties />}
        {!selectedEquipmentId && !selectedCableId && !selectedLocationId && !selectedTemplateName && (
          <div className="space-y-3 text-cp-xs text-cp-text-muted">
            <div className="rounded border border-cp-border-muted bg-cp-surface-1/50 p-3">
              <div className="mb-1 font-semibold text-cp-text-bright">
                {t('inspector.nothingSelected', 'Nothing selected')}
              </div>
              <div>
                {t(
                  'inspector.nothingSelectedBody',
                  'Pick a device, cable, frame or library template.',
                )}
              </div>
            </div>
            <div className="rounded border border-cp-border-muted bg-cp-surface-1/40 p-3">
              <div className="mb-2 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
                {t('inspector.hints.title', 'Quick orientation')}
              </div>
              <div className="space-y-1">
                <div>
                  •{' '}
                  {t(
                    'inspector.hints.placeFromLibrary',
                    'Drop devices from the library on the canvas.',
                  )}
                </div>
                <div>
                  • {t('inspector.hints.connectPorts', 'Connect ports to create cables.')}
                </div>
                <div>
                  •{' '}
                  {t(
                    'inspector.hints.saveGroup',
                    'Select multiple devices and save them as a group from the canvas.',
                  )}
                </div>
                <div>
                  •{' '}
                  {t(
                    'inspector.hints.rentmanLocation',
                    'Rentman actions live in the Equipment tab under Rentman.',
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // #427 — Ausgelagert: im Hauptfenster nicht rendern (in-flow Platzhalter
  // besetzt die 0px-Grid-Spalte, damit nichts verrutscht).
  if (poppedOut && !inPopout) {
    return <div aria-hidden className="min-h-0" />
  }

  if (floating) {
    return (
      <FloatingPanelShell
        title={
          <span className="flex flex-col">
            <span className="text-cp-base font-semibold text-cp-text">{title}</span>
            <span className="text-cp-xs uppercase tracking-wide text-cp-text-muted">
              {t('inspector.subtitle', 'Properties')}
            </span>
          </span>
        }
        position={floatingPos}
        onMove={setFloatingPos}
        onDock={() => {
          setFloating(false)
          window.setTimeout(triggerCanvasFitView, 60)
        }}
        onPopout={() => openPanelPopout('properties')}
        dockEdge="right"
        onResize={setPropertiesWidth}
        width={propertiesWidth}
      >
        {body}
      </FloatingPanelShell>
    )
  }

  if (collapsed) {
    return (
      <aside className="group flex h-full w-8 flex-col items-center border-l border-cp-border bg-cp-surface-3 transition-colors hover:bg-cp-surface-1">
        <button
          type="button"
          onClick={toggle}
          title={t('inspector.collapse.show', 'Show properties')}
          aria-label={t('inspector.collapse.show', 'Show properties')}
          className="mt-2 flex h-7 w-7 items-center justify-center rounded-full border border-cp-border bg-cp-surface-1 text-cp-text-secondary shadow-sm transition-all hover:border-sky-500 hover:bg-cp-surface-2 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span className="text-cp-lg leading-none">‹</span>
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={t('inspector.collapse.show', 'Show properties')}
          className="mt-3 flex-1 self-stretch text-cp-xs font-semibold uppercase tracking-[0.18em] text-cp-text-muted transition-colors hover:text-cp-text-secondary focus-visible:outline-none focus-visible:text-sky-300"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {t('inspector.subtitle', 'Properties')}
        </button>
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-cp-border bg-cp-surface-3 text-cp-text">
      <div className="flex items-start justify-between gap-2 border-b border-cp-border-muted px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-cp-base font-semibold">{title}</h2>
          <div className="mt-0.5 text-cp-xs uppercase tracking-wide text-cp-text-muted">
            {t('inspector.subtitle', 'Properties')}
          </div>
        </div>
        <div className={`flex shrink-0 items-center gap-1 ${inPopout ? 'hidden' : ''}`}>
          <PanelWindowMenu
            titel={t('inspector.subtitle', 'Properties')}
            onPointerDown={tearOff.onPointerDown}
            draggedRef={tearOff.draggedRef}
            onUndock={() => {
              setFloating(true)
              window.setTimeout(triggerCanvasFitView, 60)
            }}
            onPopout={() => openPanelPopout('properties')}
          />
          <button
            type="button"
            onClick={toggle}
            title={t('inspector.collapse.hide', 'Hide properties')}
            aria-label={t('inspector.collapse.hide', 'Hide properties')}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-cp-border bg-cp-surface-1 text-cp-text-secondary transition-all hover:border-sky-500 hover:bg-cp-surface-2 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span className="text-cp-lg leading-none">›</span>
          </button>
        </div>
      </div>
      {body}
    </aside>
  )
}
