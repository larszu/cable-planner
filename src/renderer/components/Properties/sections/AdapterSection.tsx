import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem, ConnectorType } from '../../../types/equipment'
import { ALL_CONNECTOR_TYPES } from '../../../types/equipment'
import { ALL_SIGNAL_STANDARDS, type SignalStandard } from '../../../types/cableSpec'
import {
  ADAPTER_RICHTUNGEN,
  ADAPTER_RICHTUNG_HINWEIS,
  ADAPTER_RICHTUNG_LABEL,
  ADAPTER_SPEISUNGEN,
  ADAPTER_SPEISUNG_HINWEIS,
  ADAPTER_SPEISUNG_LABEL,
  adapterBezeichnung,
  type AdapterRichtung,
  type AdapterSpec,
  type AdapterSpeisung,
} from '../../../types/adapter'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'

/**
 * Die Angaben eines Adapters (B-46).
 *
 * WARUM DIESE SEKTION EXISTIERT. Ein Adapter ist keine Kleinigkeit, die man
 * nebenbei ins Notizfeld schreibt: er liegt IM Signalweg, er steht auf der
 * Packliste, und in einem Fall entscheidet er darüber, ob überhaupt ein Bild
 * ankommt. Genau diese Angaben kann keine Heuristik aus dem Gerätenamen
 * holen — deshalb werden sie hier eingetragen und nicht geraten (ADR-002).
 *
 * WAS HIER NICHT PASSIERT: Vorbelegen aus den Steckertypen. Aus „USB-C auf
 * DisplayPort" folgt NICHT, dass der Adapter einweg ist, und aus „HDMI auf
 * HDMI" nicht, dass er 2.1 durchlässt — beides hängt am Bauteil. Eine
 * geratene Vorbelegung sähe hier aus wie eine Angabe des Nutzers, und der
 * Plan-Check zeigte darauf einen grünen Haken.
 */
