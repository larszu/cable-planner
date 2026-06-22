// Issue #354 — generischer Equipment-CSV-Import in die Library.
//
// Non-destruktiv: erzeugt Custom-Library-Templates via addCustomTemplates
// (merged by-name, überschreibt keine bestehenden). Spalten werden anhand
// der Kopfzeile automatisch zugeordnet (DE/EN-Aliase); der User sieht eine
// Vorschau bevor importiert wird. Deckt Rental-Systeme ab, die kein
// dediziertes Plugin haben (Current RMS / HireHop / Flex / Excel-Export).

import { useMemo, useState } from 'react'
import { FileUp } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { Button } from '../shared/Button'
import { infoDialog } from '../../lib/infoDialog'
import { useTranslation, format } from '../../lib/i18n'
import type { EquipmentTemplate } from '../../types/equipment'

type FieldKey = 'name' | 'category' | 'watts' | 'weight' | 'serial' | 'ip' | 'rackUnits' | 'subtitle'

const ALIASES: Record<FieldKey, string[]> = {
  name: ['name', 'gerät', 'geraet', 'device', 'bezeichnung', 'artikel'],
  category: ['kategorie', 'category', 'typ', 'type', 'gruppe'],
  watts: ['watt', 'watts', 'leistung', 'power', 'w'],
  weight: ['gewicht', 'weight', 'kg'],
  serial: ['seriennummer', 'serial', 's/n', 'sn'],
  ip: ['ip', 'ip-adresse', 'ipaddress', 'ip address', 'ip adresse'],
  rackUnits: ['he', 'rackunits', 'ru', 'höheneinheiten', 'hoeheneinheiten'],
  subtitle: ['untertitel', 'subtitle', 'hersteller', 'manufacturer', 'marke', 'brand'],
}

/** CSV → Zeilen. Quote-fähig, Trenner (; oder ,) aus der Kopfzeile erkannt. */
const parseCsv = (text: string): string[][] => {
  const t = text.replace(/\r\n?/g, '\n').replace(/^\u{FEFF}/u, '').trim()
  if (!t) return []
  const firstLine = t.split('\n')[0] ?? ''
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQ) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === delim) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  rows.push(row)
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

const mapHeader = (header: string[]): Partial<Record<FieldKey, number>> => {
  const map: Partial<Record<FieldKey, number>> = {}
  header.forEach((h, i) => {
    const key = h.trim().toLowerCase()
    for (const [field, aliases] of Object.entries(ALIASES) as [FieldKey, string[]][]) {
      if (map[field] == null && aliases.includes(key)) map[field] = i
    }
  })
  return map
}

