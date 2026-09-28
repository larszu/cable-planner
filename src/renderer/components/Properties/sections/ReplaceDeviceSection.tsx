import { X, Check} from 'lucide-react'
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
import { resolvePortLabel } from '../../../lib/portLabel'
import { Icon } from '../../shared/Icon'

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
/** Wie viele Vorlagen die Liste hoechstens zeigt. Die Zahl der TREFFER steht
 *  daneben, damit aus dem Abschneiden keine falsche Vollstaendigkeit wird. */
const LISTEN_GRENZE = 40

const previewMapping = (
  oldPorts: Port[],
  newPorts: Port[],
): { mapped: number; lost: number } => {
  const used = new Set<number>()
  let mapped = 0
  // ADR-001 Inkrement 2 — dieselbe Engstelle wie im equipmentSlice, damit
  // Vorschau und Ausfuehrung denselben Key sehen. Vorher trimmten beide erst
  // NACH dem Fallback und wichen damit gleich zweimal vom Resolver ab.
  const oldKey = (p: Port) => resolvePortLabel(p).text.toLowerCase()
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

  /**
   * #878 — DIE ZAHL DER TREFFER GEHOERT DAZU, SEIT DIE BIBLIOTHEK GROSS IST.
   *
   * Die Liste zeigt 40 Eintraege und hat das immer getan. Bei 469 Vorlagen war
   * das eine Bequemlichkeit; bei 1802 (Uebernahme aus multicam- und
   * light-planner, 2026-09-24) ist es eine Falle: wer „Sony" sucht, sieht
   * vierzig von Hunderten und haelt das fuer alles, was es gibt. Also wird die
   * Gesamtzahl mitgezaehlt und angezeigt — dann weiss man, dass man den Filter
   * noch verengen muss.
   */
  const { filtered, treffer } = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const alle = allTemplates
      .filter((tpl) => tpl.name !== equipment.libraryRef?.name) // skip same template
      .filter((tpl) => (categoryFilter ? tpl.category === categoryFilter : true))
      .filter((tpl) => {
        if (!q) return true
        return (
          tpl.name.toLowerCase().includes(q) ||
          (tpl.category ?? '').toLowerCase().includes(q)
        )
      })
    return { filtered: alle.slice(0, LISTEN_GRENZE), treffer: alle.length }
  }, [allTemplates, filter, categoryFilter, equipment.libraryRef?.name])

  const connectedCables = cables.filter(
    (c) => c.fromEquipmentId === equipment.id || c.toEquipmentId === equipment.id,
  ).length

  const handlePick = async (template: EquipmentTemplate) => {
    const inPrev = previewMapping(equipment.inputs, template.inputs)
    const outPrev = previewMapping(equipment.outputs, template.outputs)
    const lost = inPrev.lost + outPrev.lost
    /**
     * #878 — „0 Anschluesse zugeordnet" heisst ZWEIERLEI, und der Dialog sagte
     * nur das eine.
     *
     * Seit der Katalog-Uebernahme (2026-09-24) fuehrt die Bibliothek 1333
     * Vorlagen mit `portsUnknown: true`: Kamerabodies, Objektive und Rigs,
     * deren Buchsen niemand nachgesehen hat. Tauscht man ein verkabeltes Geraet
     * gegen so eine Vorlage, stand da „0 Eingaenge zugeordnet, N Kabel werden
     * geloescht" — und das liest sich, als HAETTE das Zielgeraet keine
     * Anschluesse. Das ist die Verwechslung, gegen die `portsUnknown`
     * ueberhaupt erfunden wurde (`docs/device-identity-concept.md`).
     *
     * Der Satz steht im Dialog, nicht im Katalog: die Vorlage ist in Ordnung,
     * nur die Folge dieses Tauschs ist eine andere als sie aussieht.
     */
    const zielPortsUnbekannt =
      template.portsUnknown === true &&
      template.inputs.length === 0 &&
      template.outputs.length === 0
    const body =
      format(
        t(
          'replaceDevice.confirm.body',
          'Currently {connected} cable connection(s). When replacing:',
        ),
        { connected: connectedCables },
      ) +
      (zielPortsUnbekannt
        ? `\n\u26a0 ${t(
            'replaceDevice.confirm.portsUnknown',
            'The ports of the target device are NOT known \u2014 nobody has looked them up in a datasheet yet. This is not the same as „has no sockets\u201c: every cable would lose its port. Add the real ports to the template first, then swap.',
          )}`
        : '') +
      `\n• ${format(t('replaceDevice.confirm.inMapped', '{n} input port(s) mapped'), { n: inPrev.mapped })}` +
      `\n• ${format(t('replaceDevice.confirm.outMapped', '{n} output port(s) mapped'), { n: outPrev.mapped })}` +
      (lost > 0
        ? `\n⚠ ${format(t('replaceDevice.confirm.lost', '{n} cable(s) lose their port and will be deleted'), { n: lost })}`
        : '')
    const ok = await confirmDialog(
      format(
        t('replaceDevice.confirm.title', 'Replace {from} with {to}?'),
        { from: equipment.name, to: template.name },
      ),
      {
        body,
        okLabel: t('replaceDevice.confirm.ok', 'Replace'),
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
      title={t('replaceDevice.title', 'Replace device')}
      subtitle={t('replaceDevice.subtitle', 'Preserve cabling')}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full bg-sky-700 px-2 py-1 text-cp-xs text-white hover:bg-sky-600"
          title={t(
            'replaceDevice.btnTitle',
            'Swap the current device for another library template — ports are mapped by connector type + label, cables are preserved where possible.',
          )}
        >
          ↔ {t('replaceDevice.btn', 'Choose another device…')}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('replaceDevice.searchPlaceholder', 'Search (name, category, manufacturer)…')}
              aria-label={t('replaceDevice.searchPlaceholder', 'Search (name, category, manufacturer)…')}
              className="flex-1 border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              <Icon icon={X} size="xs" />
            </button>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full border border-cp-border bg-cp-surface-3 p-1.5 text-cp-xs"
          >
            <option value="">{t('replaceDevice.allCategories', '— All categories —')}</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {/* #878 — bei 1802 Vorlagen ist „40 gezeigt" ohne die Gesamtzahl eine
              falsche Vollstaendigkeit. */}
          {treffer > filtered.length && (
            <p className="text-cp-xs text-cp-text-muted">
              {format(
                t('replaceDevice.truncated', '{gezeigt} of {treffer} matches \u2014 narrow the filter to see the rest'),
                { gezeigt: filtered.length, treffer },
              )}
            </p>
          )}
          <div className="max-h-56 overflow-auto border border-cp-border-muted">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-center text-cp-xs text-cp-text-muted">
                {t('replaceDevice.noMatches', 'No matches.')}
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
                          <span className="block text-cp-xs text-cp-text-muted">
                            {categoryDisplay(tpl.category ?? '', lang, categoryTranslations)} ·{' '}
                            {/* „0 in / 0 out" und „Ports unbekannt" sind
                                verschiedene Auskuenfte; als dieselbe Zahl sahen
                                sie gleich aus. */}
                            {tpl.portsUnknown && tpl.inputs.length === 0 && tpl.outputs.length === 0
                              ? t('replaceDevice.portsUnknownShort', 'ports unknown')
                              : `${tpl.inputs.length} in / ${tpl.outputs.length} out`}
                          </span>
                        </span>
                        {lost > 0 ? (
                          <span
                            className="bg-amber-900/60 px-1.5 py-0.5 text-cp-xs font-bold text-amber-200"
                            title={format(t('replaceDevice.lostBadgeTitle', '{n} connection(s) would be lost'), { n: lost })}
                          >
                            -{lost}
                          </span>
                        ) : (
                          <span className="bg-emerald-900/60 px-1.5 py-0.5 text-cp-xs font-bold text-emerald-200">
                            <Icon icon={Check} size="xs" />
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
