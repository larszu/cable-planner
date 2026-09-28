import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from '../../lib/i18n'
import { useUiStore } from '../../store/uiStore'

/**
 * #306 — SortableSection-Wrapper aus EquipmentProperties ausgelagert.
 * Wird vom Hauptcontainer innerhalb eines SortableContext mit `id` aus
 * equipmentSectionOrder gemountet.
 *
 * ─── ISSUE #903: „Rechte Seitenleiste zu unuebersichtlich" (2026-09-24) ─────
 *
 * Achtundzwanzig Abschnitte, alle gleich aussehend, alle zugeklappt, und
 * nichts davon gemerkt. Zwei Dinge fehlten, und beide sitzen HIER statt in
 * achtundzwanzig Aufrufen:
 *
 *  1. DER OFFEN-ZUSTAND LEBTE NUR IM DOM. `open={defaultOpen}` und kein
 *     `onToggle`: wer einen Abschnitt aufklappte, verlor ihn beim naechsten
 *     Neu-Montieren, und beim Geraetewechsel war die Leiste wieder eine Wand
 *     aus zugeklappten Zeilen — auch der Abschnitt, in dem man gerade
 *     gearbeitet hatte. Jetzt steht er im UI-Store und ueberlebt beides.
 *
 *  2. ES GAB KEINEN WEG, EINEN ABSCHNITT ZU FINDEN. Der Filter liegt im Store
 *     und wird hier gelesen, nicht durchgereicht: sonst haetten alle
 *     achtundzwanzig Aufrufstellen eine Eigenschaft mehr, und die
 *     neunundzwanzigste haette sie vergessen.
 *
 * WARUM DER FILTER AUF ID, TITEL UND UNTERTITEL SUCHT. Der Titel ist der Text,
 * den der Nutzer sieht („DMX", „Anschluesse"); die Id ist der Begriff, den er
 * aus der Doku kennt (`network-config`); der Untertitel traegt die
 * Zusammenfassung, in der oft genau das steht, wonach er sucht („3 in / 2 out").
 * Ein Filter, der nur den Titel kennt, findet ein Geraet mit DMX nicht ueber
 * seine Kanalzahl.
 *
 * Ein Abschnitt, den der Filter TRIFFT, klappt auf — sonst fuehrt eine
 * erfolgreiche Suche zu einer Liste von Kopfzeilen, die man noch einmal
 * einzeln anklicken muss.
 */

/** Was vom Titel oder Untertitel als durchsuchbarer Text uebrigbleibt.
 *  Ein ReactNode kann alles sein; gesucht wird in dem, was Text IST. */
const textVon = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textVon).join(' ')
  // Ein Element: sein `children` ist der Text, den man liest.
  const props = (node as { props?: { children?: ReactNode } }).props
  return props?.children !== undefined ? textVon(props.children) : ''
}

export const SortableSection = ({
  id,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  id: string
  title: ReactNode
  subtitle?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) => {
  const t = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, index } =
    useSortable({ id })
  const gemerkt = useUiStore((s) => s.equipmentSectionOpen[id])
  const setOffen = useUiStore((s) => s.setEquipmentSectionOpen)
  const filter = useUiStore((s) => s.propsFilter)

  const suche = filter.trim().toLowerCase()
  const treffer =
    suche.length > 0 &&
    `${id} ${textVon(title)} ${textVon(subtitle)}`.toLowerCase().includes(suche)

  // Der Filter blendet aus, statt auszugrauen: eine Leiste, in der die Haelfte
  // grau danebensteht, ist nicht uebersichtlicher als eine ungefilterte.
  if (suche.length > 0 && !treffer) return null

  // Ein Treffer steht offen. Sonst gilt das Gemerkte, und ohne Merkung die
  // Vorgabe des Abschnitts — `undefined` heisst „nie angefasst", nicht „zu".
  const offen = treffer ? true : (gemerkt ?? defaultOpen)

  return (
    <details
      ref={setNodeRef}
      open={offen}
      onToggle={(event) => {
        const nun = (event.currentTarget as HTMLDetailsElement).open
        if (nun !== offen) setOffen(id, nun)
      }}
      className={` border border-cp-border bg-cp-surface-1/40 [&_summary]:cursor-pointer ${
        isDragging ? 'opacity-60' : ''
      }`}
      style={{
        order: index < 0 ? 999 : index,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <summary className="flex items-center gap-2 px-2 py-1.5 text-cp-xs uppercase tracking-wide text-cp-text-muted hover:text-cp-text-bright">
        {/* #421 — Drag-Handle deutlicher: groesseres ⠿-Glyph, hellere Farbe,
            breitere Klickflaeche; sichtbar auf jeder Sektion damit klar ist,
            dass die Reihenfolge per Drag&Drop am Handle aenderbar ist. */}
        <span
          {...attributes}
          {...listeners}
          title={t('props.section.dragTitle', 'Drag section to change order (persists across devices).')}
          className="-my-1 inline-flex h-5 w-5 cursor-grab items-center justify-center text-cp-lg leading-none text-cp-text-muted hover:bg-cp-surface-4/40 hover:text-cp-text-bright active:cursor-grabbing"
          aria-label={t('props.section.dragAria', 'Move section')}
          role="button"
          onClick={(e) => e.preventDefault()}
        >
          ⠿
        </span>
        <span className="flex-1">{title}</span>
        {subtitle && (
          <span className="normal-case text-cp-xs text-cp-text-muted">{subtitle}</span>
        )}
      </summary>
      <div className="border-t border-cp-border-muted p-2">{children}</div>
    </details>
  )
}
