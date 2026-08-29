import { useMemo, useState } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useTranslation, format } from '../../../lib/i18n'
import { SortableSection } from '../SortableSection'
import {
  UMD_ADDRESS_MAX,
  UMD_ADDRESS_MIN,
  parseUmdAddress,
  umdAddressClashes,
} from '../../../lib/sourceIdentity'
import type { EquipmentItem } from '../../../types/equipment'

const NEW_ROLE = '__new__'

/**
 * ADR-001, Inkrement 2 — Signalquellen-Rolle eines Geraets.
 *
 * Die Rolle („Kamera 1") traegt die Anker, die keine Runtime besitzt: heute
 * die TSL-UMD-Adresse. Sie liegt bewusst NEBEN dem Geraet, nicht in ihm — ein
 * Haupt-/Backup-Paar ist EINE Rolle mit zwei Geraeten, und das Tally gehoert
 * der Rolle. Deshalb zeigt die Sektion auch, welche anderen Geraete dieselbe
 * Rolle tragen: Wer hier bindet, soll sehen, dass er nicht der Einzige ist.
 *
 * Nicht hier hin gehoert alles, was ein Geraet selbst weiss — ATEM-Source-Id,
 * Videohub-Slot, MV-Fenster. Das loest `lib/labelDerivation.ts` aus dem
 * Kabelgraph auf; es zusaetzlich zu speichern waere die zweite Wahrheit.
 */
