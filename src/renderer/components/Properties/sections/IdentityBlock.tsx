import { useState } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { effectiveShortName, generateShortName } from '../../../lib/shortName'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — IdentityBlock: Name + Kurzname + Untertitel — was ein Mensch vor dem
 * Rack zuerst liest. Darunter folgen im Panel FEST die Anschluesse (#957), erst
 * dann die Notiz und der Rest.
 *
 * DER KURZNAME IST EINE ZEILE, KEIN FELD (#956). Er wird fast immer aus dem
 * Namen erzeugt (`lib/shortName`) und nur selten von Hand gesetzt. Ein
 * Eingabefeld mit Knopf und Hinweistext nahm dafuer drei Zeilen ein — mehr
 * als der Name selbst. Jetzt steht der wirksame Wert als Zeile unter dem
 * Namen; der Stift daneben oeffnet das Feld, und erst dann erscheinen Eingabe
 * und „auto"-Knopf.
 *
 * Der Katalog-Typ (ADR-002) stand bis 2026-09-28 hier ganz oben und sah ohne
 * Wert aus wie ein fehlendes Pflichtfeld. Er wird jetzt automatisch vergeben
 * (lib/deviceTypeMatch) und liegt in `CatalogueSection`.
 */
export const IdentityBlock = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const autoSuggestion = generateShortName(equipment.name)
  const wirksam = effectiveShortName(equipment)
  const manuell = !!equipment.shortName?.trim()
  const [kurznameOffen, setKurznameOffen] = useState(false)

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">{t('eq.field.name', 'Name')}</span>
        <input
          value={equipment.name}
          onChange={(event) => updateEquipment(equipment.id, { name: event.target.value })}
          className="w-full border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>

      {kurznameOffen ? (
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('eq.field.shortName', 'Short name')}{' '}
            <span className="text-cp-text-faint">
              ({t('eq.field.shortNameHint', 'for port/endpoint labels — e.g. "ATEM8K" instead of "ATEM Constellation 8K"')})
            </span>
          </span>
          <div className="flex gap-1">
            <input
              autoFocus
              value={equipment.shortName ?? ''}
              placeholder={autoSuggestion || t('eq.field.shortNamePlaceholder', 'Short form…')}
              onChange={(event) =>
                updateEquipment(equipment.id, { shortName: event.target.value || undefined })
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') setKurznameOffen(false)
              }}
              onBlur={() => setKurznameOffen(false)}
              className="min-w-0 flex-1 border border-cp-border bg-cp-surface-1 p-2 font-mono"
            />
            <button
              type="button"
              // Vor dem Blur greifen: sonst schliesst das Feld, bevor der
              // Klick ankommt.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => updateEquipment(equipment.id, { shortName: undefined })}
              disabled={!manuell}
              title={t('eq.field.shortNameAuto', 'Regenerate from name')}
              className="inline-flex shrink-0 items-center gap-1 border border-cp-border bg-cp-surface-2 px-2 text-cp-xs text-cp-text-bright hover:bg-cp-surface-4 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon icon={RotateCcw} size="xs" />
              {t('eq.field.shortNameAutoBtn', 'auto')}
            </button>
          </div>
        </label>
      ) : (
        <div className="flex items-center gap-2 px-1 text-cp-xs">
          <span className="text-cp-text-secondary">{t('eq.field.shortName', 'Short name')}</span>
          <span className="font-mono text-cp-text">{wirksam || '—'}</span>
          {!manuell && wirksam && (
            <span className="text-cp-text-faint">{t('eq.field.shortNameAutoBadge', 'auto')}</span>
          )}
          <button
            type="button"
            onClick={() => setKurznameOffen(true)}
            aria-label={t('eq.field.shortNameEdit', 'Edit short name')}
            title={t('eq.field.shortNameEdit', 'Edit short name')}
            className="ml-auto inline-flex h-6 w-6 items-center justify-center text-cp-text-muted hover:bg-cp-surface-4/40 hover:text-cp-text-bright"
          >
            <Icon icon={Pencil} size="xs" />
          </button>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">
          {t('eq.field.subtitle', 'Subtitle')}{' '}
          <span className="text-cp-text-faint">
            ({t('common.optional', 'optional')}, {t('eq.field.subtitleHint', 'optional, e.g. "PGM monitor"')})
          </span>
        </span>
        <input
          value={equipment.subtitle ?? ''}
          placeholder={t('eq.field.subtitlePlaceholder', 'Subtitle…')}
          onChange={(event) => updateEquipment(equipment.id, { subtitle: event.target.value || undefined })}
          className="w-full border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>
    </>
  )
}

/**
 * DIE NOTIZ — das einzige freie Textfeld am Geraet. Sie stand bis 2026-09-28
 * im Abschnitt „Netzzugang" unter dem Passwort, dann kurz zwischen Name und
 * Kurzname. Seit #957 liegen die Anschluesse direkt unter dem Untertitel, und
 * die Notiz folgt ihnen: sie ist Freitext fuer alles, was in kein Feld passt,
 * und nicht Teil der Identitaet.
 */
export const NotesBlock = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  return (
    <label className="block">
      <span className="mb-1 block text-cp-text-secondary">
        {t('eq.field.notes', 'Note')}{' '}
        <span className="text-cp-text-faint">({t('common.optional', 'optional')})</span>
      </span>
      <textarea
        value={equipment.notes ?? ''}
        onChange={(event) => updateEquipment(equipment.id, { notes: event.target.value })}
        rows={2}
        placeholder={t(
          'eq.field.notesPlaceholder',
          'Anything with no field of its own — web UI, firmware, where it sits, who it belongs to…',
        )}
        className="w-full border border-cp-border bg-cp-surface-1 p-2"
      />
    </label>
  )
}
