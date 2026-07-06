import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, PackagePlus, Boxes, QrCode, Barcode, Package, X } from 'lucide-react'
import { ModalShell } from '../shared/ModalShell'
import { useTranslation, format } from '../../lib/i18n'
import {
  useInventoryStore,
  type InventoryItemInput,
  type InventoryCaseInput,
} from '../../store/inventoryStore'
import { useProjectStore } from '../../store/projectStore'
import type {
  InventoryItem,
  InventoryCase,
  InventoryOwnership,
  InventoryCodeType,
  InventoryMaterialKind,
  PhysicalDimensions,
} from '../../types/inventory'
import { confirmDialog } from '../../lib/confirmDialog'
import { infoDialog } from '../../lib/infoDialog'

/**
 * Lager-Modul — projektübergreifender Bestand (docs/inventory-rental-readiness.md).
 *
 * Plan-unabhängige „Lager"-Ansicht: CRUD über Lager-Artikel (`items[]`) mit
 * festem QR-/Barcode, Maßen und Material-Art (Vermiet/Verbrauch), plus eine
 * Case-Ansicht zum Packen von Artikeln in Flightcases (Case- + Artikelmaße →
 * abgeleitetes Packgewicht). Gated durchs `rental`-Modul (MenuBar).
 */

export interface InventoryDialogProps {
  open: boolean
  onClose: () => void
}

type Tab = 'items' | 'cases'
type ItemFormState = InventoryItemInput & { id?: string }
type CaseFormState = InventoryCaseInput & { id?: string }

const emptyItemForm = (): ItemFormState => ({ model: '', quantity: 1 })
const emptyCaseForm = (): CaseFormState => ({ name: '', contents: [] })

const inputCls = 'mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5'

/** Summe eines Maß-Feldes; undefined wenn nichts gesetzt. */
const dim = (d: PhysicalDimensions | undefined, k: keyof PhysicalDimensions): number | undefined =>
  d?.[k]

/** Kompakte Maß-Anzeige „400×300×200 mm · 3,2 kg". */
const formatDims = (d: PhysicalDimensions | undefined): string => {
  if (!d) return '—'
  const size = [d.widthMm, d.heightMm, d.depthMm]
  const hasSize = size.some((v) => v != null)
  const parts: string[] = []
  if (hasSize) parts.push(`${size.map((v) => (v != null ? v : '?')).join('×')} mm`)
  if (d.weightKg != null) parts.push(`${d.weightKg} kg`)
  return parts.length ? parts.join(' · ') : '—'
}

