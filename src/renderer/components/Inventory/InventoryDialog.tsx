import { useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  PackagePlus,
  Boxes,
  QrCode,
  Barcode,
  Package,
  Warehouse,
  Layers,
  ChevronRight,
  ScanLine,
  Tags,
  BarChart3,
  ClipboardList,
  Printer,
  QrCode as QrCodeIcon,
} from 'lucide-react'
import QRCode from 'qrcode'
import { ModalShell } from '../shared/ModalShell'
import { useTranslation, format } from '../../lib/i18n'
import {
  useInventoryStore,
  type InventoryItemInput,
  type StorageNodeInput,
  type InventorySetInput,
  type InventoryUnitInput,
} from '../../store/inventoryStore'
import { useProjectStore } from '../../store/projectStore'
import type {
  InventoryItem,
  StorageNode,
  StorageNodeKind,
  InventorySet,
  InventoryUnit,
  UnitCondition,
  InventoryOwnership,
  InventoryCodeType,
  InventoryMaterialKind,
  PhysicalDimensions,
  SetComponent,
} from '../../types/inventory'
import {
  nodePathLabel,
  itemsInNode,
  availabilityOfSet,
  isContainerKind,
  descendantNodeIds,
} from '../../lib/storageTree'
import { resolveInventoryCode } from '../../lib/inventoryScan'
import { derivePackList, packListToText, packListTotalCount } from '../../lib/packList'
import { buildInventoryReport } from '../../lib/inventoryReport'
import { buildPackListHtml } from '../../lib/inventoryPrint'
import { printHtmlDocument } from '../../lib/printHtml'
import {
  ALL_LABEL_FORMATS,
  labelSheetById,
  labelPageCount,
  buildLabelSheetHtml,
  type LabelSpec,
} from '../../lib/labelSheets'
import { renderBarcodeDataUrl } from '../../lib/barcode'
import { confirmDialog } from '../../lib/confirmDialog'
import { infoDialog } from '../../lib/infoDialog'

/**
 * Lager-Modul — projektübergreifender Bestand (docs/inventory-rental-readiness.md).
 *
 * Drei Tabs: **Artikel** (Bestand + Code/Maße/Material-Art + Lagerort-Zuweisung),
 * **Lagerorte** (LPN-Baum: Lagerplätze UND Container mit Codes, verschachtelbar —
 * Case in Case in Transport-Case) und **Sets** (logische Kits mit abgeleiteter
 * Verfügbarkeit). Ein Artikel „liegt" in genau einem Knoten; zeigt der auf einen
 * Container, ist der Artikel eingepackt — alles ergibt sich aus dem Baum.
 */

export interface InventoryDialogProps {
  open: boolean
  onClose: () => void
}

type Tab = 'items' | 'locations' | 'units' | 'sets' | 'labels' | 'reports'
type ItemFormState = InventoryItemInput & { id?: string }

const inputCls = 'mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5'

const dimOf = (d: PhysicalDimensions | undefined, k: keyof PhysicalDimensions): number | undefined =>
  d?.[k]

const formatDims = (d: PhysicalDimensions | undefined): string => {
  if (!d) return '—'
  const size = [d.widthMm, d.heightMm, d.depthMm]
  const parts: string[] = []
  if (size.some((v) => v != null)) parts.push(`${size.map((v) => (v != null ? v : '?')).join('×')} mm`)
  if (d.weightKg != null) parts.push(`${d.weightKg} kg`)
  return parts.length ? parts.join(' · ') : '—'
}

