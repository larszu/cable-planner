import { useState, type ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { ProvenanceBadge } from '../../shared/ProvenanceBadge'
import { detectDeviceKind } from '../../../lib/deviceKind'
import { portProvenanceUpdate } from '../../../lib/portProvenance'
import { useTranslation } from '../../../lib/i18n'
import { SortableSection } from '../SortableSection'
import { PortList } from '../PortList'
import { PortAiSuggestButton } from './PortAiSuggestButton'
import type { EquipmentItem } from '../../../types/equipment'

const SENSOR_ZEIGER = { activationConstraint: { distance: 6 } } as const
const SENSOR_TASTATUR = { coordinateGetter: sortableKeyboardCoordinates } as const

/**
 * Eine der beiden Listen (Inputs / Outputs) als ziehbares `<details>`.
 *
 * #958 — Die beiden Listen lassen sich gegeneinander verschieben, mit
 * demselben Griff wie die einzelnen Ports darin. Es gibt nur zwei, also ist
 * jede Verschiebung ein TAUSCH — und der Tausch IST `portsFlipped`: dieselbe
 * Eigenschaft, die am Knoten die Seiten dreht. Zwei Zustaende fuer dieselbe
 * Frage („was steht links?") gaebe es sonst.
 */
const PortListe = ({
  id,
  titel,
  anzahl,
  children,
}: {
  id: 'in' | 'out'
  titel: string
  anzahl: number
  children: ReactNode
}) => {
  const t = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <details
      ref={setNodeRef}
      open
      className={`border border-cp-border-muted bg-cp-surface-3/30 ${isDragging ? 'opacity-60' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <summary className="flex cursor-pointer select-none items-center gap-1 px-2 py-1 text-cp-xs font-semibold text-cp-text-secondary hover:text-cp-text">
        <span
          {...attributes}
          {...listeners}
          role="button"
          aria-label={t('ports.listMove', 'Swap inputs and outputs')}
          title={t('ports.listMove', 'Swap inputs and outputs')}
          onClick={(e) => e.preventDefault()}
          className="-my-1 inline-flex h-5 w-5 cursor-grab items-center justify-center text-cp-text-muted hover:text-cp-text-bright active:cursor-grabbing"
        >
          ≡
        </span>
        {titel} <span className="text-cp-text-faint">({anzahl})</span>
      </summary>
      <div className="px-2 pb-2">{children}</div>
    </details>
  )
}

/**
 * #306 — "Inputs & Outputs". Enthaelt PortAiSuggestButton plus zwei
 * <details>-Listen (Inputs / Outputs), die unabhaengig kollabieren koennen
 * (#185). showAtemSourceId triggert die ATEM-spezifische Source-ID-Spalte in
 * PortList.
 *
 * #957 — FEST unter Name, Kurzname und Untertitel (`fest`), kein Griff. Der
 * Abschnitt war bis 2026-09-28 sortierbar und stand per Vorgabe oben; wer den
 * Griff beruehrte, hatte ihn unten. An einem Panel, dessen Zweck die
 * Verkabelung ist, ist „immer oben" keine Vorgabe, sondern eine Eigenschaft.
 */
export const PortsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const deviceKind = detectDeviceKind(equipment)
  const isAtem = deviceKind === 'atem'
  const gespiegelt = !!equipment.portsFlipped
  const setGespiegelt = (wert: boolean) =>
    updateEquipment(equipment.id, { portsFlipped: wert || undefined })
  // #988 — Welche Ports zugeklappt sind, merkt sich die Sektion (nicht der
  // Port): „alle ein-/ausklappen" greift damit auf Inputs UND Outputs.
  const [zu, setZu] = useState<ReadonlySet<string>>(() => new Set())
  const alleIds = [...equipment.inputs, ...equipment.outputs].map((p) => p.id)
  const alleZu = alleIds.length > 0 && alleIds.every((id) => zu.has(id))
  const umschalten = (id: string) =>
    setZu((alt) => {
      const neu = new Set(alt)
      if (!neu.delete(id)) neu.add(id)
      return neu
    })
  const listenSensoren = useSensors(
    useSensor(PointerSensor, SENSOR_ZEIGER),
    useSensor(KeyboardSensor, SENSOR_TASTATUR),
  )
  // Gespiegelt heisst: Outputs links am Knoten — und damit auch zuerst hier.
  const reihenfolge: Array<'in' | 'out'> = gespiegelt ? ['out', 'in'] : ['in', 'out']

  // Ports ändern → sobald reale Anschlüsse existieren, ist das Gerät nicht mehr
  // "unbekannt": den explizit-Unbekannt-Marker (aus dem Import ohne Datenblatt-
  // Match) mit entfernen, damit der Plan-Check-Hinweis verschwindet.
  const applyPorts = (patch: Partial<Pick<EquipmentItem, 'inputs' | 'outputs'>>) => {
    const inputs = patch.inputs ?? equipment.inputs
    const outputs = patch.outputs ?? equipment.outputs
    const clearMarker = equipment.portsUnknown && (inputs.length > 0 || outputs.length > 0)
    // Fasst ein Mensch die Ports an, ist der AI-Beleg ueberholt: die Zahl
    // daneben stammt jetzt von ihm, nicht mehr aus dem Vorschlag. Ihn stehen
    // zu lassen hiesse, die Warnung „Ports geraten" gegen jemanden zu
    // erheben, der sie gerade geprueft hat — und der Beleg wuerde einen Wert
    // behaupten, den er nicht mehr stuetzt.
    //
    // ZWEI EINSCHRAENKUNGEN, beide 2026-09-04 nachgemessen: der Beleg faellt
    // nur JE SEITE und nur bei einer ECHTEN Aenderung. Die Regel und ihre
    // Begruendung stehen in `lib/portProvenance.ts` — dort, wo ein Test sie
    // fahren kann. Vorher lag sie hier im Rumpf einer React-Komponente, und
    // der Guard konnte nur pruefen, dass die Zeichenkette `delete rest.inputs`
    // im Quelltext steht.
    const herkunft = portProvenanceUpdate(equipment, patch)
    updateEquipment(equipment.id, {
      ...patch,
      ...(clearMarker ? { portsUnknown: undefined } : {}),
      ...(herkunft.inputsWeg || herkunft.outputsWeg
        ? { specSource: herkunft.specSource }
        : {}),
    })
  }

  return (
    <SortableSection
      id="ports"
      title={t('portsSection.title', 'Inputs & outputs')}
      subtitle={`${equipment.inputs.length} ${t('portsSection.in', 'In')} · ${equipment.outputs.length} ${t('portsSection.out', 'Out')}`}
      defaultOpen
      fest
    >
      <div className="space-y-2">
        {equipment.portsUnknown && equipment.inputs.length === 0 && equipment.outputs.length === 0 && (
          <div className="border border-cp-warn/40 bg-cp-warn/10 px-2 py-1.5 text-cp-xs text-cp-text-secondary">
            {t(
              'ports.unknown',
              'Port layout unknown (no datasheet match on import). Add the real connectors below — none were fabricated.',
            )}
            {/* ADR-003 Inkrement 2 — derselbe Zustand wie die Rentman-Spalte,
                nur in der anderen Auspraegung: hier steht gar kein Wert, und
                „keine Ports" darf nicht als „das Geraet hat keine" gelesen
                werden. */}
            <ProvenanceBadge provenance="unknown" field="equipment.portsUnknown" />
          </div>
        )}
        {/* #317 — Wenn das Gerät bereits Ports hat (was bei Canvas-
            platzierten Geräten der Normalfall ist), brauchen wir den
            AI-Vorschlag-Button hier nicht. Er bleibt für den
            initialen Drop-Wizard-Flow nutzbar, wo Equipment noch
            keine Ports hat (z.B. aus Rentman ohne Port-Daten). */}
        {equipment.inputs.length === 0 && equipment.outputs.length === 0 && (
          <PortAiSuggestButton equipment={equipment} />
        )}
        {/* #419 — "Ports spiegeln" gehoert thematisch zu In/Outputs (und nicht
            mehr zu "Darstellung & Flags"), weil es die Seiten-Zuordnung der
            Inputs/Outputs am Canvas-Knoten umdreht. */}
        <div className="flex items-center justify-between gap-2 px-1">
          <label
            className="flex min-w-0 items-center gap-2 text-cp-xs text-cp-text-secondary"
            title={t(
              'ports.flipTitle',
              'Inputs render on the right, outputs on the left of the device node.',
            )}
          >
            <input
              type="checkbox"
              checked={gespiegelt}
              onChange={(event) => setGespiegelt(event.target.checked)}
            />
            {t('ports.flip', 'Flip ports (inputs on right, outputs on left)')}
          </label>
          {alleIds.length > 1 && (
            <button
              type="button"
              onClick={() => setZu(alleZu ? new Set() : new Set(alleIds))}
              className="shrink-0 bg-cp-surface-4 px-2 py-0.5 text-cp-xs hover:bg-cp-surface-5"
            >
              {alleZu
                ? t('ports.expandAll', 'Expand all')
                : t('ports.collapseAll', 'Collapse all')}
            </button>
          )}
        </div>
        <DndContext
          sensors={listenSensoren}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) setGespiegelt(!gespiegelt)
          }}
        >
          <SortableContext items={reihenfolge} strategy={verticalListSortingStrategy}>
            {reihenfolge.map((seite) =>
              seite === 'in' ? (
                <PortListe
                  key="in"
                  id="in"
                  titel={t('ports.title.inputs', 'Inputs')}
                  anzahl={equipment.inputs.length}
                >
                  <PortList
                    title={t('ports.title.inputs', 'Inputs')}
                    ports={equipment.inputs}
                    onChange={(inputs) => applyPorts({ inputs })}
                    hideTitle
                    showAtemSourceId={isAtem}
                    collapsed={zu}
                    onToggleCollapsed={umschalten}
                  />
                </PortListe>
              ) : (
                <PortListe
                  key="out"
                  id="out"
                  titel={t('ports.title.outputs', 'Outputs')}
                  anzahl={equipment.outputs.length}
                >
                  <PortList
                    title={t('ports.title.outputs', 'Outputs')}
                    ports={equipment.outputs}
                    onChange={(outputs) => applyPorts({ outputs })}
                    hideTitle
                    showAtemSourceId={isAtem}
                    collapsed={zu}
                    onToggleCollapsed={umschalten}
                  />
                </PortListe>
              ),
            )}
          </SortableContext>
        </DndContext>
      </div>
    </SortableSection>
  )
}
