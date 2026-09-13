import { useUiStore } from '../../../store/uiStore'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation, format } from '../../../lib/i18n'
import { confirmDialog } from '../../../lib/confirmDialog'
import { RoutingToggle } from '../../shared/RoutingToggle'
import { SettingsCard } from '../SettingsCard'
import { PanelHint } from '../../shared/PanelHint'
import { PANEL_LIMITS } from '../../../lib/layoutConstants'
import { RASTER_DEFAULT } from '../../../lib/raster'

/**
 * #307 — Editing-Tab aus SettingsDialog ausgelagert. Enthaelt
 * Standard-Kabelfuehrung, Raster + 4 Sub-Cards fuer
 * Kabel-Endpoint-Labels, Connector-Type-Inheritance,
 * Reconnect-Label-Swap und Visual-Options.
 */

/** v7.9.127 — Endpoint-Labels: an jedem Kabelende ein kleines Label
 *  das zeigt, zu welchem Geraet/Port das ANDERE Ende des Kabels geht.
 *  Hilft beim Verfolgen von Kabeln in dichten Plaenen. */
const CableEndpointLabelsCard = () => {
  const t = useTranslation()
  const showCableEndpointLabels = useUiStore((s) => s.showCableEndpointLabels)
  const setShowCableEndpointLabels = useUiStore((s) => s.setShowCableEndpointLabels)
  return (
    <SettingsCard
      title={t('settings.editing.endpointLabels', 'Endpoint labels at cable ends')}
      description={t(
        'settings.editing.endpointLabelsDesc',
        'Shows a small label at each cable end indicating where the other end goes — at the source end "→ target device · target port", at the target end "← source device · source port". Helps trace cables without following them visually.',
      )}
    >
      <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
        <input
          type="checkbox"
          checked={showCableEndpointLabels}
          onChange={(e) => setShowCableEndpointLabels(e.target.checked)}
        />
        {t('settings.editing.endpointLabelsLabel', 'Show endpoint labels')}
      </label>
      <PanelHint
        className="mt-2 text-cp-xs text-cp-text-muted"
        text={t('settings.editing.endpointLabelsNote', 'Off by default — adds extra visual noise. Works together with the global "Hide all labels" toggle and respects per-cable labelPosition=\'none\'.')}
      />
    </SettingsCard>
  )
}

/** v7.9.125 — Cable Connector Type Inheritance. Wenn aktiv (default),
 *  folgt Cable.type automatisch dem ConnectorType der angeschlossenen
 *  Ports: wechselt der User in den Eigenschaften eines Geraets den
 *  Connector eines Ports (BNC -> XLR), nehmen verbundene Kabel den
 *  neuen Typ an. Cables mit needsConverter bleiben unberuehrt. */
const CableInheritTypeCard = () => {
  const t = useTranslation()
  const inheritCableTypeFromPort = useUiStore((s) => s.inheritCableTypeFromPort)
  const setInheritCableTypeFromPort = useUiStore((s) => s.setInheritCableTypeFromPort)
  return (
    <SettingsCard
      title={t('settings.editing.cableInherit', 'Cable type follows port connector')}
      description={t(
        'settings.editing.cableInheritDesc',
        'When a port connector is changed (e.g. BNC -> XLR), connected cables automatically adopt the new type. Also applies when re-plugging to a port with a different connector. Cables with a converter hint (needsConverter) stay untouched.',
      )}
    >
      <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
        <input
          type="checkbox"
          checked={inheritCableTypeFromPort}
          onChange={(e) => setInheritCableTypeFromPort(e.target.checked)}
        />
        {t('settings.editing.cableInheritLabel', 'Derive cable type from port connector')}
      </label>
      <PanelHint
        className="mt-2 text-cp-xs text-cp-text-muted"
        text={t(
          'settings.editing.cableInheritNote',
          'On by default: cables should usually reflect the physical connector type of their ports. Turn off if cable types are managed independently of port types.',
        )}
      />
    </SettingsCard>
  )
}

/** v7.9.113 / Issue #232 — Label-Swap-Toggle. Wenn aktiv, wandert der
 *  vom User vergebene Port-Name beim Cable-Reconnect mit dem Kabel mit
 *  und der vorherige Port faellt auf seinen Template-Default-Namen
 *  zurueck. Spart Copy-Paste beim Umstecken. */
const CableReconnectOptionsCard = () => {
  const t = useTranslation()
  const swapLabelsOnReconnect = useUiStore((s) => s.swapLabelsOnReconnect)
  const setSwapLabelsOnReconnect = useUiStore((s) => s.setSwapLabelsOnReconnect)
  return (
    <SettingsCard
      title={t('settings.editing.labelSwap', 'Label travels with the cable')}
      description={t(
        'settings.editing.labelSwapDesc',
        'When re-plugging a cable, the new port adopts the user name from the old port. The old port falls back to its template default. Saves copy-pasting the label.',
      )}
    >
      <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
        <input
          type="checkbox"
          checked={swapLabelsOnReconnect}
          onChange={(e) => setSwapLabelsOnReconnect(e.target.checked)}
        />
        {t('settings.editing.labelSwapLabel', 'Swap port labels on reconnect')}
      </label>
      <PanelHint
        className="mt-2 text-cp-xs text-cp-text-muted"
        text={t(
          'settings.editing.labelSwapNote',
          'Off by default for safety — otherwise test re-plugging would unintentionally rename labels. Only affects ports with a user-edited name (nothing to swap otherwise).',
        )}
      />
    </SettingsCard>
  )
}

