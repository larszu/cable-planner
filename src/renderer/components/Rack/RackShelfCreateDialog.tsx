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

  if (!open) return null

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
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-[95vw] rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('rack.shelf.title', 'Rack-Shelf anlegen')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label={t('common.close', 'Schließen')}
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">{t('rack.shelf.name', 'Name')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">{t('rack.shelf.heightUnits', 'Höhe (HE)')}</span>
              <input
                type="number"
                min={1}
                max={6}
                value={heightUnits}
                onChange={(e) => setHeightUnits(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">{t('rack.shelf.depth', 'Tiefe (mm)')}</span>
              <input
                type="number"
                min={150}
                max={1200}
                step={50}
                value={depthMm}
                onChange={(e) =>
                  setDepthMm(Math.max(150, Math.min(1200, Number(e.target.value) || 450)))
                }
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
              />
            </label>
          </div>
          <div className="rounded border border-slate-800 bg-slate-950/50 p-2 text-[11px] text-slate-400">
            {t('rack.shelf.tip', 'Tipp: Lege das Shelf auf den gewünschten HE-Slot, danach platziere beliebige Non-19"-Items mit demselben Start-HE — sie erscheinen optisch auf dem Shelf.')}
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
          >
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-600"
          >
            {t('rack.shelf.create', 'Shelf erstellen')}
          </button>
        </div>
      </div>
    </div>
  )
}
