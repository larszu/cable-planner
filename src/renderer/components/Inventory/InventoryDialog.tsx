import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, PackagePlus, Boxes } from 'lucide-react'
import { ModalShell } from '../shared/ModalShell'
import { useTranslation, format } from '../../lib/i18n'
import { useInventoryStore, type InventoryItemInput } from '../../store/inventoryStore'
import { useProjectStore } from '../../store/projectStore'
import type { InventoryItem, InventoryOwnership } from '../../types/inventory'
import { confirmDialog } from '../../lib/confirmDialog'
import { infoDialog } from '../../lib/infoDialog'

/**
 * Phase 2 — Zentraler Bestand (docs/inventory-rental-readiness.md).
 *
 * Plan-unabhängige „Lager"-Ansicht: CRUD über die Lager-Artikel (`items[]`)
 * plus ein Seed-Button, der das Equipment des aktuellen Plans gruppiert ins
 * Lager übernimmt. Gated durchs `rental`-Modul (Menü-Eintrag in MenuBar).
 */

export interface InventoryDialogProps {
  open: boolean
  onClose: () => void
}

type FormState = InventoryItemInput & { id?: string }

const emptyForm = (): FormState => ({ model: '', quantity: 1 })

const inputCls = 'mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5'

export const InventoryDialog = ({ open, onClose }: InventoryDialogProps) => {
  const t = useTranslation()
  const items = useInventoryStore((s) => s.items)
  const addItem = useInventoryStore((s) => s.addItem)
  const updateItem = useInventoryStore((s) => s.updateItem)
  const removeItem = useInventoryStore((s) => s.removeItem)
  const seedFromEquipment = useInventoryStore((s) => s.seedFromEquipment)
  const equipment = useProjectStore((s) => s.project.equipment)

  const [form, setForm] = useState<FormState | null>(null)
  const [query, setQuery] = useState('')

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.model.localeCompare(b.model, undefined, { sensitivity: 'base' }),
      ),
    [items],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((it) =>
      [it.model, it.manufacturer, it.category, it.stockLocation, it.supplier]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    )
  }, [sorted, query])

  const totalUnits = useMemo(() => items.reduce((sum, it) => sum + it.quantity, 0), [items])

  const handleSave = () => {
    if (!form || form.model.trim() === '') return
    const payload: InventoryItemInput = {
      model: form.model.trim(),
      manufacturer: form.manufacturer?.trim() || undefined,
      category: form.category?.trim() || undefined,
      quantity: Number.isFinite(form.quantity) ? Math.max(0, Math.round(form.quantity)) : 0,
      rentPricePerDay:
        form.rentPricePerDay != null && form.rentPricePerDay >= 0 ? form.rentPricePerDay : undefined,
      stockLocation: form.stockLocation?.trim() || undefined,
      supplier: form.supplier?.trim() || undefined,
      ownership: form.ownership,
      notes: form.notes?.trim() || undefined,
    }
    if (form.id) updateItem(form.id, payload)
    else addItem(payload)
    setForm(null)
  }

  const handleDelete = async (item: InventoryItem) => {
    const ok = await confirmDialog(
      t('inventory.deleteTitle', 'Artikel löschen?'),
      {
        body: format(t('inventory.deleteBody', '„{model}" wird aus dem Lager entfernt.'), {
          model: item.model,
        }),
        okLabel: t('common.delete', 'Löschen'),
        cancelLabel: t('common.cancel', 'Abbrechen'),
        destructive: true,
      },
    )
    if (ok) removeItem(item.id)
  }

  const handleSeed = async () => {
    if (equipment.length === 0) {
      await infoDialog(t('inventory.seedEmptyTitle', 'Kein Equipment im Plan'), {
        tone: 'info',
        body: t('inventory.seedEmptyBody', 'Der aktuelle Plan enthält keine Geräte zum Übernehmen.'),
      })
      return
    }
    const created = seedFromEquipment(equipment)
    await infoDialog(t('inventory.seedDoneTitle', 'Übernahme abgeschlossen'), {
      tone: 'success',
      body: format(
        t(
          'inventory.seedDoneBody',
          '{count} neue Artikel aus dem Plan übernommen (vorhandene wurden nicht dupliziert).',
        ),
        { count: created },
      ),
    })
  }

  const ownershipLabel = (o?: InventoryOwnership) => {
    if (o === 'owned') return t('inventory.owned', 'Eigentum')
    if (o === 'rented') return t('inventory.rented', 'gemietet')
    if (o === 'subhire') return t('inventory.subhire', 'Sub-Miete')
    return '—'
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      maxWidth="5xl"
      titleIcon={<Boxes size={16} />}
      title={t('inventory.title', 'Lager / Bestand')}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-cp-xs text-cp-text-muted">
            {format(t('inventory.summary', '{items} Artikel · {units} Einheiten gesamt'), {
              items: items.length,
              units: totalUnits,
            })}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('common.close', 'Schließen')}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-cp-xs">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('inventory.searchPh', 'Suchen…')}
            className="min-w-[8rem] flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5"
          />
          <button
            type="button"
            onClick={handleSeed}
            className="flex items-center gap-1 rounded bg-cp-surface-4 px-2.5 py-1.5 hover:bg-cp-surface-5"
            title={t('inventory.seedHint', 'Geräte des aktuellen Plans als Lager-Artikel übernehmen')}
          >
            <PackagePlus size={14} />
            {t('inventory.seed', 'Aus Plan übernehmen')}
          </button>
          <button
            type="button"
            onClick={() => setForm(emptyForm())}
            className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 hover:bg-emerald-600"
          >
            <Plus size={14} />
            {t('inventory.add', 'Artikel')}
          </button>
        </div>

        {/* Add/Edit form */}
        {form && (
          <div className="rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
            <div className="mb-2 font-medium">
              {form.id ? t('inventory.editTitle', 'Artikel bearbeiten') : t('inventory.newTitle', 'Neuer Artikel')}
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <label className="block">
                {t('inventory.model', 'Modell')} <span className="text-red-400">*</span>
                <input
                  autoFocus
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                {t('inventory.manufacturer', 'Hersteller')}
                <input
                  value={form.manufacturer ?? ''}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                {t('inventory.category', 'Kategorie')}
                <input
                  value={form.category ?? ''}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                {t('inventory.quantity', 'Menge')}
                <input
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className={inputCls}
                />
              </label>
              <label className="block">
                {t('inventory.rentPrice', 'Mietpreis/Tag (€)')}
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.rentPricePerDay ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rentPricePerDay: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className={inputCls}
                />
              </label>
              <label className="block">
                {t('inventory.ownership', 'Eigentum')}
                <select
                  value={form.ownership ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ownership: (e.target.value || undefined) as InventoryOwnership | undefined,
                    })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  <option value="owned">{t('inventory.owned', 'Eigentum')}</option>
                  <option value="rented">{t('inventory.rented', 'gemietet')}</option>
                  <option value="subhire">{t('inventory.subhire', 'Sub-Miete')}</option>
                </select>
              </label>
              <label className="block">
                {t('inventory.stockLocation', 'Lagerort')}
                <input
                  value={form.stockLocation ?? ''}
                  onChange={(e) => setForm({ ...form, stockLocation: e.target.value })}
                  placeholder={t('inventory.stockLocationPh', 'z.B. Regal A3')}
                  className={inputCls}
                />
              </label>
              <label className="block">
                {t('inventory.supplier', 'Lieferant')}
                <input
                  value={form.supplier ?? ''}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="block md:col-span-1">
                {t('inventory.notes', 'Notiz')}
                <input
                  value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={inputCls}
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5"
              >
                {t('common.cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                disabled={form.model.trim() === ''}
                onClick={handleSave}
                className="rounded bg-emerald-700 px-3 py-1 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('common.save', 'Speichern')}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="rounded border border-dashed border-cp-border py-10 text-center text-cp-text-muted">
            {items.length === 0
              ? t('inventory.empty', 'Noch keine Lager-Artikel. Lege welche an oder übernimm sie aus dem Plan.')
              : t('inventory.noMatch', 'Keine Artikel passen zur Suche.')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-cp-border">
            <table className="w-full border-collapse text-left">
              <thead className="bg-cp-surface-2 text-cp-text-muted">
                <tr>
                  <th className="px-2 py-1.5 font-medium">{t('inventory.model', 'Modell')}</th>
                  <th className="px-2 py-1.5 font-medium">{t('inventory.manufacturer', 'Hersteller')}</th>
                  <th className="px-2 py-1.5 font-medium">{t('inventory.category', 'Kategorie')}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t('inventory.quantity', 'Menge')}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{t('inventory.rentPriceShort', '€/Tag')}</th>
                  <th className="px-2 py-1.5 font-medium">{t('inventory.stockLocation', 'Lagerort')}</th>
                  <th className="px-2 py-1.5 font-medium">{t('inventory.ownership', 'Eigentum')}</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} className="border-t border-cp-border-muted hover:bg-cp-surface-2">
                    <td className="px-2 py-1.5">{it.model}</td>
                    <td className="px-2 py-1.5 text-cp-text-secondary">{it.manufacturer ?? '—'}</td>
                    <td className="px-2 py-1.5 text-cp-text-secondary">{it.category ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{it.quantity}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-cp-text-secondary">
                      {it.rentPricePerDay != null ? it.rentPricePerDay.toFixed(2) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-cp-text-secondary">{it.stockLocation ?? '—'}</td>
                    <td className="px-2 py-1.5 text-cp-text-secondary">{ownershipLabel(it.ownership)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setForm({ ...it })}
                          className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text"
                          title={t('common.edit', 'Bearbeiten')}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(it)}
                          className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300"
                          title={t('common.delete', 'Löschen')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModalShell>
  )
}