export const SourceIdentitySection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const identities = useProjectStore((s) => s.project.sourceIdentities)
  const allEquipment = useProjectStore((s) => s.project.equipment)
  const addSourceIdentity = useProjectStore((s) => s.addSourceIdentity)
  const updateSourceIdentity = useProjectStore((s) => s.updateSourceIdentity)
  const removeSourceIdentity = useProjectStore((s) => s.removeSourceIdentity)
  const bindEquipment = useProjectStore((s) => s.bindEquipmentToSourceIdentity)

  const list = useMemo(() => identities ?? [], [identities])
  const bound = list.find((s) => s.id === equipment.sourceIdentityId)

  const siblings = useMemo(
    () =>
      bound
        ? allEquipment.filter((e) => e.sourceIdentityId === bound.id && e.id !== equipment.id)
        : [],
    [allEquipment, bound, equipment.id],
  )

  // Kollision NICHT nur fuer diese Rolle berechnen: eine Adresse kollidiert
  // per Definition mit einer anderen Rolle, und die will man beim Tippen
  // sofort sehen — nicht erst im Plan-Check.
  const clashPartners = useMemo(() => {
    if (!bound || bound.umdAddress === undefined) return []
    const clash = umdAddressClashes(list).find((c) => c.address === bound.umdAddress)
    return clash ? clash.identities.filter((i) => i.id !== bound.id) : []
  }, [bound, list])

  // Der Adress-Entwurf bleibt beim Tippen stehen, auch wenn er (noch) nicht
  // gueltig ist. Ohne ihn verschluckt das Feld den dritten Anschlag von
  // „999": der Wert waere unparsebar, der Store bliebe leer, und React
  // zeichnete das Feld leer neu. Der Entwurf traegt die Rollen-Id mit, damit
  // er beim Wechsel auf ein anderes Geraet nicht mitwandert.
  const [umdDraft, setUmdDraft] = useState<{ id: string; text: string } | null>(null)
  const umdText =
    bound && umdDraft?.id === bound.id
      ? umdDraft.text
      : bound?.umdAddress !== undefined
        ? String(bound.umdAddress)
        : ''
  const umdRejected =
    umdText.trim() !== '' && parseUmdAddress(umdText.trim()) === undefined

  const onPickRole = (value: string) => {
    if (value === '') {
      bindEquipment(equipment.id, undefined)
      return
    }
    if (value === NEW_ROLE) {
      const id = addSourceIdentity({ name: equipment.name })
      if (id) bindEquipment(equipment.id, id)
      return
    }
    bindEquipment(equipment.id, value)
  }

  return (
    <SortableSection
      id="source-identity"
      title={t('sourceIdentity.title', 'Signalquelle (Rolle)')}
      subtitle={
        bound
          ? bound.umdAddress !== undefined
            ? `${bound.name} · UMD ${bound.umdAddress}`
            : bound.name
          : t('sourceIdentity.unbound', 'nicht zugewiesen')
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-cp-text-muted">
          {t(
            'sourceIdentity.hint',
            'Die Rolle überlebt den Gerätetausch: „Kamera 1" bleibt „Kamera 1", auch wenn die Havarie-Kamera einspringt. An ihr hängt die Tally-/UMD-Adresse.',
          )}
        </p>

        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">
            {t('sourceIdentity.role', 'Rolle')}
          </span>
          <select
            value={equipment.sourceIdentityId ?? ''}
            onChange={(event) => onPickRole(event.target.value)}
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
          >
            <option value="">{t('sourceIdentity.none', '— keine —')}</option>
            {list.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW_ROLE}>
              {t('sourceIdentity.create', 'Neue Rolle aus Gerätename anlegen…')}
            </option>
          </select>
        </label>

        {bound && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">
                  {t('sourceIdentity.name', 'Redaktioneller Name')}
                </span>
                <input
                  value={bound.name}
                  onChange={(event) =>
                    updateSourceIdentity(bound.id, { name: event.target.value })
                  }
                  placeholder="Kamera 1"
                  className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">
                  {t('sourceIdentity.number', 'Nummer')}
                </span>
                <input
                  type="number"
                  min={0}
                  value={bound.number ?? ''}
                  onChange={(event) => {
                    const raw = event.target.value.trim()
                    const value = raw === '' ? undefined : Number(raw)
                    updateSourceIdentity(bound.id, {
                      number:
                        value !== undefined && Number.isInteger(value) && value >= 0
                          ? value
                          : undefined,
                    })
                  }}
                  className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-cp-text-secondary">
                {format(
                  t('sourceIdentity.umd', 'TSL-UMD-Adresse ({min}–{max})'),
                  { min: UMD_ADDRESS_MIN, max: UMD_ADDRESS_MAX },
                )}
              </span>
              <input
                type="number"
                min={UMD_ADDRESS_MIN}
                max={UMD_ADDRESS_MAX}
                value={umdText}
                onChange={(event) => {
                  const raw = event.target.value
                  setUmdDraft({ id: bound.id, text: raw })
                  const trimmed = raw.trim()
                  if (trimmed === '') {
                    updateSourceIdentity(bound.id, { umdAddress: undefined })
                    return
                  }
                  const parsed = parseUmdAddress(trimmed)
                  // Ungueltiges NICHT uebernehmen: eine halb gueltige Adresse
                  // sieht im Plan aus wie eine Zusage und bleibt es nicht.
                  if (parsed !== undefined) updateSourceIdentity(bound.id, { umdAddress: parsed })
                }}
                onBlur={() => setUmdDraft(null)}
                placeholder={t('sourceIdentity.umdPlaceholder', 'z. B. 1')}
                className={`w-full rounded border bg-cp-surface-1 p-2 font-mono ${
                  umdRejected ? 'border-cp-warn' : 'border-cp-border'
                }`}
              />
            </label>

            {umdRejected && (
              <p className="text-cp-warn">
                {format(
                  t(
                    'sourceIdentity.umdRejected',
                    'Nicht übernommen: TSL UMD v3.1 kennt nur ganze Adressen von {min} bis {max}.',
                  ),
                  { min: UMD_ADDRESS_MIN, max: UMD_ADDRESS_MAX },
                )}
              </p>
            )}

            {clashPartners.length > 0 && (
              <p className="rounded border border-cp-danger/60 bg-cp-danger/10 px-2 py-1.5 text-cp-danger">
                {format(
                  t(
                    'sourceIdentity.umdClash',
                    'Adresse {address} ist schon vergeben an {names} — beide Displays zeigen denselben Text.',
                  ),
                  {
                    address: bound.umdAddress ?? '',
                    names: clashPartners.map((i) => i.name).join(', '),
                  },
                )}
              </p>
            )}

            {siblings.length > 0 && (
              <p className="text-cp-text-muted">
                {format(
                  t(
                    'sourceIdentity.siblings',
                    'Dieselbe Rolle tragen außerdem: {names}. Das ist gewollt bei Haupt-/Backup-Paaren.',
                  ),
                  { names: siblings.map((e) => e.name).join(', ') },
                )}
              </p>
            )}

            <button
              type="button"
              onClick={() => removeSourceIdentity(bound.id)}
              className="self-start rounded border border-cp-border px-2 py-1 text-cp-text-secondary hover:bg-cp-surface-3"
            >
              {t('sourceIdentity.remove', 'Rolle löschen (löst alle Bindungen)')}
            </button>
          </>
        )}
      </div>
    </SortableSection>
  )
}
