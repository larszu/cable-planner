import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { detectDeviceKind } from '../../../lib/deviceKind'
import { useTranslation } from '../../../lib/i18n'
import { SortableSection } from '../SortableSection'
import { PortList } from '../PortList'
import { PortAiSuggestButton } from './PortAiSuggestButton'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — "Inputs & Outputs"-SortableSection. Enthaelt PortAiSuggestButton
 * plus zwei <details>-Listen (Inputs / Outputs), die unabhaengig kollabieren
 * koennen (#185). showAtemSourceId triggert die ATEM-spezifische
 * Source-ID-Spalte in PortList.
 */
export const PortsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const deviceKind = detectDeviceKind(equipment)
  const isAtem = deviceKind === 'atem'

  // Ports ändern → sobald reale Anschlüsse existieren, ist das Gerät nicht mehr
  // "unbekannt": den explizit-Unbekannt-Marker (aus dem Import ohne Datenblatt-
  // Match) mit entfernen, damit der Plan-Check-Hinweis verschwindet.
  const applyPorts = (patch: Partial<Pick<EquipmentItem, 'inputs' | 'outputs'>>) => {
    const inputs = patch.inputs ?? equipment.inputs
    const outputs = patch.outputs ?? equipment.outputs
    const clearMarker = equipment.portsUnknown && (inputs.length > 0 || outputs.length > 0)
    updateEquipment(equipment.id, {
      ...patch,
      ...(clearMarker ? { portsUnknown: undefined } : {}),
    })
  }

  return (
    <SortableSection
      id="ports"
      title={t('portsSection.title', 'Inputs & Outputs')}
      subtitle={`${equipment.inputs.length} ${t('portsSection.in', 'In')} · ${equipment.outputs.length} ${t('portsSection.out', 'Out')}`}
      defaultOpen
    >
      <div className="space-y-2">
        {equipment.portsUnknown && equipment.inputs.length === 0 && equipment.outputs.length === 0 && (
          <div className="rounded border border-cp-warn/40 bg-cp-warn/10 px-2 py-1.5 text-[11px] text-cp-text-secondary">
            {t(
              'ports.unknown',
              'Port-Belegung unbekannt (kein Datenblatt-Match beim Import). Reale Anschlüsse unten ergänzen — es wurden bewusst keine erfunden.',
            )}
          </div>
        )}
        {/* #317 — Wenn das Gerät bereits Ports hat (was bei Canvas-
            platzierten Geräten der Normalfall ist), brauchen wir den
            AI-Vorschlag-Button hier nicht. Er bleibt für den
            initialen Drop-Wizard-Flow nutzbar, wo Equipment noch
            keine Ports hat (z.B. aus Rentman ohne Port-Daten). */}
        {equipment.inputs.length === 0 && equipment.outputs.length === 0 && (
          <PortAiSuggestButton equipment={equipment} />
        )}
        {/* #419 — "Ports spiegeln" gehoert thematisch zu In/Outputs (und nicht
            mehr zu "Darstellung & Flags"), weil es die Seiten-Zuordnung der
            Inputs/Outputs am Canvas-Knoten umdreht. */}
        <label
          className="flex items-center gap-2 px-1 text-[11px] text-cp-text-secondary"
          title={t(
            'ports.flipTitle',
            'Inputs werden rechts, Outputs werden links am Geräte-Knoten gerendert.',
          )}
        >
          <input
            type="checkbox"
            checked={!!equipment.portsFlipped}
            onChange={(event) =>
              updateEquipment(equipment.id, { portsFlipped: event.target.checked || undefined })
            }
          />
          {t('ports.flip', 'Ports spiegeln (Inputs rechts, Outputs links)')}
        </label>
        <details open className="rounded border border-cp-border-muted bg-cp-surface-3/30">
          <summary className="cursor-pointer select-none px-2 py-1 text-cp-xs font-semibold text-cp-text-secondary hover:text-cp-text">
            {t('ports.title.inputs', 'Inputs')}{' '}
            <span className="text-cp-text-faint">({equipment.inputs.length})</span>
          </summary>
          <div className="px-2 pb-2">
            <PortList
              title={t('ports.title.inputs', 'Inputs')}
              ports={equipment.inputs}
              onChange={(inputs) => applyPorts({ inputs })}
              hideTitle
              showAtemSourceId={isAtem}
            />
          </div>
        </details>
        <details open className="rounded border border-cp-border-muted bg-cp-surface-3/30">
          <summary className="cursor-pointer select-none px-2 py-1 text-cp-xs font-semibold text-cp-text-secondary hover:text-cp-text">
            {t('ports.title.outputs', 'Outputs')}{' '}
            <span className="text-cp-text-faint">({equipment.outputs.length})</span>
          </summary>
          <div className="px-2 pb-2">
            <PortList
              title={t('ports.title.outputs', 'Outputs')}
              ports={equipment.outputs}
              onChange={(outputs) => applyPorts({ outputs })}
              hideTitle
              showAtemSourceId={isAtem}
            />
          </div>
        </details>
      </div>
    </SortableSection>
  )
}
