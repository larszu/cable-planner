/**
 * v7.9.75 / #170 — Rack-Shelf-Quick-Erstellung.
 *
 * Ein Rack-Shelf ist eine flache Plattform die N HE belegt und auf die der
 * User dann Non-19"-Gear "stellen" kann (Mac mini, Encoder-Boxen, Splitter
 * etc.). Aktuell ohne automatische Item-Beziehung — der User legt das
 * Non-19"-Item einfach mit gleichem startUnit ins Rack, der Shelf bildet
 * dann die sichtbare Bodenfläche darunter.
 *
 * Felder: Name, HU-Höhe (Standard 1), Tiefe (mm).
 */
import { useState } from 'react'
import { Button } from '../shared/Button'
import { ModalShell } from '../shared/ModalShell'
import type { EquipmentTemplate } from '../../types/equipment'
import { useTranslation } from '../../lib/i18n'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (template: EquipmentTemplate) => void
}

export const RackShelfCreateDialog = ({ open, onClose, onCreated }: Props) => {
  const t = useTranslation()
  const [name, setName] = useState('Rack-Shelf')
  const [heightUnits, setHeightUnits] = useState(1)
  const [depthMm, setDepthMm] = useState(450)

  const handleCreate = () => {
    const template: EquipmentTemplate = {
      name: name.trim() || 'Rack-Shelf',
      category: 'Rack-Shelf',
      inputs: [],
      outputs: [],
      isRackDevice: true,
      isRackShelf: true,
      rackUnits: heightUnits,
      depthMm,
      width: 240,
      height: 60,
      notes: `Rack-Shelf ${heightUnits}HE, ${depthMm} mm tief. Non-19"-Geräte können visuell darauf platziert werden.`,
    }
    onCreated(template)
    onClose()
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('rack.shelf.title', 'Rack-Shelf anlegen')}
      maxWidth="md"
      zIndex={200}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel', 'Abbrechen')}
          </Button>
          <Button variant="success" onClick={handleCreate}>
            {t('rack.shelf.create', 'Shelf erstellen')}
          </Button>
        </div>
      }
    >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('rack.shelf.name', 'Name')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1.5"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('rack.shelf.heightUnits', 'Höhe (HE)')}</span>
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
              <span className="mb-1 block text-cp-xs text-cp-text-muted">{t('rack.shelf.depth', 'Tiefe (mm)')}</span>
              <input
                type="number"
                min={150}
                max={1200}
                step={50}
                value={depthMm}
                onChange={(e) =>
                  setDepthMm(Math.max(150, Math.min(1200, Number(e.target.value) || 450)))
                }
                className="w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1.5"
              />
            </label>
          </div>
          <div className="rounded border border-cp-border-muted bg-cp-surface-3/50 p-2 text-[11px] text-cp-text-muted">
            {t('rack.shelf.tip', 'Tipp: Lege das Shelf auf den gewünschten HE-Slot, danach platziere beliebige Non-19"-Items mit demselben Start-HE — sie erscheinen optisch auf dem Shelf.')}
          </div>
        </div>
    </ModalShell>
  )
}
