import { useState, useMemo } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useUiStore } from '../../../store/uiStore'
import { confirmDialog } from '../../../lib/confirmDialog'
import { format, useTranslation } from '../../../lib/i18n'
import {
  buildCategoryOptions,
  categoryDisplay,
} from '../../../lib/categoryTranslations'
import { blackmagicTemplates } from '../../../lib/blackmagicCatalog'
import { SortableSection } from '../SortableSection'
import type { EquipmentItem, EquipmentTemplate, Port } from '../../../types/equipment'

/**
 * #314 — "Gerät ersetzen…" — tauscht das aktuell ausgewaehlte Equipment
 * gegen ein anderes Library-Template aus, ohne die Verkabelung zu
 * verlieren. Port-Mapping nach (connectorType, contentLabel/name) plus
 * positionaler Fallback in der Slice (replaceEquipmentWithTemplate).
 *
 * UI-Flow:
 *  1. Section "Gerät ersetzen" mit einem Toggle-Button
 *  2. Klick zeigt eine kompakte Liste der Library-Templates inkl.
 *     Kategorie-Filter + Search
 *  3. Auswahl oeffnet einen Bestaetigungs-Dialog mit Port-Summary
 *     (X gemappt / Y verworfen)
 *  4. Nach Confirm wird die Slice-Action gerufen
 */
const previewMapping = (
  oldPorts: Port[],
  newPorts: Port[],
): { mapped: number; lost: number } => {
  const used = new Set<number>()
  let mapped = 0
  const oldKey = (p: Port) => (p.contentLabel || p.name || '').trim().toLowerCase()
  for (const op of oldPorts) {
    const ok = oldKey(op)
    const idx = newPorts.findIndex(
      (np, i) =>
        !used.has(i) &&
        np.connectorType === op.connectorType &&
        ok &&
        oldKey(np) === ok,
    )
    if (idx >= 0) {
      used.add(idx)
      mapped += 1
    }
  }
  for (const op of oldPorts) {
    const idx = newPorts.findIndex(
      (np, i) => !used.has(i) && np.connectorType === op.connectorType,
    )
    if (idx >= 0) {
      used.add(idx)
      mapped += 1
    }
  }
  return { mapped, lost: oldPorts.length - mapped }
}

