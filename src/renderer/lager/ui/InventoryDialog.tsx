import { useEffect, useMemo, useRef, useState } from 'react'
import { IDENTITY_FINDING_LABEL, identityFindings, unitLabel } from '../lib/unitIdentity'
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
  Camera,
  Download,
  Upload,
  Truck,
  AlertTriangle,
} from 'lucide-react'
import QRCode from 'qrcode'
import { ModalShell } from '../../components/shared/ModalShell'
import { useTranslation, format } from '../../lib/i18n'
import {
  useInventoryStore,
  type InventoryItemInput,
  type StorageNodeInput,
  type InventorySetInput,
  type InventoryUnitInput,
} from '../store/inventoryStore'
import { useProjectStore } from '../../store/projectStore'
import type {
  InventoryItem,
  StorageNode,
  StorageNodeKind,
  InventorySet,
  InventoryUnit,
  UnitCondition,
  FaultService,
  InventoryOwnership,
  InventoryCodeType,
  InventoryMaterialKind,
  PhysicalDimensions,
  SetComponent,
} from '../types/inventory'
import { FAULT_SERVICE_LABEL } from '../types/inventory'
import { affectedServices, openFaultsOf } from '../lib/faultHistory'
import { promptDialog } from '../../lib/promptDialog'
import { useCheckoutStore } from '../store/checkoutStore'
import {
  SIGNATURE_REFUSAL_LABEL,
  SIGNATURE_STATE_LABEL,
  handoverSignatureTable,
  signatureState,
  type HandoverLeg,
} from '../lib/handoverSignature'
import { ownershipNote, overdueSubhire, subhireStatus } from '../lib/ownership'
import type { CheckoutDamage, CheckoutRecord } from '../types/checkout'
import { damageEntries, damageTable, damageTally } from '../lib/damageRegister'
import {
  AUDIT_LABEL, auditPick, auditRelocations, auditScan, auditTable, expectedAt, missingAt,
  type AuditCandidate, type AuditHit,
} from '../lib/inventoryAudit'
import { keepScreenAwake } from '../../lib/wakeLock'
import {
  containerContents,
  checkoutSheet,
  discrepancyTable,
  openCheckoutsTable,
  overdueCheckouts,
  scanBackIntoCheckout,
  unlabelledLines,
  type CheckoutRefusal,
} from '../lib/containerCheckout'
import {
  CUSTODY_START_REFUSAL_TEXT,
  EXTEND_REFUSAL_TEXT,
  custodyPeriodText,
  extensionCount,
  type CustodyStartRefusal,
  type ExtendRefusal,
} from '../lib/custodyPeriod'
import { toCsv } from '../../lib/csv'
import { downloadBlob } from '../../lib/downloadBlob'
import {
  nodePathLabel,
  itemsInNode,
  availabilityOfSet,
  isContainerKind,
  descendantNodeIds,
} from '../lib/storageTree'
import { resolveInventoryCode } from '../lib/inventoryScan'
import { serializeInventory, parseInventory } from '../lib/inventoryPortable'
import {
  carnetDatenblatt,
  eingabeAusGeld,
  geldAusEingabe,
  versicherungsListe,
  versicherungsTabelle,
} from '../lib/insuranceSchedule'
import { isBarcodeScannerSupported } from '../../lib/barcodeScanner'
import { ScannerModal } from './ScannerModal'
import { derivePackList, packListToText, packListTotalCount } from '../lib/packList'
import { buildInventoryReport } from '../lib/inventoryReport'
import { buildPackListHtml } from '../lib/inventoryPrint'
import { printHtmlDocument } from '../../lib/printHtml'
import {
  ALL_LABEL_FORMATS,
  estimateLabelFit,
  formatsThatFit,
  labelSheetById,
  labelPageCount,
  buildLabelSheetHtml,
  type LabelSpec,
} from '../../lib/labelSheets'
import { renderBarcodeDataUrl } from '../../lib/barcode'
import { confirmDialog } from '../../lib/confirmDialog'
import { infoDialog } from '../../lib/infoDialog'
import { PanelHint } from '../../components/shared/PanelHint'

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

type Tab = 'items' | 'locations' | 'units' | 'sets' | 'checkout' | 'labels' | 'reports'
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


/** ADR-005 — Sorte einer abgewiesenen Zeile, lesbar fuer den Import-Bericht. */
const REJECT_KIND_LABEL: Record<'item' | 'node' | 'set' | 'unit', string> = {
  item: 'Position',
  node: 'Lagerort',
  set: 'Set',
  unit: 'Einheit',
}

