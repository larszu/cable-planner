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
import { Button } from '../shared/Button'
import { ModalShell } from '../shared/ModalShell'
import { ALL_CONNECTOR_TYPES, type ConnectorType, type EquipmentTemplate } from '../../types/equipment'
import { useUiStore } from '../../store/uiStore'
import { format, useTranslation } from '../../lib/i18n'
import { ConnectorPicker } from '../shared/ConnectorPicker'
import { connectorGender, connectorLabel } from '../../lib/connectorCatalog'

interface PatchPanelCreateDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (template: EquipmentTemplate) => void
}

interface PortDraft {
  id: string
  label: string
  frontConnectorType: ConnectorType
  rearConnectorType: ConnectorType
}

const COMMON_PORT_COUNTS = [12, 16, 24, 32, 48]

export const PatchPanelCreateDialog = ({ open, onClose, onCreated }: PatchPanelCreateDialogProps) => {
  const t = useTranslation()
  const [name, setName] = useState('Patchblende')
  const [heightUnits, setHeightUnits] = useState(1)
  const [portCount, setPortCount] = useState(24)
  // v7.9.77 / #170 — Adapter-Patchblende: Front und Rear können
  // unterschiedliche Connector-Typen haben (z.B. BNC vorne, RJ45 hinten).
  // Wenn beide gleich sind, ist es eine klassische Patchblende ohne Adapter.
  const [frontConnector, setFrontConnector] = useState<ConnectorType>('BNC')
  const [rearConnector, setRearConnector] = useState<ConnectorType>('BNC')
  const [adapterMode, setAdapterMode] = useState(false)
  const [tab, setTab] = useState<'basics' | 'ports'>('basics')
  const [perPortOverrides, setPerPortOverrides] = useState<
    Record<number, { label?: string; front?: ConnectorType; rear?: ConnectorType }>
  >({})
  const [mountSide, setMountSide] = useState<'front' | 'rear' | 'full'>('full')
  // v7.9.75 — Custom Connector-Typen sind in uiStore.customConnectorTypes
  // hinterlegt und sollen im Patch-Builder ebenfalls verfügbar sein.
  const customConnectorTypes = useUiStore((s) => s.customConnectorTypes)

  // v7.9.75 — Legacy- + Custom-Typen, die der ConnectorPicker zusätzlich zum
  // kategorisierten Katalog einblendet (unter "Allgemein"), damit nichts aus
  // der bisherigen Auswahl verloren geht.
  const extraConnectorTypes = useMemo<string[]>(
    () => [...ALL_CONNECTOR_TYPES, ...customConnectorTypes],
    [customConnectorTypes],
  )

  const ports = useMemo<PortDraft[]>(
    () =>
      Array.from({ length: portCount }, (_, idx) => {
        const override = perPortOverrides[idx]
        return {
          id: uuidv4(),
          label: override?.label ?? `P${idx + 1}`,
          frontConnectorType: override?.front ?? frontConnector,
          rearConnectorType: override?.rear ?? (adapterMode ? rearConnector : frontConnector),
        }
      }),
    [portCount, frontConnector, rearConnector, adapterMode, perPortOverrides],
  )

  const handleCreate = () => {
    // v7.9.77 / #170 — Adapter-Patchblende: inputs (Front-Seite) und
    // outputs (Rear-Seite) bekommen unabhängige Connector-Typen.
    // Klassische Patchblende: frontConnector === rearConnector (= adapterMode false).
    const template: EquipmentTemplate = {
      name: name.trim() || 'Patchblende',
      category: adapterMode ? 'Patchblende (Adapter)' : 'Patchblende',
      inputs: ports.map((p) => ({
        id: uuidv4(),
        name: `${p.label} (Front)`,
        type: p.frontConnectorType,
        connectorType: p.frontConnectorType,
        // #170 — Katalog-Stecker tragen ihr Geschlecht (XLR 3 Male/Female …);
        // wird als ♂/♀ am Port gezeigt und in Patchliste/Etiketten genutzt.
        gender: connectorGender(p.frontConnectorType),
      })),
      outputs: ports.map((p) => ({
        id: uuidv4(),
        name: `${p.label} (Rear)`,
        type: p.rearConnectorType,
        connectorType: p.rearConnectorType,
        gender: connectorGender(p.rearConnectorType),
      })),
      isRackDevice: true,
      isPatchPanel: true,
      rackUnits: heightUnits,
      depthMm: 50,
      width: 240,
      height: 80 + Math.max(heightUnits, 1) * 22,
      notes: adapterMode
        ? `${portCount}-fach Adapter-Patchfeld: Front ${connectorLabel(frontConnector)} ↔ Rear ${connectorLabel(rearConnector)}.${mountSide !== 'full' ? ` Mount: ${mountSide}.` : ''}`
        : `${portCount}-fach Patchfeld, ${connectorLabel(frontConnector)}.${mountSide !== 'full' ? ` Mount: ${mountSide}.` : ''}`,
    }
    onCreated(template)
    onClose()
  }

  const setOverride = (
    idx: number,
    patch: { label?: string; front?: ConnectorType; rear?: ConnectorType },
  ) => {
    setPerPortOverrides((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], ...patch },
    }))
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('rack.patchPanel.title', 'Patchblende anlegen')}
      maxWidth="xl"
      zIndex={200}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel', 'Abbrechen')}
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            {t('rack.patchPanel.create', 'Patchblende erstellen')}
          </Button>
        </div>
      }
    >
        <div className="mb-3 flex overflow-hidden rounded border border-cp-border text-cp-xs">
          <button
            type="button"
            onClick={() => setTab('basics')}
            className={`flex-1 px-3 py-1.5 ${
              tab === 'basics' ? 'bg-sky-700 text-white' : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
            }`}
          >
            {t('rack.patchPanel.tab.basics', 'Basics')}
          </button>
          <button
            type="button"
            onClick={() => setTab('ports')}
            className={`flex-1 px-3 py-1.5 ${
              tab === 'ports' ? 'bg-sky-700 text-white' : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
            }`}
          >
            {format(t('rack.patchPanel.tab.perPort', 'Per-Port-Detail ({count})'), { count: portCount })}
          </button>
        </div>

        {tab === 'basics' && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('rack.patchPanel.name', 'Name')}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1.5"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('rack.patchPanel.heightUnits', 'Höhe (HE)')}</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={heightUnits}
                  onChange={(e) => setHeightUnits(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                  className="w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('rack.patchPanel.mount', 'Montage')}</span>
                <select
                  value={mountSide}
                  onChange={(e) => setMountSide(e.target.value as 'front' | 'rear' | 'full')}
                  className="w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1.5"
                  title={t('rack.patchPanel.mountTitle', 'Patchblenden sind häufig rear-mounted hinter vorderen Geräten.')}
                >
                  <option value="full">{t('rack.patchPanel.mount.full', 'Full-Depth (vorne)')}</option>
                  <option value="front">{t('rack.patchPanel.mount.front', 'Nur vorne')}</option>
                  <option value="rear">{t('rack.patchPanel.mount.rear', 'Nur hinten')}</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('rack.patchPanel.portCount', 'Anzahl Ports')}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={128}
                  value={portCount}
                  onChange={(e) => setPortCount(Math.max(1, Math.min(128, Number(e.target.value) || 1)))}
                  className="w-24 rounded border border-cp-border bg-cp-surface-3 px-2 py-1.5"
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
                          : 'bg-cp-surface-2 text-cp-text-muted hover:bg-cp-surface-4'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </label>
            {/* v7.9.77 / #170 — Adapter-Toggle: bei eingeschalteter
                Adapter-Mode zeigt der Dialog zwei separate Connector-
                Selects (Front + Rear). Ohne Adapter-Mode wird der Rear-
                Connector automatisch dem Front gleichgesetzt — klassische
                Patchblende. */}
            <label className="flex items-center gap-2 rounded border border-cp-border bg-cp-surface-3/40 px-2 py-1.5 text-cp-xs">
              <input
                type="checkbox"
                checked={adapterMode}
                onChange={(e) => setAdapterMode(e.target.checked)}
                className="accent-sky-500"
              />
              <span className="flex-1">
                <span className="font-medium text-cp-text-bright">{t('rack.patchPanel.adapter', 'Adapter-Patchblende')}</span>
                <span className="ml-1 text-[10px] text-cp-text-muted">
                  {t('rack.patchPanel.adapterHint', '(Front ≠ Rear Stecker, mit internem Adapterkabel)')}
                </span>
              </span>
            </label>
            <div className={`grid gap-2 ${adapterMode ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-muted">
                  {adapterMode ? t('rack.patchPanel.frontConnector', 'Front-Connector') : t('rack.patchPanel.bothConnector', 'Connector-Typ (beide Seiten)')}
                </span>
                <ConnectorPicker
                  value={frontConnector}
                  onChange={(id) => setFrontConnector(id as ConnectorType)}
                  extraTypes={extraConnectorTypes}
                  ariaLabel={
                    adapterMode
                      ? t('rack.patchPanel.frontConnector', 'Front-Connector')
                      : t('rack.patchPanel.bothConnector', 'Connector-Typ (beide Seiten)')
                  }
                />
              </label>
              {adapterMode && (
                <label className="block">
                  <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('rack.patchPanel.rearConnector', 'Rear-Connector')}</span>
                  <ConnectorPicker
                    value={rearConnector}
                    onChange={(id) => setRearConnector(id as ConnectorType)}
                    extraTypes={extraConnectorTypes}
                    ariaLabel={t('rack.patchPanel.rearConnector', 'Rear-Connector')}
                  />
                </label>
              )}
            </div>
            <span className="block text-[10px] text-cp-text-muted">
              {format(t('rack.patchPanel.appliesToAllPorts', 'Wirkt auf alle {count} Ports. Einzeln im Tab "Per-Port-Detail" anpassbar.'), { count: portCount })}
              {adapterMode
                ? ` ${t('rack.patchPanel.adapterCouplingNote', 'Jeder Front-Port koppelt intern via Adapterkabel auf den gleichnamigen Rear-Port.')}`
                : ''}
            </span>
          </div>
        )}

        {tab === 'ports' && (
          <div className="space-y-2">
            <div className="text-[10px] text-cp-text-muted">
              {t('rack.patchPanel.perPortNote', 'Pro Port Label und Connector-Typ überschreibbar. Leerlassen = Default.')}
              {adapterMode && ` ${t('rack.patchPanel.perPortAdapterNote', 'Bei Adapter-Patchblende sind Front- und Rear-Connector unabhängig wählbar.')}`}
            </div>
            <div className="max-h-[40vh] overflow-y-auto rounded border border-cp-border-muted">
              <table className="w-full text-cp-xs">
                <thead className="sticky top-0 bg-cp-surface-2 text-cp-text-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">{t('rack.patchPanel.col.label', 'Label')}</th>
                    <th className="px-2 py-1 text-left">{t('rack.patchPanel.col.front', 'Front')}</th>
                    {adapterMode && <th className="px-2 py-1 text-left">{t('rack.patchPanel.col.rear', 'Rear')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {ports.map((p, idx) => (
                    <tr key={p.id} className="border-t border-cp-border-muted">
                      <td className="px-2 py-0.5 text-cp-text-faint">{idx + 1}</td>
                      <td className="px-2 py-0.5">
                        <input
                          value={perPortOverrides[idx]?.label ?? ''}
                          placeholder={`P${idx + 1}`}
                          onChange={(e) => setOverride(idx, { label: e.target.value || undefined })}
                          className="w-full rounded border border-cp-border bg-cp-surface-3 px-1.5 py-0.5"
                        />
                      </td>
                      <td className="px-2 py-0.5">
                        <ConnectorPicker
                          value={perPortOverrides[idx]?.front ?? frontConnector}
                          onChange={(id) => setOverride(idx, { front: id as ConnectorType })}
                          extraTypes={extraConnectorTypes}
                          size="sm"
                          ariaLabel={`${t('rack.patchPanel.col.front', 'Front')} ${idx + 1}`}
                        />
                      </td>
                      {adapterMode && (
                        <td className="px-2 py-0.5">
                          <ConnectorPicker
                            value={perPortOverrides[idx]?.rear ?? rearConnector}
                            onChange={(id) => setOverride(idx, { rear: id as ConnectorType })}
                            extraTypes={extraConnectorTypes}
                            size="sm"
                            ariaLabel={`${t('rack.patchPanel.col.rear', 'Rear')} ${idx + 1}`}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

    </ModalShell>
  )
}
