import { useState } from 'react'
import { unitLabel } from '../../../lib/unitIdentity'
import { Eye, EyeOff } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useTranslation } from '../../../lib/i18n'
import { SortableSection } from '../SortableSection'
import { Icon } from '../../shared/Icon'
import { ExtraInterfacesPanel } from './ExtraInterfacesPanel'
import type { EquipmentItem } from '../../../types/equipment'
import { useInventoryStore } from '../../../store/inventoryStore'
import { identityAnchors } from '../../../lib/assetIdentity'

/**
 * #306 — "Network & Access"-SortableSection aus EquipmentProperties
 * ausgelagert. Verwaltet die "Basics" pro Geraet: IP, Seriennummer,
 * Subnet, Username, Password (mit Show/Hide-Toggle), Notes.
 *
 * Nicht zu verwechseln mit `NetworkConfig` — das ist die deutlich
 * groessere VLAN-/Routing-Konfig fuer Switches/Router. Hier geht's
 * um die generischen Access-Felder die jedes Geraet haben kann.
 */
export const NetworkAccessSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const [showPassword, setShowPassword] = useState(false)
  // BEDARF 78 — welche KISTE diesen Platz fuellt. Der Bestand liegt in einem
  // eigenen Store (localStorage), nicht am Projekt: dieselbe Kiste faehrt auf
  // mehreren Shows, und sie ins Projektfile zu kopieren waere eine zweite
  // Wahrheit ueber den Lagerbestand.
  const units = useInventoryStore((state) => state.units)
  const items = useInventoryStore((state) => state.items)
  // Die Auswahl erscheint nur an Plaetzen MIT Netz-Identitaet. An einem Stativ
  // ist die Frage „welche Kiste" richtig und hier trotzdem falsch: der Bedarf
  // handelt vom eingebrannten Geraete-Namen, und wo keiner ist, waere das Feld
  // Ballast in jeder Seitenleiste.
  const anchors = identityAnchors(equipment)
  // Bedarf 107 — im Plan zaehlt die Hausreferenz: das Geraet steht hier im
  // eigenen Aufbau, nicht auf einem Versicherungsblatt. Die Regel dafuer steht
  // in `unitLabel` und nicht hier: sie war bis dahin an vier Stellen kopiert.
  const einheitZeile = (u: (typeof units)[number]): string => {
    const modell = items.find((i) => i.id === u.itemId)?.model
    return [modell, unitLabel(u, 'house')].filter(Boolean).join(' · ')
  }

  return (
    <SortableSection
      id="network"
      title={t('netAccess.title', 'Network & Access')}
      subtitle={t('netAccess.subtitle', 'IP · MAC · S/N · Login')}
      defaultOpen
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('eq.field.ipAddress', 'IP Address')}</span>
          <input
            value={equipment.ipAddress ?? ''}
            onChange={(event) =>
              updateEquipment(equipment.id, { ipAddress: event.target.value })
            }
            placeholder="192.168.1.10"
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('eq.field.serial', 'Seriennummer')}</span>
          <input
            value={equipment.serialNumber ?? ''}
            onChange={(event) =>
              updateEquipment(equipment.id, { serialNumber: event.target.value || undefined })
            }
            placeholder={t('eq.field.serialPlaceholder', 'S/N')}
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
        {/* BEDARF 78 — WELCHE Kiste. Direkt neben der Seriennummer, weil die
            beiden gegeneinander gehalten werden: der Freitext ist abgetippt,
            die Einheit kommt aus dem Bestand, und wo sie auseinandergehen, ist
            ein Tausch uebrig geblieben. */}
        {anchors.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">
              {t('eq.field.unit', 'Einheit aus dem Bestand')}
            </span>
            <select
              value={equipment.inventoryUnitId ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, {
                  inventoryUnitId: event.target.value || undefined,
                })
              }
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
            >
              <option value="">{t('eq.field.unitNone', '— nicht benannt —')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {einheitZeile(u)}
                </option>
              ))}
            </select>
            {!equipment.inventoryUnitId && (
              <span className="mt-1 block text-cp-xs text-cp-text-muted">
                {t(
                  'eq.field.unitHint',
                  'Dieser Platz trägt eine Netz-Identität. Ohne benannte Einheit ist ein Tausch gegen eine baugleiche Kiste unsichtbar — der eingebrannte Geräte-Name wandert mit.',
                )}
              </span>
            )}
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('eq.field.subnet', 'Subnet Mask')}</span>
          <input
            value={equipment.subnetMask ?? ''}
            onChange={(event) =>
              updateEquipment(equipment.id, { subnetMask: event.target.value })
            }
            placeholder={t('eq.field.subnetPlaceholder', '255.255.255.0 oder /24')}
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('eq.field.mac', 'MAC-Adresse')}</span>
          <input
            value={equipment.macAddress ?? ''}
            onChange={(event) =>
              updateEquipment(equipment.id, { macAddress: event.target.value || undefined })
            }
            placeholder="00:1A:2B:3C:4D:5E"
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('eq.field.username', 'Username')}</span>
          <input
            value={equipment.username ?? ''}
            onChange={(event) =>
              updateEquipment(equipment.id, { username: event.target.value })
            }
            autoComplete="off"
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('eq.field.password', 'Password')}</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={equipment.password ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { password: event.target.value })
              }
              autoComplete="new-password"
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? t('eq.field.passwordHide', 'Passwort verbergen')
                  : t('eq.field.passwordShow', 'Passwort anzeigen')
              }
              title={
                showPassword
                  ? t('eq.field.passwordHide', 'Passwort verbergen')
                  : t('eq.field.passwordShow', 'Passwort anzeigen')
              }
              className="absolute inset-y-0 right-0 flex items-center px-2 text-cp-text-muted hover:text-cp-text-bright"
            >
              <Icon icon={showPassword ? EyeOff : Eye} size="sm" />
            </button>
          </div>
        </label>
      </div>
      <label className="mt-2 block">
        <span className="mb-1 block text-cp-text-secondary">{t('cable.field.notes', 'Notes')}</span>
        <textarea
          value={equipment.notes ?? ''}
          onChange={(event) => updateEquipment(equipment.id, { notes: event.target.value })}
          rows={3}
          placeholder={t('netAccess.notesPlaceholder', 'Web UI URL, firmware version, wiring notes, …')}
          className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>
      <ExtraInterfacesPanel equipment={equipment} />
    </SortableSection>
  )
}
