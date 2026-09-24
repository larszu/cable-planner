import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'

/**
 * ISSUE #903 — „Rechte Seitenleiste zu unuebersichtlich."
 *
 * Die Eigenschaften-Leiste eines Geraets fuehrt achtundzwanzig Abschnitte. Sie
 * ALLE zu zeigen ist richtig — welcher gebraucht wird, weiss nur der Nutzer,
 * und ein Abschnitt, den man nicht findet, ist so gut wie nicht da. Was fehlte,
 * war der Weg zu genau einem davon.
 *
 * DREI SCHALTER, UND KEINER MEHR:
 *
 *   Suchfeld     tippt man „dmx", bleibt der DMX-Abschnitt stehen und klappt
 *                auf. Gesucht wird in Titel, Untertitel UND Abschnitts-Id
 *                (siehe `SortableSection`) — der Untertitel traegt die
 *                Zusammenfassung, und oft steht genau dort, wonach man sucht.
 *   Alle zu      der Weg zurueck zum Ueberblick, ohne achtundzwanzig Klicks.
 *   Alle auf     der Weg zum Durchlesen, ohne achtundzwanzig Klicks.
 *
 * WAS ES BEWUSST NICHT GIBT: eine Vorauswahl „wichtiger" Abschnitte. Welche
 * wichtig sind, haengt am Geraet und am Gewerk — eine Kamera braucht die
 * Netzkonfiguration, ein Stativ nie. Die Leiste raet das nicht; die Abschnitte,
 * die es an diesem Geraet nicht gibt, blenden sich schon heute selbst aus, und
 * die Reihenfolge kann jeder ziehen, wie er arbeitet.
 *
 * Steht das Feld AUSSERHALB des `fieldset`, und das ist Absicht: die Leiste ist
 * im Betrachter- und im abgeschlossenen Projekt gesperrt, gesucht werden darf
 * darin trotzdem. Lesen ist keine Aenderung.
 */
export const SectionFilterBar = () => {
  const t = useTranslation()
  const filter = useUiStore((s) => s.propsFilter)
  const setFilter = useUiStore((s) => s.setPropsFilter)
  const alle = useUiStore((s) => s.setAllEquipmentSectionsOpen)

  const knopf = 'border border-cp-border px-1.5 py-0.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-3 hover:text-cp-text'

  return (
    <div className="mb-2 flex items-center gap-1">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={t('props.filter.placeholder', 'Filter sections …')}
        aria-label={t('props.filter.aria', 'Filter sections')}
        className="min-w-0 flex-1 border border-cp-border bg-cp-surface-2 px-2 py-0.5 text-cp-xs text-cp-text"
      />
      {filter.length > 0 && (
        <button
          type="button"
          onClick={() => setFilter('')}
          className={knopf}
          aria-label={t('props.filter.clear', 'Clear filter')}
          title={t('props.filter.clear', 'Clear filter')}
        >
          ×
        </button>
      )}
      <button
        type="button"
        onClick={() => alle(false)}
        className={knopf}
        title={t('props.filter.collapseAll', 'Collapse all sections')}
      >
        {t('props.filter.collapse', 'All shut')}
      </button>
      <button
        type="button"
        onClick={() => alle(true)}
        className={knopf}
        title={t('props.filter.expandAll', 'Expand all sections')}
      >
        {t('props.filter.expand', 'All open')}
      </button>
    </div>
  )
}