export const InventoryDialog = ({ open, onClose }: InventoryDialogProps) => {
  const t = useTranslation()
  const items = useInventoryStore((s) => s.items)
  const nodes = useInventoryStore((s) => s.nodes)
  const sets = useInventoryStore((s) => s.sets)
  const units = useInventoryStore((s) => s.units)
  const addItem = useInventoryStore((s) => s.addItem)
  const updateItem = useInventoryStore((s) => s.updateItem)
  // BEDARF 106 — Einraeumen und Umraeumen sind ein eigener Vorgang mit
  // Journal-Eintrag, nicht ein Feld im Patch.
  const moveArticle = useInventoryStore((s) => s.moveItem)
  const removeItem = useInventoryStore((s) => s.removeItem)
  const seedFromEquipment = useInventoryStore((s) => s.seedFromEquipment)
  const exportSnapshot = useInventoryStore((s) => s.exportSnapshot)
  // Bedarf 15 — die Zahl am Reiter ist die Zahl der offenen Vorgaenge. Ein
  // Reiter, der nicht sagt, dass drei Cases draussen sind, wird nicht geoeffnet.
  const offeneAusgaben = useCheckoutStore((s) => s.records.filter((r) => !r.in).length)
  const importSnapshot = useInventoryStore((s) => s.importSnapshot)
  const equipment = useProjectStore((s) => s.project.equipment)

  // Der Stichtag kommt EINMAL aus der Uhr und wird durchgereicht — sonst
  // beantwortet dieselbe Zeile in zwei Zellen zwei verschiedene Tage.
  const heuteIso = new Date().toISOString().slice(0, 10)
  // Bedarf 82 — was zurueckmuss und noch da ist. Ueberfaelliges zuerst, dann
  // das undatierte: „the failure mode is not losing sub-hire gear, it is
  // keeping it three weeks too long."
  const rueckgaben = useMemo(() => overdueSubhire(items, heuteIso), [items, heuteIso])

  const [tab, setTab] = useState<Tab>('items')
  const [form, setForm] = useState<ItemFormState | null>(null)
  const [query, setQuery] = useState('')
  const [scan, setScan] = useState('')
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const cameraSupported = useMemo(() => isBarcodeScannerSupported(), [])

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
      // Bedarf 82: das Rueckgabedatum. Bei eigenem Material bedeutungslos —
      // es wird trotzdem NICHT still geloescht, sondern bleibt stehen, falls
      // jemand die Eigentumsart versehentlich umgestellt hat. `subhireStatus`
      // sagt „owned" und ignoriert es; ein geloeschtes Datum waere weg.
      returnDue: form.returnDue?.trim() || undefined,
      code: form.code?.trim() || undefined,
      codeType: form.code?.trim() ? form.codeType ?? 'qr' : undefined,
      locationId: form.locationId || undefined,
      dimensions: form.dimensions,
      materialKinds: form.materialKinds?.length ? form.materialKinds : undefined,
      notes: form.notes?.trim() || undefined,
    }
    // BEDARF 106 — der Lagerort geht NICHT im Feld-Patch mit. Bis hierher
    // verschob dieselbe Funktion, die eine Notiz aendert, auch Ware; die
    // Bewegung war von einer beliebigen Feldaenderung nicht zu unterscheiden
    // und hinterliess nichts. Sie ist jetzt ein eigener Vorgang mit
    // Journal-Eintrag — und beim Anlegen genauso, denn der Beleg nennt
    // ausdruecklich auch das Einraeumen eines neu angelegten Artikels.
    const { locationId, ...ohneOrt } = payload
    if (form.id) {
      updateItem(form.id, ohneOrt)
      moveArticle(form.id, locationId)
    } else {
      const neueId = addItem(ohneOrt)
      moveArticle(neueId, locationId)
    }
    setForm(null)
  }

  const handleDelete = async (item: InventoryItem) => {
    const ok = await confirmDialog(t('inventory.deleteTitle', 'Delete item?'), {
      body: format(t('inventory.deleteBody', '“{model}” will be removed from the inventory.'), { model: item.model }),
      okLabel: t('common.delete', 'Delete'),
      cancelLabel: t('common.cancel', 'Cancel'),
      destructive: true,
    })
    if (ok) removeItem(item.id)
  }

  const handleSeed = async () => {
    if (equipment.length === 0) {
      await infoDialog(t('inventory.seedEmptyTitle', 'No equipment in plan'), {
        tone: 'info',
        body: t('inventory.seedEmptyBody', 'The current plan contains no devices to import.'),
      })
      return
    }
    const created = seedFromEquipment(equipment)
    await infoDialog(t('inventory.seedDoneTitle', 'Import complete'), {
      tone: 'success',
      body: format(
        t('inventory.seedDoneBody', 'Imported {count} new items from the plan (existing ones were not duplicated).'),
        { count: created },
      ),
    })
  }

  const handleScan = (raw?: string) => {
    const code = (raw ?? scan).trim()
    if (!code) return
    const match = resolveInventoryCode(code, { items, nodes, units })
    if (!match) {
      setScanResult(format(t('inventory.scanNone', 'No match for “{code}”.'), { code }))
      return
    }
    if (match.kind === 'item') {
      setScanResult(format(t('inventory.scanItem', 'Item: {name}'), { name: match.item.model }))
      setForm({ ...match.item })
    } else if (match.kind === 'node') {
      setTab('locations')
      setScanResult(format(t('inventory.scanNode', 'Location: {name}'), { name: nodePathLabel(nodes, match.node.id) }))
    } else {
      const model = items.find((it) => it.id === match.unit.itemId)?.model ?? '?'
      setTab('units')
      setScanResult(format(t('inventory.scanUnit', 'Unit: {model} · {serial}'), { model, serial: unitLabel(match.unit, 'house') }))
    }
    setScan('')
  }

  const handleExport = () => {
    const json = serializeInventory(exportSnapshot(), { app: 'cable-planner' })
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lager.avinv.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (file: File) => {
    const text = await file.text()
    const snap = parseInventory(text)
    if (!snap) {
      await infoDialog(t('inventory.importErrTitle', 'Import failed'), {
        tone: 'error',
        body: t('inventory.importErr', 'Not a valid inventory file (avplan-inventory).'),
      })
      return
    }
    const replace = await confirmDialog(t('inventory.importTitle', 'Import inventory'), {
      body: t('inventory.importBody', 'REPLACE the existing stock? “Cancel” merges instead.'),
      okLabel: t('inventory.importReplace', 'Replace'),
      cancelLabel: t('inventory.importMerge', 'Merge'),
    })
    const report = importSnapshot(snap, replace ? 'replace' : 'merge')
    // ADR-005 — was nicht bewahrt werden konnte, wird gesagt. Ein gruener
    // Erfolg ueber einer Datei, deren Haelfte abgewiesen wurde, waere die
    // falsche Gewissheit, gegen die diese Regel geschrieben ist.
    const lines = [
      format(t('inventory.importDone', '{n} objects imported.'), { n: report.imported }),
    ]
    if (report.rejected.length > 0) {
      lines.push(
        '',
        format(
          t(
            'inventory.importRejected',
            '{n} entry/entries were rejected because required fields are missing:',
          ),
          { n: report.rejected.length },
        ),
        ...report.rejected.slice(0, 12).map((r) => `- ${REJECT_KIND_LABEL[r.kind]}: ${r.label}`),
      )
      if (report.rejected.length > 12) {
        lines.push(
          format(t('inventory.importRejectedMore', '… and {n} more.'), {
            n: report.rejected.length - 12,
          }),
        )
      }
    }
    await infoDialog(t('inventory.importDoneTitle', 'Import complete'), {
      tone: report.rejected.length > 0 ? 'warning' : 'success',
      body: lines.join('\n'),
    })
  }

  const ownershipLabel = (o?: InventoryOwnership) => {
    if (o === 'owned') return t('inventory.owned', 'Owned')
    if (o === 'rented') return t('inventory.rented', 'Rented')
    if (o === 'subhire') return t('inventory.subhire', 'Sub-hire')
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
        {cell('widthMm', t('inventory.w', 'W mm'))}
        {cell('heightMm', t('inventory.h', 'H mm'))}
        {cell('depthMm', t('inventory.d', 'D mm'))}
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
      title={t('inventory.title', 'Inventory / stock')}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-cp-xs text-cp-text-muted">
            {format(t('inventory.summary3', '{items} items · {units} units · {nodes} locations · {sets} sets'), {
              items: items.length,
              units: totalUnits,
              nodes: nodes.length,
              sets: sets.length,
            })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1 rounded bg-cp-surface-4 px-2.5 py-1 text-cp-xs hover:bg-cp-surface-5"
              title={t('inventory.exportHint', 'Export inventory as a portable file (cross-app)')}
            >
              <Download size={13} /> {t('inventory.export', 'Export')}
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-1 rounded bg-cp-surface-4 px-2.5 py-1 text-cp-xs hover:bg-cp-surface-5"
              title={t('inventory.importHint', 'Import inventory from a portable file')}
            >
              <Upload size={13} /> {t('inventory.import', 'Import')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('common.close', 'Close')}
            </button>
          </div>
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
              placeholder={t('inventory.scanPh', 'Scan / type code (item, location, unit)…')}
              className="w-full rounded border border-cp-border bg-cp-surface-3 py-1.5 pl-7 pr-2"
            />
          </div>
          <button type="button" onClick={() => handleScan()} className="flex items-center gap-1 rounded bg-cp-surface-4 px-2.5 py-1.5 hover:bg-cp-surface-5">
            <ScanLine size={13} />
            {t('inventory.scan', 'Resolve')}
          </button>
          {cameraSupported && (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex items-center gap-1 rounded bg-cp-surface-4 px-2.5 py-1.5 hover:bg-cp-surface-5"
              title={t('inventory.scanCamera', 'Scan with camera')}
            >
              <Camera size={13} />
            </button>
          )}
        </div>
        {scanResult && (
          <div className="rounded border border-cp-border-muted bg-cp-surface-2 px-2 py-1 text-cp-text-secondary">{scanResult}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-cp-border">
          {([
            { id: 'items' as Tab, icon: Boxes, label: t('inventory.tabItems', 'Items') },
            { id: 'locations' as Tab, icon: Warehouse, label: format(t('inventory.tabLocations', 'Locations ({n})'), { n: nodes.length }) },
            { id: 'units' as Tab, icon: Tags, label: format(t('inventory.tabUnits', 'Units ({n})'), { n: units.length }) },
            { id: 'sets' as Tab, icon: Layers, label: format(t('inventory.tabSets', 'Sets ({n})'), { n: sets.length }) },
            { id: 'checkout' as Tab, icon: Truck, label: format(t('inventory.tabCheckout', 'Check-out ({n})'), { n: offeneAusgaben }) },
            { id: 'labels' as Tab, icon: QrCodeIcon, label: t('inventory.tabLabels', 'Labels') },
            { id: 'reports' as Tab, icon: BarChart3, label: t('inventory.tabReports', 'Reports') },
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
            {/* BEDARF 82 — was zurueckmuss und noch da ist. Der Kasten
                erscheint nur, wenn es etwas zu sagen gibt: ein Feld, das
                staendig „nichts faellig" meldet, wird nach der zweiten Woche
                nicht mehr gelesen, und dann faellt auch die echte Meldung
                nicht mehr auf. */}
            {rueckgaben.length > 0 && (
              <div className="rounded border border-cp-warn/40 bg-cp-surface-2 p-2.5 text-cp-sm">
                <div className="mb-1 flex items-center gap-1.5 font-medium text-cp-text">
                  <AlertTriangle size={14} />
                  {format(t('inventory.returnsTitle', 'Third-party gear: {n} item(s) to return'), {
                    n: rueckgaben.length,
                  })}
                </div>
                <ul className="flex flex-col gap-0.5">
                  {rueckgaben.slice(0, 12).map((r) => (
                    <li key={r.itemId} className={r.status === 'overdue' ? 'text-cp-danger' : 'text-cp-warn'}>
                      {format(
                        r.status === 'overdue'
                          ? t('inventory.returnOverdue', '{qty}× {model} → {supplier} · due back since {due}')
                          : t('inventory.returnNoDate', '{qty}× {model} → {supplier} · no return date'),
                        {
                          qty: r.quantity,
                          model: r.model,
                          // Ohne Lieferant steht es DA: „es geht zurueck, aber
                          // wir wissen nicht wohin" ist die Auskunft, die
                          // jemand braucht.
                          supplier: r.supplier || t('inventory.supplierUnknown', 'supplier unknown'),
                          due: r.returnDue,
                        },
                      )}
                    </li>
                  ))}
                </ul>
                {rueckgaben.length > 12 && (
                  <div className="mt-1 text-cp-xs text-cp-text-muted">
                    {format(t('inventory.returnsMore', '… and {n} more'), { n: rueckgaben.length - 12 })}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('inventory.searchPh', 'Search…')}
                className="min-w-[8rem] flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5"
              />
              <button
                type="button"
                onClick={handleSeed}
                className="flex items-center gap-1 rounded bg-cp-surface-4 px-2.5 py-1.5 hover:bg-cp-surface-5"
                title={t('inventory.seedHint', 'Add the current plan’s devices as inventory items')}
              >
                <PackagePlus size={14} />
                {t('inventory.seed', 'Import from plan')}
              </button>
              <button
                type="button"
                onClick={() => setForm({ model: '', quantity: 1 })}
                className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 hover:bg-emerald-600"
              >
                <Plus size={14} />
                {t('inventory.add', 'Item')}
              </button>
            </div>

            {form && (
              <div className="rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
                <div className="mb-2 font-medium">
                  {form.id ? t('inventory.editTitle', 'Edit item') : t('inventory.newTitle', 'New item')}
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  <label className="block">
                    {t('inventory.model', 'Model')} <span className="text-red-400">*</span>
                    <input autoFocus value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.manufacturer', 'Manufacturer')}
                    <input value={form.manufacturer ?? ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.category', 'Category')}
                    <input value={form.category ?? ''} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.quantity', 'Quantity')}
                    <input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.rentPrice', 'Rent price/day (€)')}
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
                    {t('inventory.ownership', 'Ownership')}
                    <select
                      value={form.ownership ?? ''}
                      onChange={(e) => setForm({ ...form, ownership: (e.target.value || undefined) as InventoryOwnership | undefined })}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      <option value="owned">{t('inventory.owned', 'Owned')}</option>
                      <option value="rented">{t('inventory.rented', 'Rented')}</option>
                      <option value="subhire">{t('inventory.subhire', 'Sub-hire')}</option>
                    </select>
                  </label>
                  {/* Lagerort (Lagerplatz ODER Case = einpacken) */}
                  <label className="block md:col-span-2">
                    {t('inventory.location', 'Location / case')}
                    <select
                      value={form.locationId ?? ''}
                      onChange={(e) => setForm({ ...form, locationId: e.target.value || undefined })}
                      className={inputCls}
                    >
                      <option value="">{t('inventory.noLocation', '— no location —')}</option>
                      {nodeOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.container ? '📦 ' : ''}
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    {t('inventory.supplier', 'Supplier')}
                    <input value={form.supplier ?? ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className={inputCls} />
                  </label>
                  {/* Bedarf 82 — „mark ownership and return date inside the job
                      and stop there". Nur bei fremdem Material: an einer
                      eigenen Position ist das Feld sinnlos und wuerde nur
                      Platz kosten. */}
                  {(form.ownership === 'rented' || form.ownership === 'subhire') && (
                    <label className="block">
                      {t('inventory.returnDue', 'Return by')}
                      <input
                        type="date"
                        value={form.returnDue ?? ''}
                        onChange={(e) => setForm({ ...form, returnDue: e.target.value })}
                        className={inputCls}
                      />
                    </label>
                  )}
                  {/* BEDARF 118 — Ursprungsland fuers Carnet-Datenblatt. Am
                      ARTIKEL, weil es eine Eigenschaft des Modells ist. */}
                  <label className="block">
                    {t('inventory.origin', 'Country of origin')}
                    <input
                      value={form.ursprungsland ?? ''}
                      onChange={(e) => setForm({ ...form, ursprungsland: e.target.value })}
                      placeholder={t('inventory.originPh', 'e.g. DE, JP, US')}
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    {t('inventory.code', 'Code (QR/barcode)')}
                    <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={t('inventory.codePh', 'e.g. INV-00123')} className={inputCls} />
                  </label>
                  <label className="block">
                    {t('inventory.codeType', 'Code type')}
                    <select value={form.codeType ?? 'qr'} onChange={(e) => setForm({ ...form, codeType: e.target.value as InventoryCodeType })} className={inputCls}>
                      <option value="qr">{t('inventory.qr', 'QR code')}</option>
                      <option value="barcode">{t('inventory.barcode', 'Barcode')}</option>
                    </select>
                  </label>
                  <div className="block">
                    {t('inventory.materialKind', 'Material type')}
                    <div className="mt-1 flex gap-3 rounded border border-cp-border bg-cp-surface-3 p-1.5">
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={!!form.materialKinds?.includes('rental')} onChange={() => setForm({ ...form, materialKinds: toggleMaterialKind(form, 'rental') })} />
                        {t('inventory.rental', 'Rental')}
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={!!form.materialKinds?.includes('consumable')} onChange={() => setForm({ ...form, materialKinds: toggleMaterialKind(form, 'consumable') })} />
                        {t('inventory.consumable', 'Consumable')}
                      </label>
                    </div>
                  </div>
                  <div className="block md:col-span-2">
                    {t('inventory.dimensions', 'Dimensions (W×H×D · weight)')}
                    <div className="mt-1">{dimsEditor(form.dimensions, (next) => setForm({ ...form, dimensions: next }))}</div>
                  </div>
                  <label className="block md:col-span-1">
                    {t('inventory.notes', 'Note')}
                    <input value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
                  </label>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setForm(null)} className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5">
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={form.model.trim() === ''}
                    onClick={handleSave}
                    className="rounded bg-emerald-700 px-3 py-1 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('common.save', 'Save')}
                  </button>
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="rounded border border-dashed border-cp-border py-10 text-center text-cp-text-muted">
                {items.length === 0
                  ? t('inventory.empty', 'No inventory items yet. Add some or import them from the plan.')
                  : t('inventory.noMatch', 'No items match the search.')}
              </div>
            ) : (
              <div className="overflow-x-auto rounded border border-cp-border">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-cp-surface-2 text-cp-text-muted">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">{t('inventory.model', 'Model')}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t('inventory.quantity', 'Quantity')}</th>
                      <th className="px-2 py-1.5 font-medium">{t('inventory.location', 'Location / case')}</th>
                      <th className="px-2 py-1.5 font-medium">{t('inventory.code', 'Code (QR/barcode)')}</th>
                      <th className="px-2 py-1.5 font-medium">{t('inventory.ownership', 'Ownership')}</th>
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
                        {/* Bedarf 82: die Eigentumsart allein sagt nicht, ob
                            etwas ueberfaellig ist — und genau daran haengt das
                            Geld („keeping it three weeks too long"). */}
                        <td className="px-2 py-1.5 text-cp-text-secondary">
                          {ownershipLabel(it.ownership)}
                          {subhireStatus(it, heuteIso) === 'overdue' && (
                            <span className="ml-1 text-cp-danger">
                              {format(t('inventory.overdueSince', '· due back since {d}'), { d: it.returnDue ?? '' })}
                            </span>
                          )}
                          {subhireStatus(it, heuteIso) === 'no-date' && (
                            <span className="ml-1 text-cp-warn">
                              {t('inventory.noReturnDate', '· no return date')}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setForm({ ...it })} className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('common.edit', 'Edit')}>
                              <Pencil size={13} />
                            </button>
                            <button type="button" onClick={() => handleDelete(it)} className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300" title={t('common.delete', 'Delete')}>
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
        {tab === 'checkout' && <CheckoutTab />}
        {tab === 'labels' && <LabelsTab />}
        {tab === 'reports' && <ReportsTab />}

        {/* Verstecktes File-Input für Import + Kamera-Scanner-Overlay */}
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImportFile(f)
            e.target.value = ''
          }}
        />
        {cameraOpen && (
          <ScannerModal
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onDetect={(code) => handleScan(code)}
          />
        )}
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
  // `moveUnit` statt `updateUnit`: ein Ortswechsel gehoert in die Historie der
  // Einheit. Ein stilles Feld-Schreiben liesse die Frage „wann kam die
  // hierher?" unbeantwortet — und genau die stellt jemand drei Wochen spaeter.
  const moveUnit = useInventoryStore((s) => s.moveUnit)
  // BEDARF 106 — dasselbe fuer den Artikel: der Lagerort ist eine Beziehung
  // mit eigenem Vorgang, nicht ein Feld unter vielen.
  const moveItem = useInventoryStore((s) => s.moveItem)
  // Der Stichtag kommt EINMAL aus der Uhr und wird durchgereicht.
  const heuteIso = new Date().toISOString().slice(0, 10)

  // ── BEDARF 66 + die Restreibung aus Bedarf 69 ────────────────────────────
  //
  // Der Ort steht FEST, bevor der erste Artikel gescannt wird -- „the scan
  // resolves to the company default warehouse rather than where the stock is"
  // ist genau der Fehler, den das verhindert.
  const [auditNode, setAuditNode] = useState('')
  const [auditDraft, setAuditDraft] = useState('')
  const [auditHits, setAuditHits] = useState<AuditHit[]>([])

  // Bedarf 69: waehrend inventiert wird, bleibt der Bildschirm an. Die Sperre
  // haengt am geoeffneten Panel und endet mit ihm.
  useEffect(() => {
    if (!auditNode) return
    const awake = keepScreenAwake()
    return () => awake.release()
  }, [auditNode])

  const auditScanNow = () => {
    const roh = auditDraft.trim()
    if (!roh || !auditNode) return
    const hit = auditScan(roh, auditNode, { items, nodes, units })
    // Ein Lagerort-Etikett wechselt den KONTEXT, statt als Fehltreffer zu
    // gelten: wer das Case-Etikett scannt, meint fast immer „ich stehe jetzt
    // hier". Das ist die location-context-first-Regel im Betrieb.
    if (hit.outcome === 'is-a-location') {
      const ziel = nodes.find((n) => (n.code ?? '').trim().toLowerCase() === roh.toLowerCase())
      if (ziel) {
        setAuditNode(ziel.id)
        setAuditHits([])
        setAuditDraft('')
        return
      }
    }
    // Neueste oben: wer scannt, schaut auf die letzte Zeile.
    setAuditHits((h) => [hit, ...h])
    setAuditDraft('')
  }

  /**
   * BEDARF 150 — der Scanner ist der schnelle Weg, nie der einzige.
   *
   * Getippte Codes gab es hier schon; die retten den leeren Akku. Sie retten
   * NICHT das abgerissene Etikett und nicht das Case, das schon auf dem Lkw
   * steht — wer den Code nicht lesen kann, kann ihn auch nicht tippen. Der
   * Weg, der dann bleibt, ist die Liste dessen, was hier liegen soll.
   */
  const auditErwartet = useMemo(
    () => (auditNode ? expectedAt(auditNode, { items, nodes, units }) : []),
    [auditNode, items, nodes, units],
  )
  const auditFehlt = useMemo(
    () => (auditNode ? missingAt(auditNode, { items, nodes, units }, auditHits) : []),
    [auditNode, items, nodes, units, auditHits],
  )
  const auditPickNow = (c: AuditCandidate) => {
    if (!auditNode) return
    setAuditHits((h) => [auditPick(c, auditNode, { items, nodes, units }), ...h])
  }

  /** Den TATSAECHLICHEN Ort uebernehmen — der Beleg verlangt genau das.
   *  Schreibend, deshalb ein eigener Klick und nicht automatisch. */
  const auditAdopt = () => {
    for (const r of auditRelocations(auditHits)) {
      // BEDARF 106 — Umräumen ist ein Vorgang. Bis hierher lief es über
      // `updateItem`, also über dieselbe Funktion, die eine Notiz ändert:
      // die Bewegung war von einer beliebigen Feldänderung nicht zu
      // unterscheiden und hinterließ nichts. `moveItem` bucht sie und
      // schreibt sie ins Journal.
      if (r.itemId) moveItem(r.itemId, auditNode)
      if (r.unitId) moveUnit(r.unitId, auditNode, nodePathLabel(nodes, auditNode))
    }
    // Nach dem Uebernehmen stimmt die Liste nicht mehr: sie behauptete einen
    // Widerspruch, den es nicht mehr gibt.
    setAuditHits([])
  }

  const handlePackList = async (node: StorageNode) => {
    const list = derivePackList(node.id, { items, nodes, units }, heuteIso)
    const text = packListToText(list)
    const count = packListTotalCount(list)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* Clipboard evtl. nicht verfügbar — Info zeigt den Inhalt trotzdem. */
    }
    await infoDialog(format(t('inventory.packListTitle', 'Pack list “{name}”'), { name: node.name }), {
      tone: 'success',
      body: `${format(t('inventory.packListDone', '{n} entries — copied to clipboard.'), { n: count })}\n\n${text}`,
    })
  }

  const handlePackListPrint = (node: StorageNode) => {
    const list = derivePackList(node.id, { items, nodes, units }, heuteIso)
    printHtmlDocument(buildPackListHtml(node.name, node.code, list))
  }
  const [form, setForm] = useState<NodeFormState | null>(null)

  const kindLabel = (k: StorageNodeKind): string =>
    ({
      depot: t('inventory.kindDepot', 'Depot'),
      room: t('inventory.kindRoom', 'Room'),
      shelf: t('inventory.kindShelf', 'Shelf'),
      bin: t('inventory.kindBin', 'Bin / box'),
      case: t('inventory.kindCase', 'Case'),
      transportCase: t('inventory.kindTransportCase', 'Transport case'),
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
    const ok = await confirmDialog(t('inventory.nodeDeleteTitle', 'Delete location?'), {
      body: format(
        t('inventory.nodeDeleteBody', '“{name}” will be deleted. Child nodes move up one level, {n} items lose their location.'),
        { name: node.name, n: directItems },
      ),
      okLabel: t('common.delete', 'Delete'),
      cancelLabel: t('common.cancel', 'Cancel'),
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
              · {format(t('inventory.nItems', '{n} items'), { n: directItems.length })}
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
                  title={t('inventory.packListPrint', 'Print pack list')}
                >
                  <Printer size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handlePackList(node)}
                  className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text"
                  title={t('inventory.packList', 'Copy pack list (recursive)')}
                >
                  <ClipboardList size={13} />
                </button>
              </>
            )}
            {/* BEDARF 66 — „verify this rack". Der Knopf sitzt an JEDER
                Lagerstelle, nicht nur an Containern: ein Regal wird genauso
                inventiert wie ein Case, und die Frage ist dieselbe. */}
            <button
              type="button"
              onClick={() => setAuditNode(auditNode === node.id ? '' : node.id)}
              className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text"
              title={t('inventory.auditStart', 'Stock-take at this location')}
            >
              <ScanLine size={13} />
            </button>
            <button
              type="button"
              onClick={() => setForm({ name: '', kind: container ? 'case' : 'shelf', parentId: node.id })}
              className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text"
              title={t('inventory.addChild', 'Add child node')}
            >
              <Plus size={13} />
            </button>
            <button type="button" onClick={() => setForm({ ...node })} className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('common.edit', 'Edit')}>
              <Pencil size={13} />
            </button>
            <button type="button" onClick={() => handleDelete(node)} className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300" title={t('common.delete', 'Delete')}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* BEDARF 66 — die Inventur an DIESEM Ort. Zwei Farben („im Bestand /
            nicht im Bestand") beantworten die Frage nicht, die im Lager
            gestellt wird: fast alles ist im Bestand, und „am falschen Ort" ist
            nach jedem Load-out der Normalfall, nicht die Ausnahme. */}
        {auditNode === node.id && (
          <div
            style={{ marginLeft: depth * 16 + 22 }}
            className="mb-1 mt-1 rounded border border-cp-accent/40 bg-cp-surface-2 p-2"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-medium text-cp-text">
                {format(t('inventory.auditTitle', 'Stock-take: {name}'), { name: node.name })}
              </span>
              <input
                value={auditDraft}
                onChange={(e) => setAuditDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter scannt weiter, statt ein Formular abzuschicken
                  // (Bedarf 69, snipe-it#17057). Das Feld leert sich selbst —
                  // der naechste Code kann sofort kommen.
                  if (e.key === 'Enter') auditScanNow()
                }}
                autoFocus
                placeholder={t('inventory.auditPh', 'Scan a code — a location label switches the location')}
                className="min-w-[14rem] flex-1 rounded border border-cp-border bg-cp-surface-3 px-2 py-1"
              />
              <button
                type="button"
                disabled={auditHits.length === 0}
                onClick={() => {
                  // Mit den Fehlt-Zeilen: ein Blatt ohne sie zaehlt nur,
                  // was jemand vorgezeigt hat, und laese sich wie eine
                  // vollstaendige Inventur.
                  const t2 = auditTable(auditHits, nodes, node.id, auditFehlt)
                  downloadBlob(`inventur-${node.name}.csv`, toCsv(t2.headers, t2.rows), 'text/csv')
                }}
                className="flex items-center gap-1 text-cp-text-secondary hover:text-cp-text disabled:opacity-40"
              >
                <Download size={12} /> CSV
              </button>
              <button
                type="button"
                disabled={auditRelocations(auditHits).length === 0}
                onClick={auditAdopt}
                title={t(
                  'inventory.auditAdoptHint',
                  'Writes this location onto every object found in the wrong place — the records then follow what is actually here',
                )}
                className="rounded border border-cp-border px-2 py-1 text-cp-text-secondary hover:text-cp-text disabled:opacity-40"
              >
                {format(t('inventory.auditAdopt', 'Adopt location ({n})'), {
                  n: auditRelocations(auditHits).length,
                })}
              </button>
            </div>
            {/* BEDARF 150 — die Liste dessen, was hier liegen soll. Sie ist
                der Weg, der bleibt, wenn der Scanner leer oder das Etikett ab
                ist: abhaken statt scannen. Was am Ende weder gescannt noch
                abgehakt ist, steht als „Nicht gefunden" auf dem Blatt — das
                ist das eigentliche Ergebnis einer Inventur, und ohne diese
                Liste gab es dafuer keine Zeile. */}
            {auditErwartet.length > 0 && (
              <details className="mb-1.5 rounded border border-cp-border-muted bg-cp-surface-3 px-2 py-1">
                <summary className="cursor-pointer text-cp-text-secondary">
                  {format(
                    // NICHT `inventory.auditExpected` — den Schluessel gibt
                    // es unten schon mit „erwartet in {ort}". Zwei deutsche
                    // Fassungen unter einem Schluessel heisst: die zweite
                    // Uebersetzung ueberschreibt die erste, und irgendwo im
                    // Englischen steht dann der falsche Satz.
                    t('inventory.auditExpectedList', 'Tick off without a scanner \u2014 expected here: {n}, still open: {open}'),
                    { n: auditErwartet.length, open: auditFehlt.length },
                  )}
                </summary>
                <ul className="mt-1 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                  {auditErwartet.map((c) => {
                    const offen = auditFehlt.some((m) => m.key === c.key)
                    return (
                      <li key={c.key} className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!offen}
                          onClick={() => auditPickNow(c)}
                          title={t(
                            'inventory.auditPickHint',
                            'Record as \u201cit is here\u201d without a code \u2014 the sheet notes that it was ticked off, not scanned',
                          )}
                          className="rounded border border-cp-border px-1.5 py-0.5 text-cp-text-secondary hover:text-cp-text disabled:opacity-40"
                        >
                          {offen
                            ? t('inventory.auditPick', 'here')
                            : t('inventory.auditPicked', 'recorded')}
                        </button>
                        <span className={offen ? 'text-cp-text' : 'text-cp-text-muted line-through'}>
                          {c.label}
                          {c.model && c.model !== c.label ? ` · ${c.model}` : ''}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </details>
            )}
            {auditHits.length === 0 ? (
              <div className="text-cp-text-muted">
                {t('inventory.auditEmpty', 'Nothing recorded yet.')}
              </div>
            ) : (
              <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
                {auditHits.map((h, i) => (
                  <li
                    key={`${h.code}-${i}`}
                    className={
                      h.outcome === 'expected-here'
                        ? 'text-cp-text-secondary'
                        : h.outcome === 'wrong-place'
                          ? 'text-cp-warn'
                          : 'text-cp-danger'
                    }
                  >
                    {/* Modell UND Ort in jeder Zeile — beides verlangt der
                        Beleg ausdruecklich, und ohne beides „finds nothing
                        actionable". */}
                    {AUDIT_LABEL[h.outcome]} · {h.label || h.code}
                    {/* Bedarf 150: gescannt oder abgehakt steht dran. Ein
                        Etikett gelesen zu haben ist eine andere Auskunft als
                        eine Zeile angeklickt zu haben. */}
                    {h.via === 'pick' ? ` [${t('inventory.auditViaPick', 'from the list')}]` : ''}
                    {h.model && h.model !== h.label ? ` (${h.model})` : ''}
                    {h.expected ? ` — ${format(t('inventory.auditExpected', 'expected in {ort}'), { ort: h.expected })}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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
          {t('inventory.locationsHint', 'Storage locations and cases — every node scannable, nestable at will (case in case in transport case).')}
        </span>
        <button type="button" onClick={() => setForm({ name: '', kind: 'depot' })} className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 hover:bg-emerald-600">
          <Plus size={14} />
          {t('inventory.addNode', 'Location')}
        </button>
      </div>

      {form && (
        <div className="rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
          <div className="mb-2 font-medium">
            {form.id ? t('inventory.editNode', 'Edit location') : t('inventory.newNode', 'New location')}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <label className="block">
              {t('inventory.nodeName', 'Name')} <span className="text-red-400">*</span>
              <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              {t('inventory.nodeKind', 'Type')}
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as StorageNodeKind })} className={inputCls}>
                {NODE_KIND_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              {t('inventory.nodeParent', 'Parent')}
              <select value={form.parentId ?? ''} onChange={(e) => setForm({ ...form, parentId: e.target.value || undefined })} className={inputCls}>
                <option value="">{t('inventory.nodeRoot', '— root —')}</option>
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
              {t('inventory.code', 'Code (QR/barcode)')}
              <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              {t('inventory.codeType', 'Code type')}
              <select value={form.codeType ?? 'qr'} onChange={(e) => setForm({ ...form, codeType: e.target.value as InventoryCodeType })} className={inputCls}>
                <option value="qr">{t('inventory.qr', 'QR code')}</option>
                <option value="barcode">{t('inventory.barcode', 'Barcode')}</option>
              </select>
            </label>
            <div className="block md:col-span-3">
              {t('inventory.nodeDimensions', 'Dimensions (W×H×D · weight) — mainly for cases')}
              <div className="mt-1">{dimsEditor(form.dimensions, (next) => setForm({ ...form, dimensions: next }))}</div>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5">
              {t('common.cancel', 'Cancel')}
            </button>
            <button type="button" disabled={form.name.trim() === ''} onClick={handleSave} className="rounded bg-emerald-700 px-3 py-1 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              {t('common.save', 'Save')}
            </button>
          </div>
        </div>
      )}

      {roots.length === 0 ? (
        <div className="rounded border border-dashed border-cp-border py-10 text-center text-cp-text-muted">
          {t('inventory.locationsEmpty', 'No locations yet. Create depots, shelves and cases.')}
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
    const ok = await confirmDialog(t('inventory.setDeleteTitle', 'Delete set?'), {
      body: format(t('inventory.setDeleteBody', '“{name}” will be deleted (items stay in stock).'), { name: s.name }),
      okLabel: t('common.delete', 'Delete'),
      cancelLabel: t('common.cancel', 'Cancel'),
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
          {t('inventory.setsHint', 'Logical sets/kits — availability derived from the scarcest component.')}
        </span>
        <button type="button" onClick={() => setForm({ name: '', components: [] })} className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 hover:bg-emerald-600">
          <Plus size={14} />
          {t('inventory.addSet', 'Set')}
        </button>
      </div>

      {form && (
        <div className="rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
          <div className="mb-2 font-medium">{form.id ? t('inventory.editSet', 'Edit set') : t('inventory.newSet', 'New set')}</div>
          <label className="block max-w-sm">
            {t('inventory.setName', 'Set name')} <span className="text-red-400">*</span>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </label>
          <div className="mt-2 font-medium text-cp-text-secondary">{t('inventory.components', 'Components')}</div>
          {(form.components ?? []).length === 0 ? (
            <div className="text-cp-text-muted">{t('inventory.noComponents', 'No components yet.')}</div>
          ) : (
            <ul className="mt-1 space-y-1">
              {(form.components ?? []).map((c) => (
                <li key={c.itemId} className="flex items-center gap-2">
                  <input type="number" min={1} value={c.quantity} onChange={(e) => setComponentQty(c.itemId, Number(e.target.value))} className="w-16 rounded border border-cp-border bg-cp-surface-3 p-1" />
                  <span className="flex-1 truncate">{itemById.get(c.itemId)?.model ?? t('inventory.unknownItem', '(deleted item)')}</span>
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
                <option value="">{t('inventory.pickItem', 'Pick item…')}</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.model}
                  </option>
                ))}
              </select>
              <button type="button" disabled={!pick} onClick={() => addComponent(pick)} className="flex items-center gap-1 rounded bg-cp-surface-4 px-2 py-1 enabled:hover:bg-cp-surface-5 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus size={13} />
                {t('inventory.addComponent', 'Add')}
              </button>
            </div>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5">
              {t('common.cancel', 'Cancel')}
            </button>
            <button type="button" disabled={form.name.trim() === ''} onClick={handleSave} className="rounded bg-emerald-700 px-3 py-1 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              {t('common.save', 'Save')}
            </button>
          </div>
        </div>
      )}

      {sets.length === 0 ? (
        <div className="rounded border border-dashed border-cp-border py-10 text-center text-cp-text-muted">
          {t('inventory.setsEmpty', 'No sets yet. Bundle items into a kit.')}
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
                      {format(t('inventory.setAvailable', '{n}× buildable'), { n: avail })}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setForm({ ...s })} className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('common.edit', 'Edit')}>
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => handleDelete(s)} className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300" title={t('common.delete', 'Delete')}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="px-3 py-2">
                  {s.components.length === 0 ? (
                    <span className="text-cp-text-muted">{t('inventory.noComponents', 'No components yet.')}</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {s.components.map((c) => (
                        <li key={c.itemId} className="text-cp-text-secondary">
                          <span className="tabular-nums">{c.quantity}×</span> {itemById.get(c.itemId)?.model ?? t('inventory.unknownItem', '(deleted item)')}
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
/**
 * Bedarf 118 — die Geld-Felder stehen als TEXT im Formular und nicht als
 * `Geldbetrag`. Wer „12," getippt hat, ist mitten in einer Eingabe; ein
 * Zwischenstand, der sofort zu einer Zahl gemacht wird, springt unter den
 * Fingern zurueck. Umgewandelt wird beim Speichern, an genau einer Stelle
 * (`geldAusEingabe`).
 */
/**
 * Eine Tabelle als CSV herunterladen.
 *
 * Auf Modulebene und nicht in einem der Reiter: seit Bedarf 118 braucht ihn
 * auch der Einheiten-Reiter, und eine zweite Fassung derselben Zeile waere
 * die Stelle, an der eines Tages der eine Reiter mit Semikolon und der
 * andere mit Komma trennt.
 */
const csv = (
  name: string,
  table: { headers: string[]; rows: (string | number | null | undefined)[][] },
) => downloadBlob(name, toCsv(table.headers, table.rows), 'text/csv')

type UnitFormState = InventoryUnitInput & {
  id?: string
  kaufBetrag?: string
  kaufWaehrung?: string
  kaufAm?: string
  versBetrag?: string
  versWaehrung?: string
  versStand?: string
}

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
  // BEDARF 52 — die Fehlerhistorie am physischen Objekt.
  const reportUnitFault = useInventoryStore((s) => s.reportUnitFault)
  const resolveUnitFault = useInventoryStore((s) => s.resolveUnitFault)
  const [faultFor, setFaultFor] = useState<string | null>(null)
  const [faultText, setFaultText] = useState('')
  const [faultServices, setFaultServices] = useState<FaultService[]>([])
  const identitaetsBefunde = useMemo(() => identityFindings(units), [units])
  const [form, setForm] = useState<UnitFormState | null>(null)
  const [openHistory, setOpenHistory] = useState<string | null>(null)

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items])
  const nodeOptions = useMemo(
    () => [...nodes].map((n) => ({ id: n.id, label: nodePathLabel(nodes, n.id) })).sort((a, b) => a.label.localeCompare(b.label)),
    [nodes],
  )

  const conditionLabel = (c: UnitCondition): string =>
    ({ ok: t('inventory.condOk', 'OK'), defect: t('inventory.condDefect', 'defective'), inRepair: t('inventory.condRepair', 'in repair'), retired: t('inventory.condRetired', 'retired') })[c]

  const handleSave = () => {
    if (!form || !form.itemId) return
    // BEDARF 118 — ohne Waehrung kein Betrag. `geldAusEingabe` sagt das, und
    // zwar an EINER Stelle fuer beide Werte; ein Betrag ohne Kuerzel wird
    // nicht gespeichert statt stillschweigend zu „EUR" zu werden.
    const kauf = geldAusEingabe(form.kaufBetrag ?? '', form.kaufWaehrung ?? '')
    const vers = geldAusEingabe(form.versBetrag ?? '', form.versWaehrung ?? '')
    const payload: InventoryUnitInput = {
      itemId: form.itemId,
      serial: form.serial?.trim() || undefined,
      houseRef: form.houseRef?.trim() || undefined,
      code: form.code?.trim() || undefined,
      codeType: form.code?.trim() ? form.codeType ?? 'qr' : undefined,
      locationId: form.locationId || undefined,
      condition: form.condition ?? 'ok',
      notes: form.notes?.trim() || undefined,
      anschaffung: kauf ? { betrag: kauf, am: form.kaufAm?.trim() || undefined } : undefined,
      versicherungswert: vers ? { betrag: vers, stand: form.versStand?.trim() || undefined } : undefined,
    }
    if (form.id)
      updateUnit(form.id, {
        serial: payload.serial,
        houseRef: payload.houseRef,
        code: payload.code,
        codeType: payload.codeType,
        notes: payload.notes,
        anschaffung: payload.anschaffung,
        versicherungswert: payload.versicherungswert,
      })
    else addUnit(payload)
    setForm(null)
  }

  const handleDelete = async (u: InventoryUnit) => {
    const ok = await confirmDialog(t('inventory.unitDeleteTitle', 'Delete unit?'), {
      okLabel: t('common.delete', 'Delete'),
      cancelLabel: t('common.cancel', 'Cancel'),
      destructive: true,
    })
    if (ok) removeUnit(u.id)
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-cp-text-muted">
          {t('inventory.unitsHint', 'Serialized single units — own serial/code, condition and history (moves, repairs).')}
        </span>
        <div className="flex items-center gap-2">
          {/* BEDARF 118 — die zwei Blaetter, die der Freiberufler sonst von Hand
              aus seiner Tabelle abschreibt. Der Lieferschein ist NICHT dabei:
              den gibt es als Ausgabeschein und Quittung im Ausgaben-Reiter, und
              ein zweiter waere eine zweite Fassung desselben Belegs. */}
          <button
            type="button"
            disabled={units.length === 0}
            onClick={() =>
              csv(
                'versicherungsliste.csv',
                versicherungsTabelle(
                  versicherungsListe(units, (u) => itemById.get(u.itemId)?.model ?? u.itemId),
                ),
              )
            }
            title={t(
              'inventory.insuranceHint',
              'Insurance schedule: value per unit, one total per currency — and the units with no declared value listed by name underneath.',
            )}
            className="flex items-center gap-1 rounded bg-cp-surface-4 px-2.5 py-1.5 enabled:hover:bg-cp-surface-5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={13} /> {t('inventory.insuranceList', 'Insurance')}
          </button>
          <button
            type="button"
            disabled={units.length === 0}
            onClick={() => csv('carnet-datenblatt.csv', carnetDatenblatt(units, (u) => itemById.get(u.itemId)))}
            title={t(
              'inventory.carnetHint',
              'Carnet data sheet: the columns a carnet line needs, to copy into the chamber of commerce form. Not a carnet.',
            )}
            className="flex items-center gap-1 rounded bg-cp-surface-4 px-2.5 py-1.5 enabled:hover:bg-cp-surface-5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={13} /> {t('inventory.carnetSheet', 'Carnet')}
          </button>
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => setForm({ itemId: items[0]?.id ?? '', condition: 'ok' })}
            className="flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} />
            {t('inventory.addUnit', 'Unit')}
          </button>
        </div>
      </div>

      {form && (
        <div className="rounded border border-cp-accent/40 bg-cp-surface-2 p-3">
          <div className="mb-2 font-medium">{form.id ? t('inventory.editUnit', 'Edit unit') : t('inventory.newUnit', 'New unit')}</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <label className="block">
              {t('inventory.unitItem', 'Item model')} <span className="text-red-400">*</span>
              <select value={form.itemId} disabled={!!form.id} onChange={(e) => setForm({ ...form, itemId: e.target.value })} className={inputCls}>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.model}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              {t('inventory.serial', 'Serial number (manufacturer)')}
              <input value={form.serial ?? ''} onChange={(e) => setForm({ ...form, serial: e.target.value })} className={inputCls} />
            </label>
            {/* BEDARF 107 — zwei Identitäten, zwei Felder. Die Herstellernummer
                braucht die Versicherung, die Sub-Vermietung und die Wartung;
                die Hausreferenz braucht alles Interne. Ein Feld für beide
                zwingt das Lager zur Wahl, und die andere landet mit Filzstift
                auf dem Case. */}
            <label className="block">
              {t('inventory.houseRef', 'House reference')}
              <input
                value={form.houseRef ?? ''}
                onChange={(e) => setForm({ ...form, houseRef: e.target.value })}
                placeholder={t('inventory.houseRefPh', 'e.g. AV-0421')}
                className={inputCls}
              />
            </label>
            <label className="block">
              {t('inventory.code', 'Code (QR/barcode)')}
              <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              {t('inventory.codeType', 'Code type')}
              <select value={form.codeType ?? 'qr'} onChange={(e) => setForm({ ...form, codeType: e.target.value as InventoryCodeType })} className={inputCls}>
                <option value="qr">{t('inventory.qr', 'QR code')}</option>
                <option value="barcode">{t('inventory.barcode', 'Barcode')}</option>
              </select>
            </label>
            {/* BEDARF 118 — die beiden Werte, aus denen Versicherungsliste und
                Carnet-Datenblatt entstehen. Sie stehen NEBENEINANDER und werden
                nicht auseinander gerechnet: ein Zeitwert waere eine Abschreibung
                nach einer Regel, die der Versicherer bestimmt und diese Anwendung
                nicht kennt. */}
            <label className="block">
              {t('inventory.purchase', 'Purchase price')}
              <input
                inputMode="decimal"
                value={form.kaufBetrag ?? ''}
                onChange={(e) => setForm({ ...form, kaufBetrag: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block">
              {t('inventory.purchaseCurrency', 'Currency')}
              <input
                value={form.kaufWaehrung ?? ''}
                onChange={(e) => setForm({ ...form, kaufWaehrung: e.target.value })}
                placeholder={t('inventory.currencyPh', 'e.g. EUR')}
                className={inputCls}
              />
            </label>
            <label className="block">
              {t('inventory.purchaseDate', 'Bought on')}
              <input type="date" value={form.kaufAm ?? ''} onChange={(e) => setForm({ ...form, kaufAm: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              {t('inventory.insuredValue', 'Insured value')}
              <input
                inputMode="decimal"
                value={form.versBetrag ?? ''}
                onChange={(e) => setForm({ ...form, versBetrag: e.target.value })}
                className={inputCls}
              />
            </label>
            <label className="block">
              {t('inventory.insuredCurrency', 'Currency')}
              <input
                value={form.versWaehrung ?? ''}
                onChange={(e) => setForm({ ...form, versWaehrung: e.target.value })}
                placeholder={t('inventory.currencyPh', 'e.g. EUR')}
                className={inputCls}
              />
            </label>
            <label className="block">
              {t('inventory.insuredAsOf', 'Value as of')}
              <input type="date" value={form.versStand ?? ''} onChange={(e) => setForm({ ...form, versStand: e.target.value })} className={inputCls} />
            </label>
            <label className="block md:col-span-2">
              {t('inventory.notes', 'Note')}
              <input value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5">
              {t('common.cancel', 'Cancel')}
            </button>
            <button type="button" disabled={!form.itemId} onClick={handleSave} className="rounded bg-emerald-700 px-3 py-1 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
              {t('common.save', 'Save')}
            </button>
          </div>
        </div>
      )}

      {/* BEDARF 107 — was an den Nummern nicht stimmt. Beide Doppelungen sind
          unmöglich und deshalb aussagekräftig: eine Herstellernummer gibt es
          genau einmal auf der Welt, eine Hausreferenz genau einmal im Haus. */}
      {identitaetsBefunde.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1 text-cp-xs">
          {identitaetsBefunde.map((f, i) => (
            <li key={`${f.kind}-${i}`} className="text-amber-300/90">
              <strong>{IDENTITY_FINDING_LABEL[f.kind]}</strong> — {f.text}
            </li>
          ))}
        </ul>
      )}
      {units.length === 0 ? (
        <div className="rounded border border-dashed border-cp-border py-10 text-center text-cp-text-muted">
          {items.length === 0
            ? t('inventory.unitsNoItems', 'Create items first, then you can serialize individual units.')
            : t('inventory.unitsEmpty', 'No units yet. Serialize individual copies of an item.')}
        </div>
      ) : (
        <div className="space-y-1">
          {units.map((u) => (
            <div key={u.id} className="rounded border border-cp-border-muted bg-cp-surface-2">
              <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
                <Tags size={13} className="shrink-0 text-cp-text-muted" />
                <span className="font-medium">{itemById.get(u.itemId)?.model ?? t('inventory.unknownItem', '(deleted item)')}</span>
                {u.serial && <span className="text-cp-text-secondary">SN {u.serial}</span>}
                {u.houseRef && <span className="text-cp-text-secondary">#{u.houseRef}</span>}
                {u.code && codeCell(u.code, u.codeType)}
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${CONDITION_TONE[u.condition]}`}>{conditionLabel(u.condition)}</span>
                {/* BEDARF 52 — der Verdacht steht NEBEN dem Zustand, nicht
                    darin. „defekt" ist eine Entscheidung, die jemand getroffen
                    hat; „3 offene Fehler" ist eine Zählung, und genau die lebte
                    bisher nur im Gedächtnis der Crew. */}
                {openFaultsOf(u).length > 0 && (
                  <span
                    className="rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] text-amber-200"
                    title={affectedServices(u)
                      .map((x) => FAULT_SERVICE_LABEL[x])
                      .join(', ')}
                  >
                    {t('inventory.openFaults', '{n} open faults').replace(
                      '{n}',
                      String(openFaultsOf(u).length),
                    )}
                  </span>
                )}
                {/* Zustand ändern */}
                <select
                  value={u.condition}
                  onChange={(e) => setUnitCondition(u.id, e.target.value as UnitCondition)}
                  className="rounded border border-cp-border bg-cp-surface-3 p-0.5 text-[10px]"
                  title={t('inventory.setCondition', 'Change condition')}
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
                  title={t('inventory.moveUnit', 'Change location')}
                >
                  <option value="">{t('inventory.noLocation', '— no location —')}</option>
                  {nodeOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="ml-auto flex gap-1">
                  <button type="button" onClick={() => setFaultFor(faultFor === u.id ? null : u.id)} className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('inventory.reportFault', 'Report a fault')}>
                    <AlertTriangle size={13} />
                  </button>
                  <button type="button" onClick={() => setOpenHistory(openHistory === u.id ? null : u.id)} className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('inventory.history', 'History')}>
                    <ClipboardList size={13} />
                  </button>
                  <button type="button" onClick={() =>
                      setForm({
                        ...u,
                        kaufBetrag: eingabeAusGeld(u.anschaffung?.betrag),
                        kaufWaehrung: u.anschaffung?.betrag.waehrung ?? '',
                        kaufAm: u.anschaffung?.am ?? '',
                        versBetrag: eingabeAusGeld(u.versicherungswert?.betrag),
                        versWaehrung: u.versicherungswert?.betrag.waehrung ?? '',
                        versStand: u.versicherungswert?.stand ?? '',
                      })
                    } className="rounded p-1 text-cp-text-muted hover:bg-cp-surface-4 hover:text-cp-text" title={t('common.edit', 'Edit')}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => handleDelete(u)} className="rounded p-1 text-cp-text-muted hover:bg-red-900/50 hover:text-red-300" title={t('common.delete', 'Delete')}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {openHistory === u.id && (
                <ul className="border-t border-cp-border-muted px-3 py-1.5 text-[10px] text-cp-text-secondary">
                  {u.history.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="tabular-nums text-cp-text-faint">{e.at.slice(0, 10)}</span>
                      {/* Ein Fehler sieht anders aus als eine Notiz — sonst
                          geht er in der Historie unter, und das ist genau der
                          Zustand vor diesem Bedarf. */}
                      {e.kind === 'fault' && (
                        <span className={e.resolved ? 'text-cp-text-faint' : 'text-amber-300/90'}>
                          {e.resolved
                            ? t('inventory.faultResolved', 'Fault (resolved)')
                            : t('inventory.faultOpen', 'Fault')}
                        </span>
                      )}
                      <span>{e.detail}</span>
                      {e.kind === 'fault' && (e.services ?? []).length > 0 && (
                        <span className="text-cp-text-faint">
                          ({(e.services ?? []).map((x) => FAULT_SERVICE_LABEL[x]).join(', ')})
                        </span>
                      )}
                      {e.kind === 'fault' && !e.resolved && (
                        <button
                          type="button"
                          onClick={() => resolveUnitFault(u.id, e.at)}
                          className="text-cp-text-muted underline hover:text-cp-text"
                        >
                          {t('inventory.markResolved', 'resolved')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {faultFor === u.id && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-cp-border-muted px-3 py-1.5 text-[10px]">
                  <input
                    value={faultText}
                    onChange={(e) => setFaultText(e.target.value)}
                    placeholder={t('inventory.faultPh', 'What happened? (video lost from camera 3 \u2026)')}
                    aria-label={t('inventory.faultText', 'Fault description')}
                    className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-3 p-1"
                  />
                  {(Object.keys(FAULT_SERVICE_LABEL) as FaultService[]).map((sv) => (
                    <label key={sv} className="flex items-center gap-0.5">
                      <input
                        type="checkbox"
                        checked={faultServices.includes(sv)}
                        onChange={(e) =>
                          setFaultServices((prev) =>
                            e.target.checked ? [...prev, sv] : prev.filter((x) => x !== sv),
                          )
                        }
                      />
                      {FAULT_SERVICE_LABEL[sv]}
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      reportUnitFault(u.id, faultText, faultServices)
                      setFaultText('')
                      setFaultServices([])
                      setFaultFor(null)
                    }}
                    className="rounded border border-cp-border px-2 py-0.5 hover:bg-cp-surface-4"
                  >
                    {t('inventory.faultSave', 'Record')}
                  </button>
                </div>
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

  // Der Stichtag kommt EINMAL aus der Uhr und wird durchgereicht — sonst
  // beantwortet dieselbe Zeile in zwei Zellen zwei verschiedene Tage.
  const heuteIso = new Date().toISOString().slice(0, 10)
  type Entry = { code: string; title?: string; codeType?: InventoryCodeType; note?: string }
  // Sammelt die zu druckenden Codes (nur Entitäten MIT Code — kein Raten).
  const collect = (): Entry[] => {
    if (source === 'items') {
      return items
        .filter((it) => it.code)
        .map((it) => ({ code: it.code!, title: it.model, codeType: it.codeType, note: ownershipNote(it, heuteIso) }))
    }
    if (source === 'nodes') {
      return nodes.filter((n) => n.code).map((n) => ({ code: n.code!, title: n.name, codeType: n.codeType }))
    }
    if (source === 'units') {
      return units
        .filter((u) => u.code)
        .map((u) => {
          const it = itemById.get(u.itemId)
          return {
            code: u.code!,
            title: it?.model,
            codeType: u.codeType,
            // Die Einheit erbt die Herkunft ihres Artikels.
            note: it ? ownershipNote(it, heuteIso) : '',
          }
        })
    }
    // 'case' — Codes aller Artikel + Einheiten (rekursiv) im gewählten Container.
    if (!caseId) return []
    const ids = new Set([caseId, ...descendantNodeIds(nodes, caseId)])
    const out: Entry[] = []
    for (const it of items) {
      if (it.code && it.locationId && ids.has(it.locationId)) {
        out.push({ code: it.code, title: it.model, codeType: it.codeType, note: ownershipNote(it, heuteIso) })
      }
    }
    for (const u of units) {
      if (!u.code || !u.locationId || !ids.has(u.locationId)) continue
      const it = itemById.get(u.itemId)
      out.push({
        code: u.code,
        title: it?.model,
        codeType: u.codeType,
        note: it ? ownershipNote(it, heuteIso) : '',
      })
    }
    return out
  }

  // Symbologie je Eintrag: 'auto' folgt der Code-Art des Objekts (Default QR).
  const symbologyFor = (e: Entry): 'qr' | 'barcode' =>
    symbology === 'auto' ? (e.codeType === 'barcode' ? 'barcode' : 'qr') : symbology

  const specsCount = useMemo(() => collect().length, [source, caseId, items, nodes, units]) // eslint-disable-line react-hooks/exhaustive-deps
  const pages = labelPageCount(specsCount, sheet, offset)

  // BEDARF 70 — passt der Klartext-Code auf dieses Format?
  //
  // Der Beleg bittet ausdruecklich um den Code als Text, „for visual
  // confirmation and manual entry" (snipe-it#18280). Genau der geht verloren,
  // wenn er nicht draufpasst: `.lbl` schneidet mit `overflow: hidden` ab, und
  // auf dem Bogen sieht das aus wie ein fertiges Etikett. Die Schaetzung
  // laeuft VOR dem Druck, nicht danach.
  const fit = useMemo(
    () =>
      estimateLabelFit(
        sheet,
        collect().map((e) => ({
          code: e.code,
          title: e.title,
          symbology: symbologyFor(e),
          ...(e.note ? { note: e.note } : {}),
        })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, source, caseId, items, nodes, units, symbology],
  )
  const passende = useMemo(
    () =>
      formatsThatFit(
        collect().map((e) => ({
          code: e.code,
          title: e.title,
          symbology: symbologyFor(e),
          ...(e.note ? { note: e.note } : {}),
        })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, caseId, items, nodes, units, symbology],
  )

  const handlePrint = async () => {
    const entries = collect()
    if (entries.length === 0) {
      await infoDialog(t('inventory.labelsNoneTitle', 'No codes'), {
        tone: 'info',
        body: t('inventory.labelsNone', 'The selected source contains no items/objects with a stored code.'),
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
        labels.push({
          qrDataUrl: dataUrl,
          code: e.code,
          title: e.title,
          symbology: sym,
          ...(e.note ? { note: e.note } : {}),
        })
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
        {t('inventory.labelsHint', 'Print QR labels — on A4 sheets (Avery/Zweckform) or continuous label printers. Only objects with a stored code.')}
      </span>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="block">
          {t('inventory.labelSource', 'Source')}
          <select value={source} onChange={(e) => setSource(e.target.value as LabelSource)} className={sel}>
            <option value="items">{t('inventory.labelSrcItems', 'Items with code')}</option>
            <option value="nodes">{t('inventory.labelSrcNodes', 'Locations / cases with code')}</option>
            <option value="units">{t('inventory.labelSrcUnits', 'Units with code')}</option>
            <option value="case">{t('inventory.labelSrcCase', 'Contents of a case (recursive)')}</option>
          </select>
        </label>
        {source === 'case' && (
          <label className="block">
            {t('inventory.labelCase', 'Case / container')}
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className={sel}>
              <option value="">{t('inventory.pickItem', 'Pick item…')}</option>
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
          {t('inventory.labelSymbology', 'Code type')}
          <select value={symbology} onChange={(e) => setSymbology(e.target.value as 'auto' | 'qr' | 'barcode')} className={sel}>
            <option value="auto">{t('inventory.symAuto', 'Per code type (auto)')}</option>
            <option value="qr">{t('inventory.symQr', 'QR code')}</option>
            <option value="barcode">{t('inventory.symBarcode', 'Barcode (Code128)')}</option>
          </select>
        </label>
        <label className="block">
          {t('inventory.labelFormat', 'Format')}
          <select value={formatId} onChange={(e) => setFormatId(e.target.value)} className={sel}>
            <optgroup label={t('inventory.labelSheetsGroup', 'A4 sheets (Avery / Zweckform)')}>
              {ALL_LABEL_FORMATS.filter((s) => !s.roll).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t('inventory.labelRollsGroup', 'Continuous label printers')}>
              {ALL_LABEL_FORMATS.filter((s) => s.roll).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {!fit.fits && specsCount > 0 && (
          <p className="md:col-span-2 text-cp-xs text-amber-300/90">
            <strong>{t('inventory.labelFitTitle', 'The code does not fully fit')}</strong>{' '}
            {t(
              'inventory.labelFitBody',
              'Estimated from font size and character width \u2014 not measured. This format leaves room for {n} characters; the longest code has {m}. Whatever does not fit is cut off at print time, and that plain-text code is the fallback when the barcode is scuffed.',
            )
              .replace('{n}', String(fit.codeCapacity))
              .replace('{m}', String(fit.longestCode.length))}{' '}
            {passende.length > 0
              ? t('inventory.labelFitAlt', 'It fits on: {liste}').replace(
                  '{liste}',
                  passende.map((s2) => s2.name).join(', '),
                )
              : t(
                  'inventory.labelFitNone',
                  'It does not fit completely on any of the stored formats \u2014 only a shorter code helps here.',
                )}
          </p>
        )}
        {!sheet.roll && (
          <label className="block">
            {t('inventory.labelOffset', 'First label position (partially used sheet)')}
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
          {format(t('inventory.labelSummary', '{n} labels · {p} page(s)'), { n: specsCount, p: pages })}
        </span>
        <button
          type="button"
          disabled={busy || specsCount === 0}
          onClick={handlePrint}
          className="flex items-center gap-1 rounded bg-emerald-700 px-3 py-1.5 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer size={14} />
          {busy ? t('inventory.labelBusy', 'Generating…') : t('inventory.labelPrint', 'Print')}
        </button>
      </div>
    </div>
  )
}

// ── Reports-Tab ──────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────
// Bedarf 15 — Ausgabe und Rueckgabe auf Container-Ebene.
//
// EIN Knopf gibt das Transport-Case samt allem darin aus; der Inhalt folgt
// mit, weil er im Baum haengt und nicht angefasst wird. Genau das ist der
// Unterschied zu der halben Stunde Klickerei, die snipe-it#9517 beschreibt.
//
// KEIN DOKUMENT-STEMPEL auf diesen Blaettern. Der Stempel (ADR-004) bindet
// ein Blatt an einen PLAN-Stand; ein Ausgabeschein haengt am Lager und nicht
// am geoeffneten Projekt. Einen Plan-Fingerabdruck daraufzuschreiben waere
// eine Aussage ueber etwas, das dieses Blatt nicht beschreibt.
// ───────────────────────────────────────────────────────────────────────────
const CheckoutTab = () => {
  const t = useTranslation()
  const items = useInventoryStore((s) => s.items)
  const nodes = useInventoryStore((s) => s.nodes)
  const units = useInventoryStore((s) => s.units)
  const records = useCheckoutStore((s) => s.records)
  const checkOut = useCheckoutStore((s) => s.checkOut)
  const checkIn = useCheckoutStore((s) => s.checkIn)
  const extendDueBack = useCheckoutStore((s) => s.extendDueBack)
  const removeRecord = useCheckoutStore((s) => s.removeRecord)
  // BEDARF 136 — quittieren, beide Beine.
  const sign = useCheckoutStore((s) => s.sign)
  const [signRefusal, setSignRefusal] = useState<string | null>(null)

  const [nodeId, setNodeId] = useState('')
  const [to, setTo] = useState('')
  const [projectName, setProjectName] = useState('')
  const [dueBack, setDueBack] = useState('')
  const [refusal, setRefusal] = useState<CheckoutRefusal | CustodyStartRefusal | null>(null)
  /**
   * BEDARF 98 — der Zeitpunkt der Ausgabe, wenn sie nachgetragen wird.
   *
   * Leer heisst „jetzt". Der Beleg nennt genau diesen Fall: „items picked up
   * in hurry" — erst laden, dann eintragen. Ohne dieses Feld bekaeme der
   * Vorgang den Zeitpunkt des Eintragens, und die Ueberfaelligkeit rechnete
   * ab dem falschen Tag.
   */
  const [outAt, setOutAt] = useState('')
  const [extendDraft, setExtendDraft] = useState<Record<string, string>>({})
  const [extendMsg, setExtendMsg] = useState<Record<string, string>>({})
  // Bedarf 16 — der Papierweg zurueck. Der Code vom Blatt wird gegen die
  // Ausgabeliste gehalten; das Abhaken auf Papier wird damit zur EINGABE fuer
  // den Datensatz statt zu einem zweiten, der ihm widerspricht.
  // Bedarf 68 — Schaeden, aufgenommen in dem Moment, in dem das Objekt in der
  // Hand ist. Schluessel: `recordId` → `kind:refId` → Text.
  const [damageDraft, setDamageDraft] = useState<Record<string, Record<string, string>>>({})
  const [damageOpen, setDamageOpen] = useState<Record<string, boolean>>({})
  const [scanDraft, setScanDraft] = useState<Record<string, string>>({})
  const [scanEcho, setScanEcho] = useState<Record<string, { text: string; ok: boolean }>>({})

  const snap = useMemo(() => ({ items, nodes, units }), [items, nodes, units])
  const container = useMemo(() => nodes.filter((n) => isContainerKind(n.kind)), [nodes])
  const offen = useMemo(() => records.filter((r) => !r.in), [records])
  const zurueck = useMemo(() => records.filter((r) => r.in), [records])
  // Bedarf 68 — die aufgenommenen Schaeden mit ihrer abgeleiteten Zuordnung.
  const schaeden = useMemo(() => damageEntries(records), [records])
  const haeufung = useMemo(() => damageTally(records, 'person'), [records])
  // Der Stichtag kommt EINMAL aus der Uhr und wird durchgereicht — sonst
  // beantwortet dieselbe Zeile in zwei Zellen zwei verschiedene Tage.
  const heute = new Date().toISOString().slice(0, 10)
  const ueberfaellig = useMemo(() => new Set(overdueCheckouts(records, heute).map((r) => r.id)), [records, heute])

  // Was WUERDE rausgehen — vor dem Klick sichtbar. Ein Knopf, der ungesehen
  // vierzig Positionen ausbucht, wird beim ersten Fehlgriff nicht mehr benutzt.
  const vorschau = useMemo(
    () => (nodeId ? containerContents(snap, nodeId) : []),
    [snap, nodeId],
  )

  const ausgeben = () => {
    if (!nodeId || !to.trim()) return
    const r = checkOut(
      snap,
      nodeId,
      {
        to: to.trim(),
        ...(projectName.trim() ? { projectName: projectName.trim() } : {}),
        ...(dueBack ? { dueBack } : {}),
      },
      // Ein Datum ohne Uhrzeit: der Vorgang wird auf den Mittag dieses Tages
      // gebucht. Mitternacht waere schlechter — bei einer Ausgabe, die
      // gestern lief, saehe „00:00" nach einer Systemangabe aus statt nach
      // einer nachgetragenen.
      outAt ? `${outAt}T12:00:00` : undefined,
    )
    setRefusal(r ?? null)
    if (!r) {
      setNodeId('')
      setTo('')
      setProjectName('')
      setDueBack('')
      setOutAt('')
    }
  }

  /** BEDARF 98 — den Rueckgabetermin verschieben, in beide Richtungen. */
  const verschiebe = (r: CheckoutRecord) => {
    const ziel = (extendDraft[r.id] ?? '').trim()
    if (!ziel) return
    const grund = extendDueBack(r.id, ziel)
    setExtendMsg((m) => ({
      ...m,
      [r.id]:
        grund === undefined
          ? ''
          : grund === 'unknown-record'
            ? t('inventory.checkout.unknownRecord', 'That record no longer exists.')
            : EXTEND_REFUSAL_TEXT[grund as ExtendRefusal],
    }))
    if (grund === undefined) setExtendDraft((d) => ({ ...d, [r.id]: '' }))
  }

  /** Die aufgenommenen Schaeden eines Vorgangs, als Belegzeilen. */
  const damageOf = (r: CheckoutRecord): CheckoutDamage[] => {
    const entwurf = damageDraft[r.id] ?? {}
    return r.contents
      .map((line) => ({ line, note: (entwurf[`${line.kind}:${line.refId}`] ?? '').trim() }))
      .filter((d) => d.note.length > 0)
  }

  const bucheZurueck = (r: CheckoutRecord) => {
    checkIn(snap, r.id, undefined, damageOf(r))
    // Der Entwurf ist verbraucht: er steht jetzt im Beleg, und ein
    // stehengebliebener Text landete beim naechsten Vorgang im falschen.
    setDamageDraft((d) => ({ ...d, [r.id]: {} }))
    setDamageOpen((o) => ({ ...o, [r.id]: false }))
  }

  const scanBack = (r: CheckoutRecord) => {
    const roh = (scanDraft[r.id] ?? '').trim()
    if (!roh) return
    const treffer = scanBackIntoCheckout(r, roh)
    setScanEcho((s) => ({
      ...s,
      [r.id]:
        treffer.kind === 'line'
          ? {
              text: format(t('inventory.checkout.scanHit', '{code} \u2192 {label}'), {
                code: roh,
                label: treffer.line.label,
              }),
              ok: true,
            }
          : {
              // Die nuetzlichste Auskunft dieses Scans. Sie faengt das Packen
              // ins falsche Case, und zwar bevor es faehrt.
              text: format(t('inventory.checkout.scanMiss', '{code} does not belong to this check-out'), {
                code: roh,
              }),
              ok: false,
            },
    }))
    setScanDraft((s) => ({ ...s, [r.id]: '' }))
  }

  const refusalLabel = (r: CheckoutRefusal | CustodyStartRefusal): string => {
    switch (r) {
      case 'not-a-container':
        return t('inventory.checkout.notContainer', 'Not a container: only cases and transport cases can be checked out')
      case 'already-out':
        return t('inventory.checkout.alreadyOut', 'Already checked out')
      case 'inside-checked-out':
        return t('inventory.checkout.insideOut', 'Sits inside a container that is already checked out')
      case 'unknown-node':
        return t('inventory.checkout.unknownNode', 'Unknown storage node')
      // BEDARF 98 — die Zeit-Absagen. Der Wortlaut steht in
      // `custodyPeriod.ts`, damit Regel und Satz an einer Stelle liegen.
      case 'in-the-future':
      case 'not-a-time':
        return CUSTODY_START_REFUSAL_TEXT[r]
    }
  }

  return (
    <div className="space-y-3">
      <PanelHint
        className="text-cp-sm leading-snug text-cp-text-secondary"
        text={t(
          'inventory.checkout.intro',
          'A container goes out as a whole \u2014 whatever sits inside follows across every level. The check-out records what was ACTUALLY in it; on return the difference is reported, not quietly settled.',
        )}
      />

      {/* Ausgeben */}
      <div className="rounded border border-cp-border bg-cp-surface-2 p-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select
            value={nodeId}
            onChange={(e) => {
              setNodeId(e.target.value)
              setRefusal(null)
            }}
            aria-label={t('inventory.checkout.container', 'Container')}
            className="rounded border border-cp-border bg-cp-surface-3 p-1.5"
          >
            <option value="">{t('inventory.checkout.pick', '\u2014 pick a container \u2014')}</option>
            {container.map((n) => (
              <option key={n.id} value={n.id}>
                {nodePathLabel(nodes, n.id)}
              </option>
            ))}
          </select>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={t('inventory.checkout.to', 'To (person, truck, client)')}
            aria-label={t('inventory.checkout.to', 'To (person, truck, client)')}
            className="min-w-[12rem] rounded border border-cp-border bg-cp-surface-3 p-1.5"
          />
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder={t('inventory.checkout.show', 'Show (optional)')}
            aria-label={t('inventory.checkout.show', 'Show (optional)')}
            className="min-w-[10rem] rounded border border-cp-border bg-cp-surface-3 p-1.5"
          />
          <label className="flex items-center gap-1.5 text-cp-text-secondary">
            {t('inventory.checkout.outAt', 'Handed out on')}
            <input
              type="date"
              value={outAt}
              onChange={(e) => setOutAt(e.target.value)}
              title={t(
                'inventory.checkout.outAtHint',
                'Empty means now. A day in the past records a hand-out that has already happened.',
              )}
              className="rounded border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>
          <label className="flex items-center gap-1.5 text-cp-text-secondary">
            {t('inventory.checkout.dueBack', 'Due back')}
            <input
              type="date"
              value={dueBack}
              onChange={(e) => setDueBack(e.target.value)}
              className="rounded border border-cp-border bg-cp-surface-3 p-1.5"
            />
          </label>
          <button
            type="button"
            onClick={ausgeben}
            disabled={!nodeId || !to.trim()}
            className="flex items-center gap-1 rounded border border-cp-border px-2.5 py-1 text-cp-text-secondary hover:text-cp-text disabled:opacity-40"
          >
            <Truck size={13} /> {t('inventory.checkout.doOut', 'Check out')}
          </button>
        </div>

        {refusal && (
          <div className="flex items-start gap-1 text-cp-danger">
            <AlertTriangle size={12} className="mt-0.5 flex-none" />
            <span>{refusalLabel(refusal)}</span>
          </div>
        )}

        {nodeId && !refusal && (
          <div className="text-cp-text-muted">
            {vorschau.length === 0
              ? t('inventory.checkout.empty', 'This container is empty \u2014 nothing would go out.')
              : format(t('inventory.checkout.preview', '{n} positions go with it: {list}'), {
                  n: vorschau.length,
                  list: vorschau.slice(0, 8).map((l) => l.label).join(', ') + (vorschau.length > 8 ? ' …' : ''),
                })}
          </div>
        )}
      </div>

      {/* Offene Vorgaenge */}
      <div className="rounded border border-cp-border">
        <div className="flex items-center justify-between border-b border-cp-border-muted bg-cp-surface-2 px-2 py-1">
          <span className="font-medium">
            {format(t('inventory.checkout.openTitle', 'Out ({n})'), { n: offen.length })}
          </span>
          <button
            type="button"
            disabled={offen.length === 0}
            onClick={() => csv('ausgaben-offen.csv', openCheckoutsTable(records, nodes, heute))}
            className="flex items-center gap-1 text-cp-text-secondary hover:text-cp-text disabled:opacity-40"
          >
            <Download size={12} /> CSV
          </button>
        </div>
        {offen.length === 0 ? (
          <div className="px-2 py-1.5 text-cp-text-muted">{t('inventory.checkout.nothingOut', 'Nothing out.')}</div>
        ) : (
          <table className="w-full text-left">
            <tbody>
              {offen.map((r) => (
                <tr key={r.id} className="border-t border-cp-border-muted align-top">
                  <td className="px-2 py-1">
                    <div className="font-medium text-cp-text">{r.nodeLabel}</div>
                    <div className="text-cp-text-muted">
                      {format(t('inventory.checkout.outLine', 'to {to} \u00b7 {n} positions'), {
                        to: r.out.to,
                        n: r.contents.length,
                      })}
                      {r.out.projectName ? ` · ${r.out.projectName}` : ''}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-cp-text-secondary">
                    <div>{custodyPeriodText(r, new Date().toISOString().slice(0, 10))}</div>
                    {ueberfaellig.has(r.id) && (
                      <span className="text-cp-danger">{t('inventory.checkout.overdue', 'overdue')}</span>
                    )}
                    {/* BEDARF 98 — „edit bookings end date while it's going
                        on". In BEIDE Richtungen: der Beleg nennt das frühere
                        Abziehen im selben Satz wie das Verlängern. */}
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <input
                        type="date"
                        value={extendDraft[r.id] ?? ''}
                        onChange={(e) =>
                          setExtendDraft((d) => ({ ...d, [r.id]: e.target.value }))
                        }
                        aria-label={t('inventory.checkout.newDueBack', 'New return date')}
                        className="rounded border border-cp-border bg-cp-surface-3 p-1"
                      />
                      <button
                        type="button"
                        onClick={() => verschiebe(r)}
                        disabled={!(extendDraft[r.id] ?? '').trim()}
                        className="rounded border border-cp-border px-1.5 py-0.5 hover:text-cp-text disabled:opacity-40"
                      >
                        {t('inventory.checkout.moveDueBack', 'Move return date')}
                      </button>
                      {extensionCount(r) > 0 && (
                        <span className="text-cp-text-muted">
                          {format(t('inventory.checkout.movedTimes', 'moved {n}×'), {
                            n: extensionCount(r),
                          })}
                        </span>
                      )}
                    </div>
                    {extendMsg[r.id] && (
                      <div className="text-cp-danger">{extendMsg[r.id]}</div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => csv(`ausgabeschein-${r.nodeLabel}.csv`, checkoutSheet(r))}
                      className="mr-2 text-cp-text-secondary hover:text-cp-text"
                    >
                      {t('inventory.checkout.sheet', 'Sheet')}
                    </button>
                    {/* BEDARF 136 — die Quittung, und zwar auf BEIDEN Beinen.
                        „check-in has no signature at all, so the return leg
                        has no counter-signed evidence when a dispute arises
                        weeks later" (snipe-it#19070/#19114). Das Blatt traegt
                        beide Zeilen; hier wird festgehalten, WER und WANN. */}
                    <button
                      type="button"
                      onClick={() =>
                        csv(`quittung-${r.nodeLabel}.csv`, handoverSignatureTable(r))
                      }
                      className="mr-2 text-cp-text-secondary hover:text-cp-text"
                      title={t(
                        'inventory.checkout.signState',
                        'Signature block to print (both legs)',
                      )}
                    >
                      {t(`handover.state.${signatureState(r)}`, SIGNATURE_STATE_LABEL[signatureState(r)])}
                    </button>
                    {signRefusal && (
                      <span className="mr-2 text-cp-danger">{signRefusal}</span>
                    )}
                    {(['out', 'in'] as HandoverLeg[]).map((leg) => {
                      const schon = leg === 'out' ? r.out.signature : r.in?.signature
                      if (schon) return null
                      // Die Rueckgabe laesst sich erst gegenzeichnen, wenn sie
                      // stattgefunden hat — sonst quittierte jemand etwas, das
                      // noch im Truck liegt.
                      if (leg === 'in' && !r.in) return null
                      return (
                        <button
                          key={leg}
                          type="button"
                          onClick={async () => {
                            const name = (
                              await promptDialog(
                                leg === 'out'
                                  ? t('handover.askOut', 'Handover signed by:')
                                  : t('handover.askIn', 'Return counter-signed by:'),
                              )
                            )?.trim()
                            if (!name) return
                            const absage = sign(r.id, leg, name)
                            setSignRefusal(
                              absage && absage !== 'unknown-record'
                                ? SIGNATURE_REFUSAL_LABEL[absage]
                                : null,
                            )
                          }}
                          className="mr-2 text-cp-text-secondary hover:text-cp-text"
                        >
                          {leg === 'out'
                            ? t('handover.signOut', 'Sign out')
                            : t('handover.signIn', 'Counter-sign return')}
                        </button>
                      )
                    })}
                    {/* Bedarf 68: der Schaden wird aufgenommen, BEVOR
                        zurueckgebucht wird — danach ist der Beleg zu, und ein
                        Beleg darf nicht nachtraeglich anders lauten. */}
                    <button
                      type="button"
                      onClick={() => setDamageOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                      className="mr-2 text-cp-text-secondary hover:text-cp-text"
                    >
                      {format(t('inventory.checkout.damageBtn', 'Damage ({n})'), {
                        n: damageOf(r).length,
                      })}
                    </button>
                    <button
                      type="button"
                      onClick={() => bucheZurueck(r)}
                      className="mr-2 text-cp-text-secondary hover:text-cp-text"
                    >
                      {t('inventory.checkout.doIn', 'Check in')}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecord(r.id)}
                      aria-label={t('inventory.checkout.remove', 'Delete record')}
                      className="text-cp-text-faint hover:text-cp-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {/* Bedarf 68 — die Aufnahme selbst. Eine Zeile je Position des
                  Vorgangs; wer nichts eintraegt, hat keinen Schaden gemeldet.
                  KEIN Ankreuzfeld: „beschaedigt" ohne Angabe hilft weder der
                  Werkstatt noch der Rechnung. */}
              {offen
                .filter((r) => damageOpen[r.id])
                .map((r) => (
                  <tr key={`${r.id}-damage`} className="border-t border-cp-border-muted">
                    <td colSpan={3} className="bg-cp-surface-2 px-2 py-1.5">
                      <div className="mb-1 text-cp-text-secondary">
                        {format(t('inventory.checkout.damageTitle', 'Record damage — {name}'), {
                          name: r.nodeLabel,
                        })}
                      </div>
                      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                        {r.contents.map((line) => {
                          const key = `${line.kind}:${line.refId}`
                          return (
                            <li key={key} className="flex items-center gap-2">
                              <span className="min-w-[9rem] flex-none truncate text-cp-text-muted">
                                {line.label}
                              </span>
                              <input
                                value={damageDraft[r.id]?.[key] ?? ''}
                                onChange={(e) =>
                                  setDamageDraft((d) => ({
                                    ...d,
                                    [r.id]: { ...(d[r.id] ?? {}), [key]: e.target.value },
                                  }))
                                }
                                placeholder={t('inventory.checkout.damagePh', 'What is broken?')}
                                className="flex-1 rounded border border-cp-border bg-cp-surface-3 px-1.5 py-1"
                              />
                            </li>
                          )
                        })}
                      </ul>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {/* Bedarf 16 — der Papierweg zurueck. Der Schein traegt die
            Etiketten-Codes; hier kommen sie wieder herein, per Lesegeraet
            oder getippt. Ein Code, der nicht zum Vorgang gehoert, wird als
            solcher gemeldet — das ist der eigentliche Fang. */}
        {offen.length > 0 && (
          <div className="border-t border-cp-border-muted px-2 py-1.5">
            <div className="mb-1 text-cp-text-secondary">
              {t(
                'inventory.checkout.scanIntro',
                'Read a code off the run sheet \u2014 ticking on paper becomes the input, not a second list.',
              )}
            </div>
            {offen.map((r) => {
              const ohneEtikett = unlabelledLines(r)
              return (
                <div key={r.id} className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-cp-text-muted">{r.nodeLabel}</span>
                  <input
                    value={scanDraft[r.id] ?? ''}
                    onChange={(e) => setScanDraft((s) => ({ ...s, [r.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') scanBack(r)
                    }}
                    placeholder={t('inventory.checkout.scanPlaceholder', 'Label code')}
                    aria-label={format(t('inventory.checkout.scanFor', 'Code for {node}'), { node: r.nodeLabel })}
                    className="w-40 rounded border border-cp-border bg-cp-surface-3 p-1"
                  />
                  <button
                    type="button"
                    onClick={() => scanBack(r)}
                    className="rounded border border-cp-border px-2 py-0.5 text-cp-text-secondary hover:text-cp-text"
                  >
                    {t('inventory.checkout.scanCheck', 'Check')}
                  </button>
                  {scanEcho[r.id] && (
                    <span className={scanEcho[r.id].ok ? 'text-cp-text-secondary' : 'text-cp-danger'}>
                      {scanEcho[r.id].text}
                    </span>
                  )}
                  {ohneEtikett.length > 0 && (
                    // Kein Fehler, sondern eine Arbeitsliste: diese Positionen
                    // muessen von Hand abgeglichen werden, bis sie ein Etikett
                    // haben.
                    <span className="text-cp-text-faint">
                      {format(t('inventory.checkout.unlabelled', '{n} without a label \u2014 hand reconciliation only'), {
                        n: ohneEtikett.length,
                      })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Rueckgabe-Befunde — nur die mit Abweichung. Ein Blatt, auf dem auch
          die glatten Rueckgaben stehen, wird nicht gelesen. */}
      {zurueck.some((r) => r.in!.missing.length > 0 || r.in!.extra.length > 0) && (
        <div className="rounded border border-cp-warn/40">
          <div className="flex items-center justify-between border-b border-cp-border-muted bg-cp-surface-2 px-2 py-1">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertTriangle size={13} /> {t('inventory.checkout.discrepancy', 'Return findings')}
            </span>
            <button
              type="button"
              onClick={() => csv('rueckgabe-befunde.csv', discrepancyTable(records))}
              className="flex items-center gap-1 text-cp-text-secondary hover:text-cp-text"
            >
              <Download size={12} /> CSV
            </button>
          </div>
          <ul className="flex flex-col gap-0.5 px-2 py-1.5">
            {zurueck
              .filter((r) => r.in!.missing.length > 0 || r.in!.extra.length > 0)
              .map((r) => (
                <li key={r.id} className="text-cp-warn">
                  {format(t('inventory.checkout.discrepancyLine', '{node} (to {to}): {missing} missing, {extra} extra'), {
                    node: r.nodeLabel,
                    to: r.out.to,
                    missing: r.in!.missing.length,
                    extra: r.in!.extra.length,
                  })}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* BEDARF 68 — Schaden MIT ZUORDNUNG. Der Bedarf nennt sie „the valuable
          field" (job, person, time, container) und das Foto ausdruecklich
          nicht. Die Zuordnung steht nicht am Schaden, sondern wird aus dem
          Vorgang abgeleitet — vier gespeicherte Felder waeren von der ersten
          Korrektur am Vorgang an falsch.

          Die Haeufungs-Zeile ist der Wunsch aus dem Beleg (snipe-it#13153):
          „to see whether particular people/locations tend to break devices
          more often". Sie ZAEHLT und urteilt nicht — ein Werkzeug, das aus
          drei Vorfaellen eine Schuld macht, wird beim vierten nicht mehr
          gefuettert. */}
      {schaeden.length > 0 && (
        <div className="rounded border border-cp-danger/40">
          <div className="flex items-center justify-between border-b border-cp-border-muted bg-cp-surface-2 px-2 py-1">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertTriangle size={13} />
              {format(t('inventory.checkout.damageTitleList', 'Damage ({n})'), { n: schaeden.length })}
            </span>
            <button
              type="button"
              onClick={() => csv('schaeden.csv', damageTable(records))}
              className="flex items-center gap-1 text-cp-text-secondary hover:text-cp-text"
            >
              <Download size={12} /> CSV
            </button>
          </div>
          <ul className="flex flex-col gap-0.5 px-2 py-1.5">
            {schaeden.slice(0, 12).map((e, i) => (
              <li key={`${e.recordId}-${e.label}-${i}`} className="text-cp-text-secondary">
                {format(
                  t('inventory.checkout.damageLine', '{at} · {label}: {note} — {job}, out to {person} ({container})'),
                  {
                    at: e.at.slice(0, 10),
                    label: e.label,
                    note: e.note,
                    job: e.job,
                    person: e.person,
                    container: e.container,
                  },
                )}
              </li>
            ))}
          </ul>
          {haeufung.length > 1 && (
            <div className="border-t border-cp-border-muted px-2 py-1.5 text-cp-text-muted">
              {format(t('inventory.checkout.damageTally', 'Concentration by who it went out to: {list}'), {
                list: haeufung.map((h) => `${h.key} (${h.count})`).join(', '),
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
                <td className="px-2 py-1 text-right tabular-nums text-cp-text-secondary">{format(t('inventory.reportRow', '{units} pcs · {items} pos.'), { units: r.units, items: r.items })}</td>
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
        {kpi(t('inventory.kpiItems', 'Item positions'), report.itemCount)}
        {kpi(t('inventory.kpiUnits', 'Units (bulk)'), report.totalUnits)}
        {kpi(t('inventory.kpiSerialized', 'Serialized'), report.serializedCount)}
        {kpi(t('inventory.kpiValue', 'Rental vol./day (€)'), report.dailyRentalValue.toFixed(2))}
      </div>
      {report.itemsWithoutPrice > 0 && (
        <div className="rounded border border-amber-600/40 bg-amber-600/10 px-2 py-1 text-amber-500">
          {format(t('inventory.reportNoPrice', '{n} items without rental price — rental volume incomplete.'), { n: report.itemsWithoutPrice })}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {breakdown(t('inventory.byCategory', 'By category'), report.byCategory)}
        {breakdown(t('inventory.byLocation', 'By location (root)'), report.byLocation)}
        {breakdown(t('inventory.byOwnership', 'By ownership'), report.byOwnership)}
        {breakdown(t('inventory.byMaterial', 'By material type'), report.byMaterial)}
      </div>
      {report.serializedCount > 0 && breakdown(t('inventory.byCondition', 'Units by condition'), report.unitsByCondition)}
    </div>
  )
}