/** Issue #65 / #53: visual options for orthogonal cable routing.
 *  Cable bumps draw a small arc on crossings; collision-shift moves
 *  parallel midlines apart so cables don't overlay. Both are stored
 *  in uiStore so they persist across sessions. */
const CableVisualOptionsCard = () => {
  const t = useTranslation()
  const cableBumps = useUiStore((s) => s.cableBumps)
  const setCableBumps = useUiStore((s) => s.setCableBumps)
  const orthogonalCollisionShift = useUiStore((s) => s.orthogonalCollisionShift)
  const setOrthogonalCollisionShift = useUiStore((s) => s.setOrthogonalCollisionShift)
  return (
    <SettingsCard
      title={t('settings.editing.cableVisuals', 'Cable rendering')}
      description={t(
        'settings.editing.cableVisualsDesc',
        'Visual aids for orthogonally routed cables (yEd-like bridges at crossings and automatic offset of overlapping center lines).',
      )}
    >
      <label className="mb-2 flex items-center gap-2 text-cp-base text-cp-text-bright">
        <input
          type="checkbox"
          checked={cableBumps}
          onChange={(e) => setCableBumps(e.target.checked)}
        />
        {t(
          'settings.editing.cableBumps',
          'Crossing bridges on orthogonal cables',
        )}
      </label>
      <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
        <input
          type="checkbox"
          checked={orthogonalCollisionShift}
          onChange={(e) => setOrthogonalCollisionShift(e.target.checked)}
        />
        {t(
          'settings.editing.collisionShift',
          'Automatically offset center lines when cables overlap',
        )}
      </label>
    </SettingsCard>
  )
}

export const EditingTab = () => {
  const snapToGrid = useUiStore((s) => s.snapToGrid)
  const setSnapToGrid = useUiStore((s) => s.setSnapToGrid)
  const inlineToolbarEnabled = useUiStore((s) => s.inlineToolbarEnabled)
  const setInlineToolbarEnabled = useUiStore((s) => s.setInlineToolbarEnabled)
  const gridSize = useUiStore((s) => s.gridSize)
  const setGridSize = useUiStore((s) => s.setGridSize)
  const defaultRouting = useUiStore((s) => s.defaultRouting)
  const setDefaultRouting = useUiStore((s) => s.setDefaultRouting)
  const cables = useProjectStore((s) => s.project.cables)
  const updateCable = useProjectStore((s) => s.updateCable)
  const t = useTranslation()

  return (
    <div className="space-y-3">
      <SettingsCard
        title={t('settings.editing.routing', 'Default cable routing')}
        description={t(
          'settings.editing.routingDesc',
          'Shape used for new cables on the canvas. Overridable per cable.',
        )}
      >
        <RoutingToggle value={defaultRouting} onChange={setDefaultRouting} />
        <button
          type="button"
          disabled={cables.length === 0}
          onClick={async () => {
            if (
              !(await confirmDialog(
                format(
                  t(
                    'settings.editing.routing.applyAllConfirm',
                    'Set routing of all {count} existing cables to "{routing}"?',
                  ),
                  { count: cables.length, routing: defaultRouting },
                ),
                { okLabel: t('common.apply', 'Apply') },
              ))
            )
              return
            cables.forEach((c) => {
              if (c.routing !== defaultRouting) updateCable(c.id, { routing: defaultRouting })
            })
          }}
          className="mt-2 w-full bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-4 disabled:opacity-50"
        >
          {format(
            t('settings.editing.routing.applyAll', 'Apply to all existing cables ({count})'),
            { count: cables.length },
          )}
        </button>
      </SettingsCard>

      <SettingsCard
        title={t('settings.editing.grid', 'Grid')}
        description={t(
          'settings.editing.gridDesc',
          'One step for everything: equipment snaps to it, port rows sit on it, and automatic cable routing searches on it.',
        )}
      >
        <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
          />
          {t('settings.editing.snapLabel', 'Snap equipment to grid')}
        </label>
        <label className="mt-2 block text-cp-base text-cp-text-secondary">
          {format(
            t('settings.editing.gridSize', 'Grid size in pixels ({min}-{max})'),
            { min: PANEL_LIMITS.gridSize.MIN, max: PANEL_LIMITS.gridSize.MAX },
          )}
          <input
            type="number"
            // Grenzen aus einer Quelle: an ihnen haengt seit 2026-09-12 auch
            // das Zellmass des Wegfinders. Standen sie hier noch einmal als
            // 2 und 100, koennte das Feld einen Wert anbieten, den der Store
            // klemmt — und der Nutzer saehe eine andere Zahl als die, die gilt.
            min={PANEL_LIMITS.gridSize.MIN}
            max={PANEL_LIMITS.gridSize.MAX}
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value) || RASTER_DEFAULT)}
            className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-2"
          />
        </label>
      </SettingsCard>

      <SettingsCard
        title={t('settings.editing.inlineToolbar', 'Inline selection toolbar')}
        description={t(
          'settings.editing.inlineToolbarDesc',
          'Floating quick actions (align, duplicate, frame, delete) right next to the selection on the canvas.',
        )}
      >
        <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
          <input
            type="checkbox"
            checked={inlineToolbarEnabled}
            onChange={(e) => setInlineToolbarEnabled(e.target.checked)}
          />
          {t('settings.editing.inlineToolbarLabel', 'Show inline toolbar on selection')}
        </label>
      </SettingsCard>

      <CableReconnectOptionsCard />
      <CableInheritTypeCard />
      <CableEndpointLabelsCard />
      <CableVisualOptionsCard />
    </div>
  )
}
