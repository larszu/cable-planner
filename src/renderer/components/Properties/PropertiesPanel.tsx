import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { CableProperties } from './CableProperties'
import { EquipmentProperties } from './EquipmentProperties'
import { LocationProperties } from './LocationProperties'
import { TemplateProperties } from './TemplateProperties'
import { ExternalLink } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { FloatingPanelShell } from '../Layout/FloatingPanelShell'
import { openPanelPopout, isPopout } from '../../lib/panelPopout'
import { usePanelTearOff } from '../../lib/usePanelTearOff'
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
    ? format(t('inspector.title.equipment', 'Gerät: {name}'), { name: selectedEquipment.name })
    : selectedCable
      ? format(t('inspector.title.cable', 'Kabel: {name}'), { name: selectedCable.name })
      : selectedLocation
        ? format(t('inspector.title.location', 'Rahmen: {name}'), { name: selectedLocation.name })
        : selectedTemplateName
          ? format(t('inspector.title.template', 'Vorlage: {name}'), { name: selectedTemplateName })
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
                {t('inspector.nothingSelected', 'Nichts ausgewählt')}
              </div>
              <div>
                {t(
                  'inspector.nothingSelectedBody',
                  'Wähle ein Gerät, Kabel, Rahmen oder eine Library-Vorlage aus.',
                )}
              </div>
            </div>
            <div className="rounded border border-cp-border-muted bg-cp-surface-1/40 p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-cp-text-muted">
                {t('inspector.hints.title', 'Schnelle Orientierung')}
              </div>
              <div className="space-y-1">
                <div>
                  •{' '}
                  {t(
                    'inspector.hints.placeFromLibrary',
                    'Geräte links aus der Library auf den Canvas setzen.',
                  )}
                </div>
                <div>
                  • {t('inspector.hints.connectPorts', 'Ports verbinden, um Kabel zu erstellen.')}
                </div>
                <div>
                  •{' '}
                  {t(
                    'inspector.hints.saveGroup',
                    'Mehrere Geräte auswählen und im Canvas als Gruppe speichern.',
                  )}
                </div>
                <div>
                  •{' '}
                  {t(
                    'inspector.hints.rentmanLocation',
                    'Rentman-Aktionen findest du im Equipment-Tab unter Rentman.',
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
            <span className="text-[10px] uppercase tracking-wide text-cp-text-muted">
              {t('inspector.subtitle', 'Eigenschaften')}
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
          title={t('inspector.collapse.show', 'Eigenschaften einblenden')}
          aria-label={t('inspector.collapse.show', 'Eigenschaften einblenden')}
          className="mt-2 flex h-7 w-7 items-center justify-center rounded-full border border-cp-border bg-cp-surface-1 text-cp-text-secondary shadow-sm transition-all hover:border-sky-500 hover:bg-cp-surface-2 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span className="text-cp-lg leading-none">‹</span>
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={t('inspector.collapse.show', 'Eigenschaften einblenden')}
          className="mt-3 flex-1 self-stretch text-[10px] font-semibold uppercase tracking-[0.18em] text-cp-text-muted transition-colors hover:text-cp-text-secondary focus-visible:outline-none focus-visible:text-sky-300"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {t('inspector.subtitle', 'Eigenschaften')}
        </button>
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-cp-border bg-cp-surface-3 text-cp-text">
      <div className="flex items-start justify-between gap-2 border-b border-cp-border-muted px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-cp-base font-semibold">{title}</h2>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-cp-text-muted">
            {t('inspector.subtitle', 'Eigenschaften')}
          </div>
        </div>
        <div className={`flex shrink-0 items-center gap-1 ${inPopout ? 'hidden' : ''}`}>
          <button
            type="button"
            data-tearoff="handle"
            onPointerDown={tearOff.onPointerDown}
            onClick={() => {
              // Reiner Klick = an Ort und Stelle abdocken; ein Tear-off-Drag
              // hat das bereits erledigt und unterdrückt hier das Doppel-Float.
              if (tearOff.draggedRef.current) return
              setFloating(true)
              window.setTimeout(triggerCanvasFitView, 60)
            }}
            title={t('inspector.float.title', 'Eigenschaften abdocken (klicken oder herausziehen)')}
            aria-label={t('inspector.float.aria', 'Eigenschaften abdocken')}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-cp-border bg-cp-surface-1 text-cp-text-secondary transition-all hover:border-sky-500 hover:bg-cp-surface-2 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            style={{ touchAction: 'none' }}
          >
            <span className="pointer-events-none text-[11px] leading-none">⤢</span>
          </button>
          <button
            type="button"
            onClick={() => openPanelPopout('properties')}
            title={t('panel.popoutTitle', 'In separates Fenster auslagern (weiterer Monitor)')}
            aria-label={t('panel.popout', 'Auslagern')}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-cp-border bg-cp-surface-1 text-cp-text-secondary transition-all hover:border-sky-500 hover:bg-cp-surface-2 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Icon icon={ExternalLink} size="xs" />
          </button>
          <button
            type="button"
            onClick={toggle}
            title={t('inspector.collapse.hide', 'Eigenschaften ausblenden')}
            aria-label={t('inspector.collapse.hide', 'Eigenschaften ausblenden')}
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