export const InventoryDialog = ({ open, onClose }: InventoryDialogProps) => {
  const t = useTranslation()
  const items = useInventoryStore((s) => s.items)
  const cases = useInventoryStore((s) => s.cases)
  const addItem = useInventoryStore((s) => s.addItem)
  const updateItem = useInventoryStore((s) => s.updateItem)
  const removeItem = useInventoryStore((s) => s.removeItem)
  const seedFromEquipment = useInventoryStore((s) => s.seedFromEquipment)
  const addCase = useInventoryStore((s) => s.addCase)
  const updateCase = useInventoryStore((s) => s.updateCase)
  const removeCase = useInventoryStore((s) => s.removeCase)
  const packItem = useInventoryStore((s) => s.packItem)
  const unpackItem = useInventoryStore((s) => s.unpackItem)
  const equipment = useProjectStore((s) => s.project.equipment)

  const [tab, setTab] = useState<Tab>('items')
  const [form, setForm] = useState<ItemFormState | null>(null)
  const [caseForm, setCaseForm] = useState<CaseFormState | null>(null)
  const [query, setQuery] = useState('')

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items])

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
      [it.model, it.manufacturer, it.category, it.stockLocation, it.supplier, it.code]
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
      code: form.code?.trim() || undefined,
      codeType: form.code?.trim() ? form.codeType ?? 'qr' : undefined,
      dimensions: form.dimensions,
      materialKinds: form.materialKinds?.length ? form.materialKinds : undefined,
      notes: form.notes?.trim() || undefined,
    }
    if (form.id) updateItem(form.id, payload)
    else addItem(payload)
    setForm(null)
  }

  const handleDelete = async (item: InventoryItem) => {
    const ok = await confirmDialog(t('inventory.deleteTitle', 'Artikel löschen?'), {
      body: format(t('inventory.deleteBody', '„{model}" wird aus dem Lager entfernt.'), {
        model: item.model,
      }),
      okLabel: t('common.delete', 'Löschen'),
      cancelLabel: t('common.cancel', 'Abbrechen'),
      destructive: true,
    })
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

  const handleSaveCase = () => {
    if (!caseForm || caseForm.name.trim() === '') return
    const payload: InventoryCaseInput = {
      name: caseForm.name.trim(),
      dimensions: caseForm.dimensions,
      code: caseForm.code?.trim() || undefined,
      codeType: caseForm.code?.trim() ? caseForm.codeType ?? 'qr' : undefined,
      stockLocation: caseForm.stockLocation?.trim() || undefined,
      contents: caseForm.contents ?? [],
      notes: caseForm.notes?.trim() || undefined,
    }
    if (caseForm.id) updateCase(caseForm.id, payload)
    else addCase(payload)
    setCaseForm(null)
  }

  const handleDeleteCase = async (box: InventoryCase) => {
    const ok = await confirmDialog(t('inventory.caseDeleteTitle', 'Case löschen?'), {
      body: format(t('inventory.caseDeleteBody', '„{name}" wird gelöscht (Artikel bleiben im Lager).'), {
        name: box.name,
      }),
      okLabel: t('common.delete', 'Löschen'),
      cancelLabel: t('common.cancel', 'Abbrechen'),
      destructive: true,
    })
    if (ok) removeCase(box.id)
  }

  const ownershipLabel = (o?: InventoryOwnership) => {
    if (o === 'owned') return t('inventory.owned', 'Eigentum')
    if (o === 'rented') return t('inventory.rented', 'gemietet')
    if (o === 'subhire') return t('inventory.subhire', 'Sub-Miete')
    return '—'
  }

  const toggleMaterialKind = (f: ItemFormState, k: InventoryMaterialKind): InventoryMaterialKind[] => {
    const set = new Set(f.materialKinds ?? [])
    if (set.has(k)) set.delete(k)
    else set.add(k)
    return [...set]
  }

  const materialBadges = (kinds?: InventoryMaterialKind[]) => {
    if (!kinds?.length) return <span className="text-cp-text-muted">—</span>
    return (
      <span className="flex flex-wrap gap-1">
        {kinds.includes('rental') && (
          <span className="rounded bg-cp-accent/20 px-1.5 py-0.5 text-cp-accent">
            {t('inventory.rental', 'Vermietung')}
          </span>
        )}
        {kinds.includes('consumable') && (
          <span className="rounded bg-amber-600/20 px-1.5 py-0.5 text-amber-500">
            {t('inventory.consumable', 'Verbrauch')}
          </span>
        )}
      </span>
    )
  }

  const codeCell = (code?: string, codeType?: InventoryCodeType) => {
    if (!code) return <span className="text-cp-text-muted">—</span>
    return (
      <span className="flex items-center gap-1 text-cp-text-secondary">
        {codeType === 'barcode' ? <Barcode size={12} /> : <QrCode size={12} />}
        <span className="tabular-nums">{code}</span>
      </span>
    )
  }

  // Maß-Editor als kleiner 4-Felder-Block (W/H/D/kg).
  const dimsEditor = (
    d: PhysicalDimensions | undefined,
    onChange: (next: PhysicalDimensions | undefined) => void,
  ) => {
    const set = (k: keyof PhysicalDimensions, v: string) => {
      const num = v === '' ? undefined : Number(v)
      const next: PhysicalDimensions = { ...(d ?? {}), [k]: Number.isFinite(num as number) ? num : undefined }
      const any = next.widthMm || next.heightMm || next.depthMm || next.weightKg
      onChange(any ? next : undefined)
    }
    const cell = (k: keyof PhysicalDimensions, ph: string) => (
      <input
        type="number"
        min={0}
        value={dim(d, k) ?? ''}
        onChange={(e) => set(k, e.target.value)}
        placeholder={ph}
        className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
      />
    )
    return (
      <div className="grid grid-cols-4 gap-1">
        {cell('widthMm', t('inventory.w', 'B mm'))}
        {cell('heightMm', t('inventory.h', 'H mm'))}
        {cell('depthMm', t('inventory.d', 'T mm'))}
        {cell('weightKg', t('inventory.kg', 'kg'))}
      </div>
    )
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
            {format(t('inventory.summary2', '{items} Artikel · {units} Einheiten · {cases} Cases'), {
              items: items.length,
              units: totalUnits,
              cases: cases.length,
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
        {/* Tabs */}
        <div className="flex gap-1 border-b border-cp-border">
          {(['items', 'cases'] as Tab[]).map((tb) => (
            <button
              key={tb}
              type="button"
              onClick={() => setTab(tb)}
              className={`flex items-center gap-1.5 rounded-t px-3 py-1.5 ${
                tab === tb
                  ? 'bg-cp-surface-2 font-medium text-cp-text'
                  : 'text-cp-text-muted hover:text-cp-text'
              }`}
            >
              {tb === 'items' ? <Boxes size={13} /> : <Package size={13} />}
              {tb === 'items'
                ? t('inventory.tabItems', 'Artikel')
                : format(t('inventory.tabCases', 'Cases ({n})'), { n: cases.length })}
            </button>
          ))}
        </div>

        {tab === 'items' && (
          <>
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
                onClick={() => setForm(emptyItemForm())}
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
                  {form.id
                    ? t('inventory.editTitle', 'Artikel bearbeiten')
                    : t('inventory.newTitle', 'Neuer Artikel')}
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
                  {/* Code + Codeart */}
                  <label className="block">
                    {t('inventory.code', 'Code (QR/Barcode)')}
                    <input
                      value={form.code ?? ''}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder={t('inventory.codePh', 'z.B. INV-00123')}
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    {t('inventory.codeType', 'Code-Art')}
                    <select
                      value={form.codeType ?? 'qr'}
                      onChange={(e) => setForm({ ...form, codeType: e.target.value as InventoryCodeType })}
                      className={inputCls}
                    >
                      <option value="qr">{t('inventory.qr', 'QR-Code')}</option>
                      <option value="barcode">{t('inventory.barcode', 'Barcode')}</option>
                    </select>
                  </label>
                  <div className="block">
                    {t('inventory.materialKind', 'Material-Art')}
                    <div className="mt-1 flex gap-3 rounded border border-cp-border bg-cp-surface-3 p-1.5">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={!!form.materialKinds?.includes('rental')}
                          onChange={() => setForm({ ...form, materialKinds: toggleMaterialKind(form, 'rental') })}
                        />
                        {t('inventory.rental', 'Vermietung')}
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={!!form.materialKinds?.includes('consumable')}
                          onChange={() =>
                            setForm({ ...form, materialKinds: toggleMaterialKind(form, 'consumable') })
                          }
                        />
                        {t('inventory.consumable', 'Verbrauch')}
                      </label>
                    </div>
                  </div>
                  {/* Maße */}
                  <div className="block md:col-span-2">
                    {t('inventory.dimensions', 'Maße (B×H×T · Gewicht)')}
                    <div className="mt-1">
                      {dimsEditor(form.dimensions, (next) => setForm({ ...form, dimensions: next }))}
                    </div>
                  </div>
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
                      <th className="px-2 py-1.5 font-medium">{t('inventory.category', 'Kategorie')}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t('inventory.quantity', 'Menge')}</th>
                      <th className="px-2 py-1.5 font-medium">{t('inventory.code', 'Code')}</th>
                      <th className="px-2 py-1.5 font-medium">{t('inventory.materialKind', 'Material-Art')}</th>
                      <th className="px-2 py-1.5 font-medium">{t('inventory.ownership', 'Eigentum')}</th>
                      <th className="px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((it) => (
                      <tr key={it.id} className="border-t border-cp-border-muted hover:bg-cp-surface-2">
                        <td className="px-2 py-1.5">
                          {it.model}
                          {it.manufacturer && (
                            <span className="ml-1 text-cp-text-muted">· {it.manufacturer}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-cp-text-secondary">{it.category ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{it.quantity}</td>
                        <td className="px-2 py-1.5">{codeCell(it.code, it.codeType)}</td>
                        <td className="px-2 py-1.5">{materialBadges(it.materialKinds)}</td>
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
          </>
        )}

        {tab === 'cases' && (
          <CasesTab
            cases={cases}
            items={items}
            itemById={itemById}
            caseForm={caseForm}
            setCaseForm={setCaseForm}
            onSave={handleSaveCase}
            onDelete={handleDeleteCase}
            packItem={packItem}
            unpackItem={unpackItem}
            dimsEditor={dimsEditor}
            formatDims={formatDims}
            codeCell={codeCell}
          />
        )}
      </div>
    </ModalShell>
  )
}

// ── Cases-Tab ────────────────────────────────────────────────────────────────
interface CasesTabProps {
  cases: InventoryCase[]
  items: InventoryItem[]
  itemById: Map<string, InventoryItem>
  caseForm: CaseFormState | null
  setCaseForm: (f: CaseFormState | null) => void
  onSave: () => void
  onDelete: (box: InventoryCase) => void
  packItem: (caseId: string, itemId: string, quantity: number) => void
  unpackItem: (caseId: string, itemId: string) => void
  dimsEditor: (
    d: PhysicalDimensions | undefined,
    onChange: (next: PhysicalDimensions | undefined) => void,
  ) => React.ReactNode
  formatDims: (d: PhysicalDimensions | undefined) => string
  codeCell: (code?: string, codeType?: InventoryCodeType) => React.ReactNode
}

const CasesTab = ({
  cases,
  items,
  itemById,
  caseForm,
  setCaseForm,
  onSave,
  onDelete,
  packItem,
  unpackItem,
  dimsEditor,
  formatDims,
  codeCell,
}: CasesTabProps) => {
  const t = useTranslation()
  const [packSel, setPackSel] = useState<Record<string, string>>({})

  /** Gepacktes Gewicht: Case-Leergewicht + Σ(Artikelgewicht × Stück). */
  const packedWeight = (box: InventoryCase): number | undefined => {
    let sum = box.dimensions?.weightKg ?? 0
    let any = box.dimensions?.weightKg != null
    for (const p of box.contents) {
      const w = itemById.get(p.itemId)?.dimensions?.weightKg
      if (w != null) {
        sum += w * p.quantity
        any = true
      }
    }
    return any ? Math.round(sum * 100) / 100 : undefined
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCaseForm(emptyCaseForm())}
          className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 hover:bg-emerald-600"
        >
          <Plus size={14} />
          {t('inventory.addCase', 'Case')}
        </button>
      </div>

      {caseForm && (
        <div className="rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
          <div className="mb-2 font-medium">
            {caseForm.id ? t('inventory.editCase', 'Case bearbeiten') : t('inventory.newCase', 'Neues Case')}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <label className="block">
              {t('inventory.caseName', 'Case-Name')} <span className="text-red-400">*</span>
              <input
                autoFocus
                value={caseForm.name}
                onChange={(e) => setCaseForm({ ...caseForm, name: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block">
              {t('inventory.stockLocation', 'Lagerort')}
              <input
                value={caseForm.stockLocation ?? ''}
                onChange={(e) => setCaseForm({ ...caseForm, stockLocation: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block">
              {t('inventory.code', 'Code (QR/Barcode)')}
              <input
                value={caseForm.code ?? ''}
                onChange={(e) => setCaseForm({ ...caseForm, code: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block">
              {t('inventory.codeType', 'Code-Art')}
              <select
                value={caseForm.codeType ?? 'qr'}
                onChange={(e) => setCaseForm({ ...caseForm, codeType: e.target.value as InventoryCodeType })}
                className={inputCls}
              >
                <option value="qr">{t('inventory.qr', 'QR-Code')}</option>
                <option value="barcode">{t('inventory.barcode', 'Barcode')}</option>
              </select>
            </label>
            <div className="block md:col-span-2">
              {t('inventory.caseDimensions', 'Case-Außenmaße (B×H×T · Leergewicht)')}
              <div className="mt-1">
                {dimsEditor(caseForm.dimensions, (next) => setCaseForm({ ...caseForm, dimensions: next }))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCaseForm(null)}
              className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5"
            >
              {t('common.cancel', 'Abbrechen')}
            </button>
            <button
              type="button"
              disabled={caseForm.name.trim() === ''}
              onClick={onSave}
              className="rounded bg-emerald-700 px-3 py-1 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.save', 'Speichern')}
            </button>
          </div>
        </div>
      )}

      {cases.length === 0 ? (
        <div className="rounded border border-dashed border-cp-border py-10 text-center text-cp-text-muted">
          {t('inventory.casesEmpty', 'Noch keine Cases. Lege eins an und packe Artikel hinein.')}
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((box) => {
            const weight = packedWeight(box)
            return (
              <div key={box.id} className="rounded border border-cp-border bg-cp-surface-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cp-border-muted px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      <Package size={14} className="shrink-0 text-cp-text-muted" />
                      <span className="truncate">{box.name}</span>
                      {box.code && codeCell(box.code, box.codeType)}
                    </div>
                    <div className="mt-0.5 text-cp-text-muted">
                      {formatDims(box.dimensions)}
                      {box.stockLocation && ` · ${box.stockLocation}`}
                      {weight != null &&
                        ` · ${format(t('inventory.packedWeight', 'gepackt ~{kg} kg'), { kg: weight })}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setCaseForm({ ...box })}
                      className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text"
                      title={t('common.edit', 'Bearbeiten')}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(box)}
                      className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300"
                      title={t('common.delete', 'Löschen')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="px-3 py-2">
                  {box.contents.length === 0 ? (
                    <div className="text-cp-text-muted">{t('inventory.caseEmpty', 'Leer.')}</div>
                  ) : (
                    <ul className="space-y-1">
                      {box.contents.map((p) => {
                        const it = itemById.get(p.itemId)
                        return (
                          <li key={p.itemId} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate">
                              <span className="tabular-nums text-cp-text-secondary">{p.quantity}×</span>{' '}
                              {it ? it.model : t('inventory.unknownItem', '(gelöschter Artikel)')}
                            </span>
                            <button
                              type="button"
                              onClick={() => unpackItem(box.id, p.itemId)}
                              className="rounded p-0.5 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300"
                              title={t('inventory.unpack', 'Aus Case entfernen')}
                            >
                              <X size={12} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {/* Pack-Zeile */}
                  {items.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <select
                        value={packSel[box.id] ?? ''}
                        onChange={(e) => setPackSel((s) => ({ ...s, [box.id]: e.target.value }))}
                        className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-3 p-1"
                      >
                        <option value="">{t('inventory.pickItem', 'Artikel wählen…')}</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.model}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!packSel[box.id]}
                        onClick={() => {
                          const id = packSel[box.id]
                          if (id) {
                            packItem(box.id, id, 1)
                            setPackSel((s) => ({ ...s, [box.id]: '' }))
                          }
                        }}
                        className="flex items-center gap-1 rounded bg-cp-surface-4 px-2 py-1 enabled:hover:bg-cp-surface-5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <PackagePlus size={13} />
                        {t('inventory.pack', 'Packen')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
