import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useTranslation } from '../../../lib/i18n'
import { SortableSection } from '../SortableSection'
import { Icon } from '../../shared/Icon'
import type { EquipmentItem } from '../../../types/equipment'

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
    </SortableSection>
  )
}