export const InventoryDialog = ({ open, onClose }: InventoryDialogProps) => {
  const t = useTranslation()
  const items = useInventoryStore((s) => s.items)
  const nodes = useInventoryStore((s) => s.nodes)
  const sets = useInventoryStore((s) => s.sets)
  const units = useInventoryStore((s) => s.units)
  const addItem = useInventoryStore((s) => s.addItem)
  const updateItem = useInventoryStore((s) => s.updateItem)
  const removeItem = useInventoryStore((s) => s.removeItem)
  const seedFromEquipment = useInventoryStore((s) => s.seedFromEquipment)
  const equipment = useProjectStore((s) => s.project.equipment)

  const [tab, setTab] = useState<Tab>('items')
  const [form, setForm] = useState<ItemFormState | null>(null)
  const [query, setQuery] = useState('')
  const [scan, setScan] = useState('')
  const [scanResult, setScanResult] = useState<string | null>(null)

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const nodeOptions = useMemo(
    () =>
      [...nodes]
        .map((n) => ({ id: n.id, label: nodePathLabel(nodes, n.id), container: isContainerKind(n.kind) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [nodes],
  )

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.model.localeCompare(b.model, undefined, { sensitivity: 'base' })),
    [items],
  )
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((it) =>
      [it.model, it.manufacturer, it.category, it.supplier, it.code]
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
      supplier: form.supplier?.trim() || undefined,
      ownership: form.ownership,
      code: form.code?.trim() || undefined,
      codeType: form.code?.trim() ? form.codeType ?? 'qr' : undefined,
      locationId: form.locationId || undefined,
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
      body: format(t('inventory.deleteBody', '„{model}" wird aus dem Lager entfernt.'), { model: item.model }),
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
        t('inventory.seedDoneBody', '{count} neue Artikel aus dem Plan übernommen (vorhandene wurden nicht dupliziert).'),
        { count: created },
      ),
    })
  }

  const handleScan = () => {
    const code = scan.trim()
    if (!code) return
    const match = resolveInventoryCode(code, { items, nodes, units })
    if (!match) {
      setScanResult(format(t('inventory.scanNone', 'Kein Treffer für „{code}".'), { code }))
      return
    }
    if (match.kind === 'item') {
      setScanResult(format(t('inventory.scanItem', 'Artikel: {name}'), { name: match.item.model }))
      setForm({ ...match.item })
    } else if (match.kind === 'node') {
      setTab('locations')
      setScanResult(format(t('inventory.scanNode', 'Lagerort: {name}'), { name: nodePathLabel(nodes, match.node.id) }))
    } else {
      const model = items.find((it) => it.id === match.unit.itemId)?.model ?? '?'
      setTab('units')
      setScanResult(format(t('inventory.scanUnit', 'Einheit: {model} · {serial}'), { model, serial: match.unit.serial || match.unit.code || match.unit.id.slice(0, 6) }))
    }
    setScan('')
  }

  const ownershipLabel = (o?: InventoryOwnership) => {
    if (o === 'owned') return t('inventory.owned', 'Eigentum')
    if (o === 'rented') return t('inventory.rented', 'gemietet')
    if (o === 'subhire') return t('inventory.subhire', 'Sub-Miete')
    return '—'
  }

  const toggleMaterialKind = (f: ItemFormState, k: InventoryMaterialKind): InventoryMaterialKind[] => {
    const s = new Set(f.materialKinds ?? [])
    if (s.has(k)) s.delete(k)
    else s.add(k)
    return [...s]
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

  const locationCell = (locationId?: string) => {
    if (!locationId) return <span className="text-cp-text-muted">—</span>
    const node = nodeById.get(locationId)
    if (!node) return <span className="text-cp-text-muted">—</span>
    return (
      <span className="flex items-center gap-1 text-cp-text-secondary">
        {isContainerKind(node.kind) ? <Package size={12} /> : <Warehouse size={12} />}
        <span className="truncate">{nodePathLabel(nodes, locationId)}</span>
      </span>
    )
  }

  const dimsEditor = (
    d: PhysicalDimensions | undefined,
    onChange: (next: PhysicalDimensions | undefined) => void,
  ) => {
    const setK = (k: keyof PhysicalDimensions, v: string) => {
      const num = v === '' ? undefined : Number(v)
      const next: PhysicalDimensions = { ...(d ?? {}), [k]: Number.isFinite(num as number) ? num : undefined }
      const any = next.widthMm || next.heightMm || next.depthMm || next.weightKg
      onChange(any ? next : undefined)
    }
    const cell = (k: keyof PhysicalDimensions, ph: string) => (
      <input
        type="number"
        min={0}
        value={dimOf(d, k) ?? ''}
        onChange={(e) => setK(k, e.target.value)}
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
            {format(t('inventory.summary3', '{items} Artikel · {units} Einheiten · {nodes} Lagerorte · {sets} Sets'), {
              items: items.length,
              units: totalUnits,
              nodes: nodes.length,
              sets: sets.length,
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
        {/* Scan-Zeile — Code (QR/Barcode/Seriennr.) auflösen */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <ScanLine size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-cp-text-faint" />
            <input
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleScan()
              }}
              placeholder={t('inventory.scanPh', 'Code scannen / eingeben (Artikel, Lagerort, Einheit)…')}
              className="w-full rounded border border-cp-border bg-cp-surface-3 py-1.5 pl-7 pr-2"
            />
          </div>
          <button type="button" onClick={handleScan} className="flex items-center gap-1 rounded bg-cp-surface-4 px-2.5 py-1.5 hover:bg-cp-surface-5">
            <ScanLine size={13} />
            {t('inventory.scan', 'Auflösen')}
          </button>
        </div>
        {scanResult && (
          <div className="rounded border border-cp-border-muted bg-cp-surface-2 px-2 py-1 text-cp-text-secondary">{scanResult}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-cp-border">
          {([
            { id: 'items' as Tab, icon: Boxes, label: t('inventory.tabItems', 'Artikel') },
            { id: 'locations' as Tab, icon: Warehouse, label: format(t('inventory.tabLocations', 'Lagerorte ({n})'), { n: nodes.length }) },
            { id: 'units' as Tab, icon: Tags, label: format(t('inventory.tabUnits', 'Einheiten ({n})'), { n: units.length }) },
            { id: 'sets' as Tab, icon: Layers, label: format(t('inventory.tabSets', 'Sets ({n})'), { n: sets.length }) },
            { id: 'labels' as Tab, icon: QrCodeIcon, label: t('inventory.tabLabels', 'Labels') },
            { id: 'reports' as Tab, icon: BarChart3, label: t('inventory.tabReports', 'Auswertung') },
          ]).map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 rounded-t px-3 py-1.5 ${
                tab === tb.id ? 'bg-cp-surface-2 font-medium text-cp-text' : 'text-cp-text-muted hover:text-cp-text'
              }`}
            >
              <tb.icon size={13} />
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'items' && (
          <>
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
                onClick={() => setForm({ model: '', quantity: 1 })}
                className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 hover:bg-emerald-600"
              >
                <Plus size={14} />
                {t('inventory.add', 'Artikel')}
              </button>
            </div>

            {form && (
              <div className="rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
                <div className="mb-2 font-medium">
                  {form.id ? t('inventory.editTitle', 'Artikel bearbeiten') : t('inventory.newTitle', 'Neuer Artikel')}
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  <label className="block">
                    {t('inventory.model', 'Modell')} <span className="text-red-400">*</span>
                    <input autoFocus value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.manufacturer', 'Hersteller')}
                    <input value={form.manufacturer ?? ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.category', 'Kategorie')}
                    <input value={form.category ?? ''} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.quantity', 'Menge')}
                    <input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.rentPrice', 'Mietpreis/Tag (€)')}
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.rentPricePerDay ?? ''}
                      onChange={(e) => setForm({ ...form, rentPricePerDay: e.target.value === '' ? undefined : Number(e.target.value) })}
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    {t('inventory.ownership', 'Eigentum')}
                    <select
                      value={form.ownership ?? ''}
                      onChange={(e) => setForm({ ...form, ownership: (e.target.value || undefined) as InventoryOwnership | undefined })}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      <option value="owned">{t('inventory.owned', 'Eigentum')}</option>
                      <option value="rented">{t('inventory.rented', 'gemietet')}</option>
                      <option value="subhire">{t('inventory.subhire', 'Sub-Miete')}</option>
                    </select>
                  </label>
                  {/* Lagerort (Lagerplatz ODER Case = einpacken) */}
                  <label className="block md:col-span-2">
                    {t('inventory.location', 'Lagerort / Case')}
                    <select
                      value={form.locationId ?? ''}
                      onChange={(e) => setForm({ ...form, locationId: e.target.value || undefined })}
                      className={inputCls}
                    >
                      <option value="">{t('inventory.noLocation', '— kein Lagerort —')}</option>
                      {nodeOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.container ? '📦 ' : ''}
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    {t('inventory.supplier', 'Lieferant')}
                    <input value={form.supplier ?? ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.code', 'Code (QR/Barcode)')}
                    <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={t('inventory.codePh', 'z.B. INV-00123')} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.codeType', 'Code-Art')}
                    <select value={form.codeType ?? 'qr'} onChange={(e) => setForm({ ...form, codeType: e.target.value as InventoryCodeType })} className={inputCls}>
                      <option value="qr">{t('inventory.qr', 'QR-Code')}</option>
                      <option value="barcode">{t('inventory.barcode', 'Barcode')}</option>
                    </select>
                  </label>
                  <div className="block">
                    {t('inventory.materialKind', 'Material-Art')}
                    <div className="mt-1 flex gap-3 rounded border border-cp-border bg-cp-surface-3 p-1.5">
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={!!form.materialKinds?.includes('rental')} onChange={() => setForm({ ...form, materialKinds: toggleMaterialKind(form, 'rental') })} />
                        {t('inventory.rental', 'Vermietung')}
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={!!form.materialKinds?.includes('consumable')} onChange={() => setForm({ ...form, materialKinds: toggleMaterialKind(form, 'consumable') })} />
                        {t('inventory.consumable', 'Verbrauch')}
                      </label>
                    </div>
                  </div>
                  <div className="block md:col-span-2">
                    {t('inventory.dimensions', 'Maße (B×H×T · Gewicht)')}
                    <div className="mt-1">{dimsEditor(form.dimensions, (next) => setForm({ ...form, dimensions: next }))}</div>
                  </div>
                  <label className="block md:col-span-1">
                    {t('inventory.notes', 'Notiz')}
                    <input value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
                  </label>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setForm(null)} className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5">
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
                      <th className="px-2 py-1.5 text-right font-medium">{t('inventory.quantity', 'Menge')}</th>
                      <th className="px-2 py-1.5 font-medium">{t('inventory.location', 'Lagerort / Case')}</th>
                      <th className="px-2 py-1.5 font-medium">{t('inventory.code', 'Code')}</th>
                      <th className="px-2 py-1.5 font-medium">{t('inventory.ownership', 'Eigentum')}</th>
                      <th className="px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((it) => (
                      <tr key={it.id} className="border-t border-cp-border-muted hover:bg-cp-surface-2">
                        <td className="px-2 py-1.5">
                          {it.model}
                          {it.manufacturer && <span className="ml-1 text-cp-text-muted">· {it.manufacturer}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{it.quantity}</td>
                        <td className="px-2 py-1.5">{locationCell(it.locationId)}</td>
                        <td className="px-2 py-1.5">{codeCell(it.code, it.codeType)}</td>
                        <td className="px-2 py-1.5 text-cp-text-secondary">{ownershipLabel(it.ownership)}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setForm({ ...it })} className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('common.edit', 'Bearbeiten')}>
                              <Pencil size={13} />
                            </button>
                            <button type="button" onClick={() => handleDelete(it)} className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300" title={t('common.delete', 'Löschen')}>
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

        {tab === 'locations' && <LocationsTab dimsEditor={dimsEditor} formatDims={formatDims} codeCell={codeCell} />}
        {tab === 'units' && <UnitsTab codeCell={codeCell} />}
        {tab === 'sets' && <SetsTab />}
        {tab === 'labels' && <LabelsTab />}
        {tab === 'reports' && <ReportsTab />}
      </div>
    </ModalShell>
  )
}

// ── Lagerorte-Tab (LPN-Baum) ─────────────────────────────────────────────────
type NodeFormState = StorageNodeInput & { id?: string }

const NODE_KIND_ORDER: StorageNodeKind[] = ['depot', 'room', 'shelf', 'bin', 'case', 'transportCase']

interface LocationsTabProps {
  dimsEditor: (d: PhysicalDimensions | undefined, onChange: (next: PhysicalDimensions | undefined) => void) => React.ReactNode
  formatDims: (d: PhysicalDimensions | undefined) => string
  codeCell: (code?: string, codeType?: InventoryCodeType) => React.ReactNode
}

const LocationsTab = ({ dimsEditor, formatDims, codeCell }: LocationsTabProps) => {
  const t = useTranslation()
  const nodes = useInventoryStore((s) => s.nodes)
  const items = useInventoryStore((s) => s.items)
  const units = useInventoryStore((s) => s.units)
  const addNode = useInventoryStore((s) => s.addNode)
  const updateNode = useInventoryStore((s) => s.updateNode)
  const moveNode = useInventoryStore((s) => s.moveNode)
  const removeNode = useInventoryStore((s) => s.removeNode)

  const handlePackList = async (node: StorageNode) => {
    const list = derivePackList(node.id, { items, nodes, units })
    const text = packListToText(list)
    const count = packListTotalCount(list)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* Clipboard evtl. nicht verfügbar — Info zeigt den Inhalt trotzdem. */
    }
    await infoDialog(format(t('inventory.packListTitle', 'Packliste „{name}"'), { name: node.name }), {
      tone: 'success',
      body: `${format(t('inventory.packListDone', '{n} Positionen — in die Zwischenablage kopiert.'), { n: count })}\n\n${text}`,
    })
  }

  const handlePackListPrint = (node: StorageNode) => {
    const list = derivePackList(node.id, { items, nodes, units })
    printHtmlDocument(buildPackListHtml(node.name, node.code, list))
  }
  const [form, setForm] = useState<NodeFormState | null>(null)

  const kindLabel = (k: StorageNodeKind): string =>
    ({
      depot: t('inventory.kindDepot', 'Depot'),
      room: t('inventory.kindRoom', 'Raum'),
      shelf: t('inventory.kindShelf', 'Regal'),
      bin: t('inventory.kindBin', 'Fach / Box'),
      case: t('inventory.kindCase', 'Case'),
      transportCase: t('inventory.kindTransportCase', 'Transport-Case'),
    })[k]

  const childrenByParent = useMemo(() => {
    const m = new Map<string, StorageNode[]>()
    for (const n of nodes) {
      const key = n.parentId ?? '__root__'
      const arr = m.get(key) ?? []
      arr.push(n)
      m.set(key, arr)
    }
    for (const arr of m.values()) arr.sort((a, b) => a.name.localeCompare(b.name))
    return m
  }, [nodes])

  const handleSave = () => {
    if (!form || form.name.trim() === '') return
    const payload: StorageNodeInput = {
      name: form.name.trim(),
      kind: form.kind,
      parentId: form.parentId || undefined,
      code: form.code?.trim() || undefined,
      codeType: form.code?.trim() ? form.codeType ?? 'qr' : undefined,
      dimensions: form.dimensions,
      notes: form.notes?.trim() || undefined,
    }
    if (form.id) {
      const { parentId, ...rest } = payload
      updateNode(form.id, rest)
      moveNode(form.id, parentId)
    } else {
      addNode(payload)
    }
    setForm(null)
  }

  const handleDelete = async (node: StorageNode) => {
    const directItems = itemsInNode(items, nodes, node.id).length
    const ok = await confirmDialog(t('inventory.nodeDeleteTitle', 'Lagerort löschen?'), {
      body: format(
        t('inventory.nodeDeleteBody', '„{name}" wird gelöscht. Unterknoten rücken eine Ebene hoch, {n} Artikel verlieren ihren Lagerort.'),
        { name: node.name, n: directItems },
      ),
      okLabel: t('common.delete', 'Löschen'),
      cancelLabel: t('common.cancel', 'Abbrechen'),
      destructive: true,
    })
    if (ok) removeNode(node.id)
  }

  // Verschachtelte Baum-Darstellung (rekursiv, Zyklen durch Baum-Struktur ausgeschlossen).
  const renderNode = (node: StorageNode, depth: number): React.ReactNode => {
    const kids = childrenByParent.get(node.id) ?? []
    const directItems = itemsInNode(items, nodes, node.id)
    const container = isContainerKind(node.kind)
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 rounded border border-cp-border-muted bg-cp-surface-2 px-2 py-1.5"
          style={{ marginLeft: depth * 16 }}
        >
          {container ? <Package size={13} className="shrink-0 text-cp-accent" /> : <Warehouse size={13} className="shrink-0 text-cp-text-muted" />}
          <span className="font-medium">{node.name}</span>
          <span className="rounded bg-cp-surface-4 px-1.5 py-0.5 text-[10px] text-cp-text-muted">{kindLabel(node.kind)}</span>
          {node.code && codeCell(node.code, node.codeType)}
          {directItems.length > 0 && (
            <span className="text-cp-text-muted">
              · {format(t('inventory.nItems', '{n} Artikel'), { n: directItems.length })}
            </span>
          )}
          {node.dimensions && <span className="text-cp-text-faint">· {formatDims(node.dimensions)}</span>}
          <div className="ml-auto flex gap-1">
            {container && (
              <>
                <button
                  type="button"
                  onClick={() => handlePackListPrint(node)}
                  className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text"
                  title={t('inventory.packListPrint', 'Packliste drucken')}
                >
                  <Printer size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handlePackList(node)}
                  className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text"
                  title={t('inventory.packList', 'Packliste (rekursiv) kopieren')}
                >
                  <ClipboardList size={13} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setForm({ name: '', kind: container ? 'case' : 'shelf', parentId: node.id })}
              className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text"
              title={t('inventory.addChild', 'Unterknoten anlegen')}
            >
              <Plus size={13} />
            </button>
            <button type="button" onClick={() => setForm({ ...node })} className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('common.edit', 'Bearbeiten')}>
              <Pencil size={13} />
            </button>
            <button type="button" onClick={() => handleDelete(node)} className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300" title={t('common.delete', 'Löschen')}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        {directItems.length > 0 && (
          <div style={{ marginLeft: depth * 16 + 22 }} className="mt-0.5 mb-0.5 flex flex-wrap gap-1">
            {directItems.map((it) => (
              <span key={it.id} className="flex items-center gap-1 rounded bg-cp-surface-3 px-1.5 py-0.5 text-[10px] text-cp-text-secondary">
                <ChevronRight size={9} />
                {it.quantity}× {it.model}
              </span>
            ))}
          </div>
        )}
        {kids.map((k) => renderNode(k, depth + 1))}
      </div>
    )
  }

  const roots = childrenByParent.get('__root__') ?? []

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-cp-text-muted">
          {t('inventory.locationsHint', 'Lagerplätze und Cases — jeder Knoten scanbar, beliebig verschachtelbar (Case in Case in Transport-Case).')}
        </span>
        <button type="button" onClick={() => setForm({ name: '', kind: 'depot' })} className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 hover:bg-emerald-600">
          <Plus size={14} />
          {t('inventory.addNode', 'Lagerort')}
        </button>
      </div>

      {form && (
        <div className="rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
          <div className="mb-2 font-medium">
            {form.id ? t('inventory.editNode', 'Lagerort bearbeiten') : t('inventory.newNode', 'Neuer Lagerort')}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <label className="block">
              {t('inventory.nodeName', 'Name')} <span className="text-red-400">*</span>
              <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              {t('inventory.nodeKind', 'Art')}
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as StorageNodeKind })} className={inputCls}>
                {NODE_KIND_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              {t('inventory.nodeParent', 'Übergeordnet')}
              <select value={form.parentId ?? ''} onChange={(e) => setForm({ ...form, parentId: e.target.value || undefined })} className={inputCls}>
                <option value="">{t('inventory.nodeRoot', '— Wurzel —')}</option>
                {nodes
                  .filter((n) => n.id !== form.id)
                  .map((n) => ({ id: n.id, label: nodePathLabel(nodes, n.id) }))
                  .sort((a, b) => a.label.localeCompare(b.label))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              {t('inventory.code', 'Code (QR/Barcode)')}
              <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              {t('inventory.codeType', 'Code-Art')}
              <select value={form.codeType ?? 'qr'} onChange={(e) => setForm({ ...form, codeType: e.target.value as InventoryCodeType })} className={inputCls}>
                <option value="qr">{t('inventory.qr', 'QR-Code')}</option>
                <option value="barcode">{t('inventory.barcode', 'Barcode')}</option>
              </select>
            </label>
            <div className="block md:col-span-3">
              {t('inventory.nodeDimensions', 'Maße (B×H×T · Gewicht) — v. a. für Cases')}
              <div className="mt-1">{dimsEditor(form.dimensions, (next) => setForm({ ...form, dimensions: next }))}</div>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5">
              {t('common.cancel', 'Abbrechen')}
            </button>
            <button type="button" disabled={form.name.trim() === ''} onClick={handleSave} className="rounded bg-emerald-700 px-3 py-1 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              {t('common.save', 'Speichern')}
            </button>
          </div>
        </div>
      )}

      {roots.length === 0 ? (
        <div className="rounded border border-dashed border-cp-border py-10 text-center text-cp-text-muted">
          {t('inventory.locationsEmpty', 'Noch keine Lagerorte. Lege Depots, Regale und Cases an.')}
        </div>
      ) : (
        <div className="space-y-1">{roots.map((n) => renderNode(n, 0))}</div>
      )}
    </>
  )
}

// ── Sets-Tab ─────────────────────────────────────────────────────────────────
type SetFormState = InventorySetInput & { id?: string }

const SetsTab = () => {
  const t = useTranslation()
  const items = useInventoryStore((s) => s.items)
  const sets = useInventoryStore((s) => s.sets)
  const addSet = useInventoryStore((s) => s.addSet)
  const updateSet = useInventoryStore((s) => s.updateSet)
  const removeSet = useInventoryStore((s) => s.removeSet)
  const [form, setForm] = useState<SetFormState | null>(null)
  const [pick, setPick] = useState('')

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items])

  const handleSave = () => {
    if (!form || form.name.trim() === '') return
    const payload: InventorySetInput = {
      name: form.name.trim(),
      components: form.components ?? [],
      notes: form.notes?.trim() || undefined,
    }
    if (form.id) updateSet(form.id, payload)
    else addSet(payload)
    setForm(null)
  }

  const handleDelete = async (s: InventorySet) => {
    const ok = await confirmDialog(t('inventory.setDeleteTitle', 'Set löschen?'), {
      body: format(t('inventory.setDeleteBody', '„{name}" wird gelöscht (Artikel bleiben im Bestand).'), { name: s.name }),
      okLabel: t('common.delete', 'Löschen'),
      cancelLabel: t('common.cancel', 'Abbrechen'),
      destructive: true,
    })
    if (ok) removeSet(s.id)
  }

  const addComponent = (itemId: string) => {
    if (!form || !itemId) return
    const existing = form.components?.find((c) => c.itemId === itemId)
    const components: SetComponent[] = existing
      ? form.components!.map((c) => (c.itemId === itemId ? { ...c, quantity: c.quantity + 1 } : c))
      : [...(form.components ?? []), { itemId, quantity: 1 }]
    setForm({ ...form, components })
    setPick('')
  }

  const setComponentQty = (itemId: string, qty: number) => {
    if (!form) return
    setForm({ ...form, components: (form.components ?? []).map((c) => (c.itemId === itemId ? { ...c, quantity: Math.max(1, Math.round(qty)) } : c)) })
  }

  const removeComponent = (itemId: string) => {
    if (!form) return
    setForm({ ...form, components: (form.components ?? []).filter((c) => c.itemId !== itemId) })
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-cp-text-muted">
          {t('inventory.setsHint', 'Logische Sets/Kits — Verfügbarkeit ergibt sich aus der knappsten Komponente.')}
        </span>
        <button type="button" onClick={() => setForm({ name: '', components: [] })} className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 hover:bg-emerald-600">
          <Plus size={14} />
          {t('inventory.addSet', 'Set')}
        </button>
      </div>

      {form && (
        <div className="rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
          <div className="mb-2 font-medium">{form.id ? t('inventory.editSet', 'Set bearbeiten') : t('inventory.newSet', 'Neues Set')}</div>
          <label className="block max-w-sm">
            {t('inventory.setName', 'Set-Name')} <span className="text-red-400">*</span>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </label>
          <div className="mt-2 font-medium text-cp-text-secondary">{t('inventory.components', 'Komponenten')}</div>
          {(form.components ?? []).length === 0 ? (
            <div className="text-cp-text-muted">{t('inventory.noComponents', 'Noch keine Komponenten.')}</div>
          ) : (
            <ul className="mt-1 space-y-1">
              {(form.components ?? []).map((c) => (
                <li key={c.itemId} className="flex items-center gap-2">
                  <input type="number" min={1} value={c.quantity} onChange={(e) => setComponentQty(c.itemId, Number(e.target.value))} className="w-16 rounded border border-cp-border bg-cp-surface-3 p-1" />
                  <span className="flex-1 truncate">{itemById.get(c.itemId)?.model ?? t('inventory.unknownItem', '(gelöschter Artikel)')}</span>
                  <button type="button" onClick={() => removeComponent(c.itemId)} className="rounded p-0.5 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300">
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <select value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-3 p-1">
                <option value="">{t('inventory.pickItem', 'Artikel wählen…')}</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.model}
                  </option>
                ))}
              </select>
              <button type="button" disabled={!pick} onClick={() => addComponent(pick)} className="flex items-center gap-1 rounded bg-cp-surface-4 px-2 py-1 enabled:hover:bg-cp-surface-5 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus size={13} />
                {t('inventory.addComponent', 'Hinzufügen')}
              </button>
            </div>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5">
              {t('common.cancel', 'Abbrechen')}
            </button>
            <button type="button" disabled={form.name.trim() === ''} onClick={handleSave} className="rounded bg-emerald-700 px-3 py-1 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              {t('common.save', 'Speichern')}
            </button>
          </div>
        </div>
      )}

      {sets.length === 0 ? (
        <div className="rounded border border-dashed border-cp-border py-10 text-center text-cp-text-muted">
          {t('inventory.setsEmpty', 'Noch keine Sets. Bündle Artikel zu einem Kit.')}
        </div>
      ) : (
        <div className="space-y-2">
          {sets.map((s) => {
            const avail = availabilityOfSet(items, s)
            return (
              <div key={s.id} className="rounded border border-cp-border bg-cp-surface-2">
                <div className="flex items-center justify-between gap-2 border-b border-cp-border-muted px-3 py-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Layers size={14} className="text-cp-text-muted" />
                    {s.name}
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${avail > 0 ? 'bg-emerald-700/30 text-emerald-400' : 'bg-red-700/30 text-red-400'}`}>
                      {format(t('inventory.setAvailable', '{n}× baubar'), { n: avail })}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setForm({ ...s })} className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('common.edit', 'Bearbeiten')}>
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => handleDelete(s)} className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300" title={t('common.delete', 'Löschen')}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="px-3 py-2">
                  {s.components.length === 0 ? (
                    <span className="text-cp-text-muted">{t('inventory.noComponents', 'Noch keine Komponenten.')}</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {s.components.map((c) => (
                        <li key={c.itemId} className="text-cp-text-secondary">
                          <span className="tabular-nums">{c.quantity}×</span> {itemById.get(c.itemId)?.model ?? t('inventory.unknownItem', '(gelöschter Artikel)')}
                        </li>
                      ))}
                    </ul>
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

// ── Einheiten-Tab (Serialisierung + Zustand + Historie) ──────────────────────
type UnitFormState = InventoryUnitInput & { id?: string }

interface UnitsTabProps {
  codeCell: (code?: string, codeType?: InventoryCodeType) => React.ReactNode
}

const CONDITION_TONE: Record<UnitCondition, string> = {
  ok: 'bg-emerald-700/30 text-emerald-400',
  defect: 'bg-red-700/30 text-red-400',
  inRepair: 'bg-amber-600/30 text-amber-400',
  retired: 'bg-cp-surface-4 text-cp-text-muted',
}

const UnitsTab = ({ codeCell }: UnitsTabProps) => {
  const t = useTranslation()
  const items = useInventoryStore((s) => s.items)
  const nodes = useInventoryStore((s) => s.nodes)
  const units = useInventoryStore((s) => s.units)
  const addUnit = useInventoryStore((s) => s.addUnit)
  const updateUnit = useInventoryStore((s) => s.updateUnit)
  const removeUnit = useInventoryStore((s) => s.removeUnit)
  const moveUnit = useInventoryStore((s) => s.moveUnit)
  const setUnitCondition = useInventoryStore((s) => s.setUnitCondition)
  const [form, setForm] = useState<UnitFormState | null>(null)
  const [openHistory, setOpenHistory] = useState<string | null>(null)

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items])
  const nodeOptions = useMemo(
    () => [...nodes].map((n) => ({ id: n.id, label: nodePathLabel(nodes, n.id) })).sort((a, b) => a.label.localeCompare(b.label)),
    [nodes],
  )

  const conditionLabel = (c: UnitCondition): string =>
    ({ ok: t('inventory.condOk', 'OK'), defect: t('inventory.condDefect', 'defekt'), inRepair: t('inventory.condRepair', 'in Reparatur'), retired: t('inventory.condRetired', 'ausgemustert') })[c]

  const handleSave = () => {
    if (!form || !form.itemId) return
    const payload: InventoryUnitInput = {
      itemId: form.itemId,
      serial: form.serial?.trim() || undefined,
      code: form.code?.trim() || undefined,
      codeType: form.code?.trim() ? form.codeType ?? 'qr' : undefined,
      locationId: form.locationId || undefined,
      condition: form.condition ?? 'ok',
      notes: form.notes?.trim() || undefined,
    }
    if (form.id) updateUnit(form.id, { serial: payload.serial, code: payload.code, codeType: payload.codeType, notes: payload.notes })
    else addUnit(payload)
    setForm(null)
  }

  const handleDelete = async (u: InventoryUnit) => {
    const ok = await confirmDialog(t('inventory.unitDeleteTitle', 'Einheit löschen?'), {
      okLabel: t('common.delete', 'Löschen'),
      cancelLabel: t('common.cancel', 'Abbrechen'),
      destructive: true,
    })
    if (ok) removeUnit(u.id)
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-cp-text-muted">
          {t('inventory.unitsHint', 'Serialisierte Einzel-Einheiten — eigene Seriennr./Code, Zustand und Historie (Bewegungen, Reparaturen).')}
        </span>
        <button
          type="button"
          disabled={items.length === 0}
          onClick={() => setForm({ itemId: items[0]?.id ?? '', condition: 'ok' })}
          className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} />
          {t('inventory.addUnit', 'Einheit')}
        </button>
      </div>

      {form && (
        <div className="rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
          <div className="mb-2 font-medium">{form.id ? t('inventory.editUnit', 'Einheit bearbeiten') : t('inventory.newUnit', 'Neue Einheit')}</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <label className="block">
              {t('inventory.unitItem', 'Artikel-Modell')} <span className="text-red-400">*</span>
              <select value={form.itemId} disabled={!!form.id} onChange={(e) => setForm({ ...form, itemId: e.target.value })} className={inputCls}>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.model}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              {t('inventory.serial', 'Seriennummer')}
              <input value={form.serial ?? ''} onChange={(e) => setForm({ ...form, serial: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              {t('inventory.code', 'Code (QR/Barcode)')}
              <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              {t('inventory.codeType', 'Code-Art')}
              <select value={form.codeType ?? 'qr'} onChange={(e) => setForm({ ...form, codeType: e.target.value as InventoryCodeType })} className={inputCls}>
                <option value="qr">{t('inventory.qr', 'QR-Code')}</option>
                <option value="barcode">{t('inventory.barcode', 'Barcode')}</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              {t('inventory.notes', 'Notiz')}
              <input value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5">
              {t('common.cancel', 'Abbrechen')}
            </button>
            <button type="button" disabled={!form.itemId} onClick={handleSave} className="rounded bg-emerald-700 px-3 py-1 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              {t('common.save', 'Speichern')}
            </button>
          </div>
        </div>
      )}

      {units.length === 0 ? (
        <div className="rounded border border-dashed border-cp-border py-10 text-center text-cp-text-muted">
          {items.length === 0
            ? t('inventory.unitsNoItems', 'Lege zuerst Artikel an, dann kannst du einzelne Einheiten serialisieren.')
            : t('inventory.unitsEmpty', 'Noch keine Einheiten. Serialisiere einzelne Exemplare eines Artikels.')}
        </div>
      ) : (
        <div className="space-y-1">
          {units.map((u) => (
            <div key={u.id} className="rounded border border-cp-border-muted bg-cp-surface-2">
              <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
                <Tags size={13} className="shrink-0 text-cp-text-muted" />
                <span className="font-medium">{itemById.get(u.itemId)?.model ?? t('inventory.unknownItem', '(gelöschter Artikel)')}</span>
                {u.serial && <span className="text-cp-text-secondary">SN {u.serial}</span>}
                {u.code && codeCell(u.code, u.codeType)}
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${CONDITION_TONE[u.condition]}`}>{conditionLabel(u.condition)}</span>
                {/* Zustand ändern */}
                <select
                  value={u.condition}
                  onChange={(e) => setUnitCondition(u.id, e.target.value as UnitCondition)}
                  className="rounded border border-cp-border bg-cp-surface-3 p-0.5 text-[10px]"
                  title={t('inventory.setCondition', 'Zustand ändern')}
                >
                  {(['ok', 'defect', 'inRepair', 'retired'] as UnitCondition[]).map((c) => (
                    <option key={c} value={c}>
                      {conditionLabel(c)}
                    </option>
                  ))}
                </select>
                {/* Lagerort verschieben */}
                <select
                  value={u.locationId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || undefined
                    moveUnit(u.id, id, id ? nodePathLabel(nodes, id) : '')
                  }}
                  className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-3 p-0.5 text-[10px]"
                  title={t('inventory.moveUnit', 'Lagerort ändern')}
                >
                  <option value="">{t('inventory.noLocation', '— kein Lagerort —')}</option>
                  {nodeOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="ml-auto flex gap-1">
                  <button type="button" onClick={() => setOpenHistory(openHistory === u.id ? null : u.id)} className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('inventory.history', 'Historie')}>
                    <ClipboardList size={13} />
                  </button>
                  <button type="button" onClick={() => setForm({ ...u })} className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('common.edit', 'Bearbeiten')}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => handleDelete(u)} className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300" title={t('common.delete', 'Löschen')}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {openHistory === u.id && (
                <ul className="border-t border-cp-border-muted px-3 py-1.5 text-[10px] text-cp-text-secondary">
                  {u.history.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="tabular-nums text-cp-text-faint">{e.at.slice(0, 10)}</span>
                      <span>{e.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ── Labels-Tab (QR-Etiketten drucken: A4 Avery/Zweckform + Labeldrucker) ─────
type LabelSource = 'items' | 'nodes' | 'units' | 'case'

const LabelsTab = () => {
  const t = useTranslation()
  const items = useInventoryStore((s) => s.items)
  const nodes = useInventoryStore((s) => s.nodes)
  const units = useInventoryStore((s) => s.units)

  const [source, setSource] = useState<LabelSource>('items')
  const [caseId, setCaseId] = useState('')
  const [formatId, setFormatId] = useState(ALL_LABEL_FORMATS[0].id)
  const [offset, setOffset] = useState(0)
  const [symbology, setSymbology] = useState<'auto' | 'qr' | 'barcode'>('auto')
  const [busy, setBusy] = useState(false)

  const sheet = labelSheetById(formatId) ?? ALL_LABEL_FORMATS[0]
  const containers = useMemo(() => nodes.filter((n) => isContainerKind(n.kind)), [nodes])
  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items])

  type Entry = { code: string; title?: string; codeType?: InventoryCodeType }
  // Sammelt die zu druckenden Codes (nur Entitäten MIT Code — kein Raten).
  const collect = (): Entry[] => {
    if (source === 'items') {
      return items.filter((it) => it.code).map((it) => ({ code: it.code!, title: it.model, codeType: it.codeType }))
    }
    if (source === 'nodes') {
      return nodes.filter((n) => n.code).map((n) => ({ code: n.code!, title: n.name, codeType: n.codeType }))
    }
    if (source === 'units') {
      return units
        .filter((u) => u.code)
        .map((u) => ({ code: u.code!, title: itemById.get(u.itemId)?.model, codeType: u.codeType }))
    }
    // 'case' — Codes aller Artikel + Einheiten (rekursiv) im gewählten Container.
    if (!caseId) return []
    const ids = new Set([caseId, ...descendantNodeIds(nodes, caseId)])
    const out: Entry[] = []
    for (const it of items) if (it.code && it.locationId && ids.has(it.locationId)) out.push({ code: it.code, title: it.model, codeType: it.codeType })
    for (const u of units)
      if (u.code && u.locationId && ids.has(u.locationId)) out.push({ code: u.code, title: itemById.get(u.itemId)?.model, codeType: u.codeType })
    return out
  }

  // Symbologie je Eintrag: 'auto' folgt der Code-Art des Objekts (Default QR).
  const symbologyFor = (e: Entry): 'qr' | 'barcode' =>
    symbology === 'auto' ? (e.codeType === 'barcode' ? 'barcode' : 'qr') : symbology

  const specsCount = useMemo(() => collect().length, [source, caseId, items, nodes, units]) // eslint-disable-line react-hooks/exhaustive-deps
  const pages = labelPageCount(specsCount, sheet, offset)

  const handlePrint = async () => {
    const entries = collect()
    if (entries.length === 0) {
      await infoDialog(t('inventory.labelsNoneTitle', 'Keine Codes'), {
        tone: 'info',
        body: t('inventory.labelsNone', 'Die gewählte Quelle enthält keine Artikel/Objekte mit hinterlegtem Code.'),
      })
      return
    }
    setBusy(true)
    try {
      const labels: LabelSpec[] = []
      for (const e of entries) {
        const sym = symbologyFor(e)
        let dataUrl = ''
        try {
          dataUrl =
            sym === 'barcode'
              ? renderBarcodeDataUrl(e.code)
              : await QRCode.toDataURL(e.code, { width: 240, margin: 0, color: { dark: '#000000', light: '#ffffff' } })
        } catch {
          /* Render fehlgeschlagen → Etikett trägt nur den Code-Text. */
        }
        labels.push({ qrDataUrl: dataUrl, code: e.code, title: e.title, symbology: sym })
      }
      printHtmlDocument(buildLabelSheetHtml(labels, sheet, offset))
    } finally {
      setBusy(false)
    }
  }

  const sel = 'mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5'

  return (
    <div className="space-y-3">
      <span className="text-cp-text-muted">
        {t('inventory.labelsHint', 'QR-Etiketten drucken — auf A4-Bögen (Avery/Zweckform) oder Endlos-Labeldrucker. Nur Objekte mit hinterlegtem Code.')}
      </span>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="block">
          {t('inventory.labelSource', 'Quelle')}
          <select value={source} onChange={(e) => setSource(e.target.value as LabelSource)} className={sel}>
            <option value="items">{t('inventory.labelSrcItems', 'Artikel mit Code')}</option>
            <option value="nodes">{t('inventory.labelSrcNodes', 'Lagerorte / Cases mit Code')}</option>
            <option value="units">{t('inventory.labelSrcUnits', 'Einheiten mit Code')}</option>
            <option value="case">{t('inventory.labelSrcCase', 'Inhalt eines Cases (rekursiv)')}</option>
          </select>
        </label>
        {source === 'case' && (
          <label className="block">
            {t('inventory.labelCase', 'Case / Container')}
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={sel}>
              <option value="">{t('inventory.pickItem', 'Artikel wählen…')}</option>
              {containers
                .map((n) => ({ id: n.id, label: nodePathLabel(nodes, n.id) }))
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="block">
          {t('inventory.labelSymbology', 'Code-Typ')}
          <select value={symbology} onChange={(e) => setSymbology(e.target.value as 'auto' | 'qr' | 'barcode')} className={sel}>
            <option value="auto">{t('inventory.symAuto', 'Je Code-Art (Auto)')}</option>
            <option value="qr">{t('inventory.symQr', 'QR-Code')}</option>
            <option value="barcode">{t('inventory.symBarcode', 'Barcode (Code128)')}</option>
          </select>
        </label>
        <label className="block">
          {t('inventory.labelFormat', 'Format')}
          <select value={formatId} onChange={(e) => setFormatId(e.target.value)} className={sel}>
            <optgroup label={t('inventory.labelSheetsGroup', 'A4-Bögen (Avery / Zweckform)')}>
              {ALL_LABEL_FORMATS.filter((s) => !s.roll).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('inventory.labelRollsGroup', 'Endlos-Labeldrucker')}>
              {ALL_LABEL_FORMATS.filter((s) => s.roll).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {!sheet.roll && (
          <label className="block">
            {t('inventory.labelOffset', 'Erste Etikett-Position (angebrochener Bogen)')}
            <input
              type="number"
              min={0}
              max={sheet.cols * sheet.rows - 1}
              value={offset}
              onChange={(e) => setOffset(Math.max(0, Math.min(sheet.cols * sheet.rows - 1, Number(e.target.value) || 0)))}
              className={sel}
            />
          </label>
        )}
      </div>

      <div className="flex items-center justify-between rounded border border-cp-border-muted bg-cp-surface-2 px-3 py-2">
        <span className="text-cp-text-secondary">
          {format(t('inventory.labelSummary', '{n} Etiketten · {p} Seite(n)'), { n: specsCount, p: pages })}
        </span>
        <button
          type="button"
          disabled={busy || specsCount === 0}
          onClick={handlePrint}
          className="flex items-center gap-1 rounded bg-emerald-700 px-3 py-1.5 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer size={14} />
          {busy ? t('inventory.labelBusy', 'Erzeuge…') : t('inventory.labelPrint', 'Drucken')}
        </button>
      </div>
    </div>
  )
}

// ── Reports-Tab ──────────────────────────────────────────────────────────────
const ReportsTab = () => {
  const t = useTranslation()
  const items = useInventoryStore((s) => s.items)
  const nodes = useInventoryStore((s) => s.nodes)
  const units = useInventoryStore((s) => s.units)
  const report = useMemo(() => buildInventoryReport(items, nodes, units), [items, nodes, units])

  const kpi = (label: string, value: string | number) => (
    <div className="rounded border border-cp-border-muted bg-cp-surface-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-cp-text-muted">{label}</div>
      <div className="text-cp-sm font-semibold tabular-nums text-cp-text">{value}</div>
    </div>
  )

  const breakdown = (title: string, rows: { key: string; items: number; units: number }[]) => (
    <div className="rounded border border-cp-border">
      <div className="border-b border-cp-border-muted bg-cp-surface-2 px-2 py-1 font-medium">{title}</div>
      {rows.length === 0 ? (
        <div className="px-2 py-1.5 text-cp-text-muted">—</div>
      ) : (
        <table className="w-full text-left">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-cp-border-muted">
                <td className="px-2 py-1">{r.key}</td>
                <td className="px-2 py-1 text-right tabular-nums text-cp-text-secondary">{format(t('inventory.reportRow', '{units} Stk · {items} Pos.'), { units: r.units, items: r.items })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {kpi(t('inventory.kpiItems', 'Artikel-Positionen'), report.itemCount)}
        {kpi(t('inventory.kpiUnits', 'Einheiten (Bulk)'), report.totalUnits)}
        {kpi(t('inventory.kpiSerialized', 'Serialisiert'), report.serializedCount)}
        {kpi(t('inventory.kpiValue', 'Miet-Vol./Tag (€)'), report.dailyRentalValue.toFixed(2))}
      </div>
      {report.itemsWithoutPrice > 0 && (
        <div className="rounded border border-amber-600/40 bg-amber-600/10 px-2 py-1 text-amber-500">
          {format(t('inventory.reportNoPrice', '{n} Artikel ohne Mietpreis — Miet-Volumen unvollständig.'), { n: report.itemsWithoutPrice })}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {breakdown(t('inventory.byCategory', 'Nach Kategorie'), report.byCategory)}
        {breakdown(t('inventory.byLocation', 'Nach Lagerort (Wurzel)'), report.byLocation)}
        {breakdown(t('inventory.byOwnership', 'Nach Eigentum'), report.byOwnership)}
        {breakdown(t('inventory.byMaterial', 'Nach Material-Art'), report.byMaterial)}
      </div>
      {report.serializedCount > 0 && breakdown(t('inventory.byCondition', 'Einheiten nach Zustand'), report.unitsByCondition)}
    </div>
  )
}
