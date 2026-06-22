import { useUiStore } from '../../../store/uiStore'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation, format } from '../../../lib/i18n'
import { confirmDialog } from '../../../lib/confirmDialog'
import { RoutingToggle } from '../../shared/RoutingToggle'
import { SettingsCard } from '../SettingsCard'

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
      title={t('settings.editing.endpointLabels', 'Endpoint-Labels an Kabelenden')}
      description={t(
        'settings.editing.endpointLabelsDesc',
        'Zeigt an jedem Kabelende ein kleines Label das anzeigt, wohin das andere Ende geht — am Source-Ende "→ Ziel-Geraet · Ziel-Port", am Target-Ende "← Quell-Geraet · Quell-Port". Hilft beim Verfolgen von Kabeln ohne ihnen visuell folgen zu muessen.',
      )}
    >
      <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
        <input
          type="checkbox"
          checked={showCableEndpointLabels}
          onChange={(e) => setShowCableEndpointLabels(e.target.checked)}
        />
        {t('settings.editing.endpointLabelsLabel', 'Endpoint-Labels einblenden')}
      </label>
      <p className="mt-2 text-[11px] text-cp-text-muted">
        {t('settings.editing.endpointLabelsNote', 'Default aus — gibt zusaetzlichen Visual-Noise. Wirkt zusammen mit dem globalen "Alle Labels ausblenden"-Toggle und respektiert per-Kabel labelPosition=\'none\'.')}
      </p>
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
      title={t('settings.editing.cableInherit', 'Kabel-Typ folgt Port-Connector')}
      description={t(
        'settings.editing.cableInheritDesc',
        'Wenn ein Port-Connector geaendert wird (z.B. BNC -> XLR), uebernehmen verbundene Kabel automatisch den neuen Typ. Gilt auch beim Umstecken auf einen Port mit anderem Connector. Kabel mit Konverter-Hinweis (needsConverter) bleiben unberuehrt.',
      )}
    >
      <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
        <input
          type="checkbox"
          checked={inheritCableTypeFromPort}
          onChange={(e) => setInheritCableTypeFromPort(e.target.checked)}
        />
        {t('settings.editing.cableInheritLabel', 'Kabel-Typ aus Port-Connector ableiten')}
      </label>
      <p className="mt-2 text-[11px] text-cp-text-muted">
        {t(
          'settings.editing.cableInheritNote',
          'Default an: meistens sollen Kabel den physischen Anschluss-Typ ihrer Ports widerspiegeln. Abschalten, wenn Kabel-Typen unabhängig von Port-Typen verwaltet werden sollen.',
        )}
      </p>
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
      title={t('settings.editing.labelSwap', 'Label mit Kabel mit-wandern')}
      description={t(
        'settings.editing.labelSwapDesc',
        'Beim Umstecken eines Kabels uebernimmt der neue Port den User-Namen vom alten Port. Der alte Port faellt auf seinen Template-default zurueck. Spart Copy-Paste vom Label.',
      )}
    >
      <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
        <input
          type="checkbox"
          checked={swapLabelsOnReconnect}
          onChange={(e) => setSwapLabelsOnReconnect(e.target.checked)}
        />
        {t('settings.editing.labelSwapLabel', 'Beim Reconnect Port-Labels mit-tauschen')}
      </label>
      <p className="mt-2 text-[11px] text-cp-text-muted">
        {t(
          'settings.editing.labelSwapNote',
          'Aus Sicherheit per default aus — sonst würden Test-Umsteckungen ungewollt Labels umbenennen. Wirkt nur bei Ports, die einen vom User editierten Namen haben (sonst gibts nichts zu tauschen).',
        )}
      </p>
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
      title={t('settings.editing.cableVisuals', 'Kabel-Darstellung')}
      description={t(
        'settings.editing.cableVisualsDesc',
        'Visuelle Hilfen für orthogonal verlegte Kabel (yEd-ähnliche Brücken bei Kreuzungen und automatische Versetzung sich überlagernder Mittellinien).',
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
          'Kreuzungs-Brücken auf orthogonalen Kabeln',
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
          'Mittellinien automatisch versetzen wenn Kabel sich überlagern',
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
        title={t('settings.editing.routing', 'Standard-Kabelführung')}
        description={t(
          'settings.editing.routingDesc',
          'Welche Form neue Kabel auf dem Canvas haben sollen. Per Kabel überschreibbar.',
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
                    'Routing aller {count} bestehenden Kabel auf "{routing}" setzen?',
                  ),
                  { count: cables.length, routing: defaultRouting },
                ),
                { okLabel: t('common.apply', 'Anwenden') },
              ))
            )
              return
            cables.forEach((c) => {
              if (c.routing !== defaultRouting) updateCable(c.id, { routing: defaultRouting })
            })
          }}
          className="mt-2 w-full rounded bg-cp-surface-2 px-2 py-1 text-[11px] text-cp-text-secondary hover:bg-cp-surface-4 disabled:opacity-50"
        >
          {format(
            t('settings.editing.routing.applyAll', 'Auf alle bestehenden Kabel anwenden ({count})'),
            { count: cables.length },
          )}
        </button>
      </SettingsCard>

      <SettingsCard
        title={t('settings.editing.grid', 'Raster (Grid)')}
        description={t('settings.editing.gridDesc', 'Snap-to-Grid und Rastergröße in Pixeln.')}
      >
        <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
          />
          {t('settings.editing.snapLabel', 'Geräte am Raster einrasten')}
        </label>
        <label className="mt-2 block text-cp-base text-cp-text-secondary">
          {t('settings.editing.gridSize', 'Rastergröße (Pixel)')}
          <input
            type="number"
            min={2}
            max={100}
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value) || 10)}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
          />
        </label>
      </SettingsCard>

      <SettingsCard
        title={t('settings.editing.inlineToolbar', 'Inline-Auswahl-Toolbar')}
        description={t(
          'settings.editing.inlineToolbarDesc',
          'Schwebende Schnellaktionen (Ausrichten, Duplizieren, Rahmen, Löschen) direkt neben der Auswahl auf dem Canvas.',
        )}
      >
        <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
          <input
            type="checkbox"
            checked={inlineToolbarEnabled}
            onChange={(e) => setInlineToolbarEnabled(e.target.checked)}
          />
          {t('settings.editing.inlineToolbarLabel', 'Inline-Toolbar bei Auswahl anzeigen')}
        </label>
      </SettingsCard>

      <CableReconnectOptionsCard />
      <CableInheritTypeCard />
      <CableEndpointLabelsCard />
      <CableVisualOptionsCard />
    </div>
  )
}