const toNum = (s?: string): number | undefined => {
  const n = parseFloat((s ?? '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

const buildTemplates = (
  rows: string[][],
  map: Partial<Record<FieldKey, number>>,
  fallbackCategory: string,
): EquipmentTemplate[] => {
  const at = (r: string[], key: FieldKey): string | undefined =>
    map[key] != null ? r[map[key] as number]?.trim() : undefined
  const [, ...body] = rows
  const out: EquipmentTemplate[] = []
  for (const r of body) {
    const name = (map.name != null ? r[map.name] : r[0])?.trim()
    if (!name) continue
    const tpl: EquipmentTemplate = {
      name,
      category: at(r, 'category') || fallbackCategory,
      inputs: [],
      outputs: [],
      width: 220,
      height: 60,
    }
    const w = toNum(at(r, 'watts'))
    if (w != null) tpl.powerConsumptionWatts = w
    const kg = toNum(at(r, 'weight'))
    if (kg != null) tpl.weightKg = kg
    const sn = at(r, 'serial')
    if (sn) tpl.serialNumber = sn
    const ip = at(r, 'ip')
    if (ip) tpl.ipAddress = ip
    const ru = toNum(at(r, 'rackUnits'))
    if (ru != null) {
      tpl.rackUnits = Math.max(1, Math.round(ru))
      tpl.isRackDevice = true
    }
    const sub = at(r, 'subtitle')
    if (sub) tpl.subtitle = sub
    out.push(tpl)
  }
  return out
}

export const CsvImportDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.csvImport.open)
  const close = useUiStore((s) => s.closeCsvImport)
  const addCustomTemplates = useProjectStore((s) => s.addCustomTemplates)
  const [text, setText] = useState('')

  const parsed = useMemo(() => parseCsv(text), [text])
  const map = useMemo(() => mapHeader(parsed[0] ?? []), [parsed])
  const templates = useMemo(
    () => buildTemplates(parsed, map, t('csvImport.fallbackCategory', 'Importiert')),
    [parsed, map, t],
  )

  if (!open) return null

  const onFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const doImport = () => {
    addCustomTemplates(templates)
    close()
    setText('')
    void infoDialog(
      t('csvImport.doneTitle', 'CSV importiert'),
      {
        body: format(t('csvImport.doneBody', '{n} Gerät(e) als Library-Templates hinzugefügt (bestehende Namen unverändert).'), {
          n: templates.length,
        }),
        tone: 'success',
      },
    )
  }

  const mappedFields = (Object.keys(ALIASES) as FieldKey[]).filter((k) => map[k] != null)

  return (
    <ModalShell
      open={open}
      onClose={close}
      maxWidth="3xl"
      titleIcon={<Icon icon={FileUp} size="md" />}
      title={t('csvImport.title', 'Equipment aus CSV importieren')}
    >
      <div className="space-y-3 p-1 text-cp-base">
        <p className="text-cp-xs text-[var(--cp-text-muted)]">
          {t(
            'csvImport.intro',
            'CSV einfügen oder Datei wählen. Erste Zeile = Spaltenüberschriften. Erkannte Spalten: Name, Kategorie, Leistung (W), Gewicht (kg), Seriennummer, IP, HE, Untertitel/Hersteller. Import legt Library-Templates an (kein Überschreiben).',
          )}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded bg-[var(--cp-surface-2)] px-2 py-1 text-cp-xs hover:bg-[var(--cp-surface-3)]">
          <Icon icon={FileUp} size="xs" /> {t('csvImport.pickFile', 'CSV-Datei wählen…')}
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={t('csvImport.placeholder', 'Name;Kategorie;Leistung;Gewicht;Seriennummer\nATEM Mini;Mischer;30;1.1;SN123')}
          className="w-full rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] p-2 font-mono text-cp-xs"
        />
        {parsed.length > 1 && (
          <>
            <div className="text-cp-xs text-[var(--cp-text-faint)]">
              {format(t('csvImport.detected', 'Erkannt: {rows} Zeile(n), zugeordnete Spalten: {fields}'), {
                rows: templates.length,
                fields: mappedFields.join(', ') || '—',
              })}
            </div>
            <div className="max-h-48 overflow-auto rounded border border-[var(--cp-border-muted)]">
              <table className="w-full text-cp-xs">
                <thead className="sticky top-0 bg-[var(--cp-surface-2)] text-left text-[var(--cp-text-muted)]">
                  <tr>
                    <th className="px-2 py-1">{t('csvImport.col.name', 'Name')}</th>
                    <th className="px-2 py-1">{t('csvImport.col.category', 'Kategorie')}</th>
                    <th className="px-2 py-1 text-right">W</th>
                    <th className="px-2 py-1 text-right">kg</th>
                    <th className="px-2 py-1">HE</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.slice(0, 50).map((tpl, i) => (
                    <tr key={`${tpl.name}-${i}`} className="border-t border-[var(--cp-border-muted)]">
                      <td className="px-2 py-0.5">{tpl.name}</td>
                      <td className="px-2 py-0.5">{tpl.category}</td>
                      <td className="px-2 py-0.5 text-right">{tpl.powerConsumptionWatts ?? ''}</td>
                      <td className="px-2 py-0.5 text-right">{tpl.weightKg ?? ''}</td>
                      <td className="px-2 py-0.5">{tpl.rackUnits ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={close}>
            {t('common.cancel', 'Abbrechen')}
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={doImport}
            disabled={templates.length === 0}
          >
            {format(t('csvImport.importBtn', '{n} importieren'), { n: templates.length })}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