export const ReplaceDeviceSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const cables = useProjectStore((s) => s.project.cables)
  const replaceEquipmentWithTemplate = useProjectStore(
    (s) => s.replaceEquipmentWithTemplate,
  )
  const categoryTranslations = useProjectStore((s) => s.categoryTranslations)
  const lang = useUiStore((s) => s.language)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')

  // Library = custom + built-in. Aktuelles Geraet ausblenden um
  // self-replace zu vermeiden.
  const allTemplates: EquipmentTemplate[] = useMemo(
    () => [...customLibrary, ...blackmagicTemplates],
    [customLibrary],
  )

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const t of allTemplates) {
      if (t.category) set.add(t.category)
    }
    return buildCategoryOptions(Array.from(set), lang, categoryTranslations)
  }, [allTemplates, lang, categoryTranslations])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return allTemplates
      .filter((tpl) => tpl.name !== equipment.libraryRef?.name) // skip same template
      .filter((tpl) => (categoryFilter ? tpl.category === categoryFilter : true))
      .filter((tpl) => {
        if (!q) return true
        return (
          tpl.name.toLowerCase().includes(q) ||
          (tpl.category ?? '').toLowerCase().includes(q)
        )
      })
      .slice(0, 40)
  }, [allTemplates, filter, categoryFilter, equipment.libraryRef?.name])

  const connectedCables = cables.filter(
    (c) => c.fromEquipmentId === equipment.id || c.toEquipmentId === equipment.id,
  ).length

  const handlePick = async (template: EquipmentTemplate) => {
    const inPrev = previewMapping(equipment.inputs, template.inputs)
    const outPrev = previewMapping(equipment.outputs, template.outputs)
    const lost = inPrev.lost + outPrev.lost
    const body =
      format(
        t(
          'replaceDevice.confirm.body',
          'Aktuell {connected} verkabelte Verbindung(en). Beim Ersetzen werden:',
        ),
        { connected: connectedCables },
      ) +
      `\n• ${format(t('replaceDevice.confirm.inMapped', '{n} Eingang-Port(s) gemappt'), { n: inPrev.mapped })}` +
      `\n• ${format(t('replaceDevice.confirm.outMapped', '{n} Ausgang-Port(s) gemappt'), { n: outPrev.mapped })}` +
      (lost > 0
        ? `\n⚠ ${format(t('replaceDevice.confirm.lost', '{n} Kabel verlieren ihren Port und werden gelöscht'), { n: lost })}`
        : '')
    const ok = await confirmDialog(
      format(
        t('replaceDevice.confirm.title', '{from} ersetzen durch {to}?'),
        { from: equipment.name, to: template.name },
      ),
      {
        body,
        okLabel: t('replaceDevice.confirm.ok', 'Ersetzen'),
        destructive: lost > 0,
      },
    )
    if (!ok) return
    replaceEquipmentWithTemplate(equipment.id, template)
    setOpen(false)
  }

  return (
    <SortableSection
      id="replace-device"
      title={t('replaceDevice.title', 'Gerät ersetzen')}
      subtitle={t('replaceDevice.subtitle', 'Verkabelung erhalten')}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded bg-sky-700 px-2 py-1 text-cp-xs text-white hover:bg-sky-600"
          title={t(
            'replaceDevice.btnTitle',
            'Aktuelles Gerät durch ein anderes Library-Template tauschen — Ports werden anhand Connector-Typ + Label gemappt, Kabel bleiben (wo möglich) erhalten.',
          )}
        >
          ↔ {t('replaceDevice.btn', 'Anderes Gerät wählen…')}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('replaceDevice.searchPlaceholder', 'Suchen (Name, Kategorie, Hersteller)…')}
              aria-label={t('replaceDevice.searchPlaceholder', 'Suchen (Name, Kategorie, Hersteller)…')}
              className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded bg-cp-surface-4 px-2 py-1 text-[11px] hover:bg-cp-surface-5"
            >
              ✕
            </button>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
          >
            <option value="">{t('replaceDevice.allCategories', '— Alle Kategorien —')}</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <div className="max-h-56 overflow-auto rounded border border-cp-border-muted">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-center text-[11px] text-cp-text-muted">
                {t('replaceDevice.noMatches', 'Keine Treffer.')}
              </div>
            ) : (
              <ul>
                {filtered.map((tpl) => {
                  const inPrev = previewMapping(equipment.inputs, tpl.inputs)
                  const outPrev = previewMapping(equipment.outputs, tpl.outputs)
                  const lost = inPrev.lost + outPrev.lost
                  return (
                    <li key={tpl.name}>
                      <button
                        type="button"
                        onClick={() => void handlePick(tpl)}
                        className="flex w-full items-start justify-between gap-2 border-b border-cp-border-muted px-2 py-1.5 text-left hover:bg-cp-surface-2/60"
                      >
                        <span>
                          <span className="block text-cp-xs font-medium text-cp-text">
                            {tpl.name}
                          </span>
                          <span className="block text-[10px] text-cp-text-muted">
                            {categoryDisplay(tpl.category ?? '', lang, categoryTranslations)} · {tpl.inputs.length} in / {tpl.outputs.length} out
                          </span>
                        </span>
                        {lost > 0 ? (
                          <span
                            className="rounded bg-amber-900/60 px-1.5 py-0.5 text-[11px] font-bold text-amber-200"
                            title={format(t('replaceDevice.lostBadgeTitle', '{n} Verbindung(en) würden verloren gehen'), { n: lost })}
                          >
                            -{lost}
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[11px] font-bold text-emerald-200">
                            ✓
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </SortableSection>
  )
}