export const AdapterSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const spec = equipment.adapter

  const setze = (teil: Partial<AdapterSpec>) => {
    if (!spec) return
    updateEquipment(equipment.id, { adapter: { ...spec, ...teil } })
  }

  const summary = spec
    ? adapterBezeichnung(spec)
    : t('adapter.none', 'not an adapter')

  return (
    <SortableSection id="adapter" title={t('adapter.title', 'Adapter')} subtitle={summary}>
      <label className="flex items-center gap-2 text-cp-xs">
        <input
          type="checkbox"
          checked={!!spec}
          onChange={(e) =>
            updateEquipment(equipment.id, {
              adapter: e.target.checked
                ? {
                    // Die beiden Steckerseiten sind Pflicht, also müssen sie
                    // einen Anfangswert haben. Sie stehen bewusst BEIDE auf
                    // demselben Wert: „HDMI auf HDMI" ist offensichtlich noch
                    // nicht ausgefüllt. Zwei verschiedene Vorgaben sähen aus
                    // wie eine Angabe.
                    von: 'HDMI',
                    nach: 'HDMI',
                    richtung: 'unbekannt',
                    speisung: 'unbekannt',
                  }
                : undefined,
            })
          }
        />
        <span className="text-cp-text-secondary">
          {t('adapter.isAdapter', 'This device is an adapter')}
        </span>
      </label>

      {!spec ? (
        <PanelHint
          className="mt-2 text-cp-xs text-cp-text-muted"
          text={t(
            'adapter.noneHint',
            'An adapter belongs in the plan as a device of its own — otherwise it is neither in the signal path nor on the pick list, and it is missing on the build day.',
          )}
        />
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block text-cp-xs">
              <span className="mb-1 block text-cp-text-muted">
                {t('adapter.von', 'Side facing the source')}
              </span>
              <select
                className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
                value={spec.von}
                onChange={(e) => setze({ von: e.target.value as ConnectorType })}
              >
                {ALL_CONNECTOR_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-cp-xs">
              <span className="mb-1 block text-cp-text-muted">
                {t('adapter.nach', 'Side facing the sink')}
              </span>
              <select
                className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
                value={spec.nach}
                onChange={(e) => setze({ nach: e.target.value as ConnectorType })}
              >
                {ALL_CONNECTOR_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block text-cp-xs">
            <span className="mb-1 block text-cp-text-muted">
              {t('adapter.richtung', 'Direction')}
            </span>
            <select
              className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
              value={spec.richtung}
              onChange={(e) => setze({ richtung: e.target.value as AdapterRichtung })}
            >
              {ADAPTER_RICHTUNGEN.map((r) => (
                <option key={r} value={r}>
                  {ADAPTER_RICHTUNG_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <PanelHint
            className="mt-1 text-cp-xs text-cp-text-muted"
            text={ADAPTER_RICHTUNG_HINWEIS[spec.richtung]}
          />

          <label className="mt-3 block text-cp-xs">
            <span className="mb-1 block text-cp-text-muted">
              {t('adapter.speisung', 'Power')}
            </span>
            <select
              className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
              value={spec.speisung}
              onChange={(e) => setze({ speisung: e.target.value as AdapterSpeisung })}
            >
              {ADAPTER_SPEISUNGEN.map((s) => (
                <option key={s} value={s}>
                  {ADAPTER_SPEISUNG_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <PanelHint
            className="mt-1 text-cp-xs text-cp-text-muted"
            text={ADAPTER_SPEISUNG_HINWEIS[spec.speisung]}
          />

          <label className="mt-3 block text-cp-xs">
            <span className="mb-1 block text-cp-text-muted">
              {t('adapter.grenze', 'Passes at most')}
            </span>
            <select
              className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
              value={spec.hoechsterStandard ?? ''}
              onChange={(e) =>
                setze({
                  hoechsterStandard: e.target.value
                    ? (e.target.value as SignalStandard)
                    : undefined,
                })
              }
            >
              <option value="">{t('adapter.grenzeNone', 'not declared')}</option>
              {ALL_SIGNAL_STANDARDS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <PanelHint
            className="mt-1 text-cp-xs text-cp-text-muted"
            text={t(
              'adapter.grenzeHint',
              'Two HDMI adapters that look alike can be 1.4 and 2.1. Without the entry the plan does not check the ceiling — but it does not claim it holds, either.',
            )}
          />

          <label className="mt-3 block text-cp-xs">
            <span className="mb-1 block text-cp-text-muted">
              {t('adapter.setztVoraus', 'Requires at the source')}
            </span>
            <input
              type="text"
              className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
              value={spec.setztVoraus ?? ''}
              placeholder={t('adapter.setztVorausPlaceholder', 'e.g. DisplayPort Alternate Mode')}
              onChange={(e) => setze({ setztVoraus: e.target.value || undefined })}
            />
          </label>
          <PanelHint
            className="mt-1 text-cp-xs text-cp-text-muted"
            text={t(
              'adapter.setztVorausHint',
              'If something is entered here, the source device must list it under "Can" — otherwise the plan check says "open" instead of "fits". Two USB-C sockets look the same; only one carries a picture.',
            )}
          />

          <label className="mt-3 block text-cp-xs">
            <span className="mb-1 block text-cp-text-muted">{t('adapter.notiz', 'Note')}</span>
            <input
              type="text"
              className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
              value={spec.notiz ?? ''}
              onChange={(e) => setze({ notiz: e.target.value || undefined })}
            />
          </label>
        </>
      )}

      <label className="mt-4 block text-cp-xs">
        <span className="mb-1 block text-cp-text-muted">
          {t('adapter.kann', 'Can (declared capabilities of this device)')}
        </span>
        <input
          type="text"
          className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-text"
          value={(equipment.kann ?? []).join(', ')}
          placeholder={t('adapter.kannPlaceholder', 'DisplayPort Alternate Mode, USB-PD')}
          onChange={(e) => {
            const liste = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
            updateEquipment(equipment.id, { kann: liste.length ? liste : undefined })
          }}
        />
      </label>
      <PanelHint
        className="mt-1 text-cp-xs text-cp-text-muted"
        text={t(
          'adapter.kannHint',
          'Empty means "not declared", not "cannot". The plan says exactly that, instead of putting a green tick on a path that stays black.',
        )}
      />
    </SortableSection>
  )
}
