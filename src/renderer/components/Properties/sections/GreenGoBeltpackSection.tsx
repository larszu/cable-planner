import { useState } from 'react'
import { useGreenGoBeltpack } from '../../../lib/greengoSync'
import { format, useTranslation } from '../../../lib/i18n'

/**
 * #306 — GreenGo-Beltpack-Konfiguration pro Equipment. Aus
 * EquipmentProperties ausgelagert. Rendert eine kompakte Card im
 * Properties-Panel mit Name + User-Slot-Zuordnung + Gruppen-Chips.
 */
export const GreenGoBeltpackSection = ({ equipmentId }: { equipmentId: string }) => {
  const t = useTranslation()
  const { config, info, rename, assignUser } = useGreenGoBeltpack(equipmentId)
  // Ein-/ausklappbar (wie die übrigen Properties-Blöcke). Default offen, wenn
  // diesem Gerät ein Beltpack-Slot zugeordnet ist, sonst eingeklappt. <summary>
  // statt Form-Control, damit das Toggle auch im gesperrten Fieldset geht.
  // WICHTIG: useState MUSS vor dem `return` stehen (Rules of Hooks) — sonst
  // aendert sich die Hook-Anzahl wenn beim Geraetewechsel `config` von leer
  // zu gesetzt wechselt ("Rendered more hooks than during the previous render").
  const [open, setOpen] = useState(!!info)
  if (!config || config.users.length === 0) {
    return (
      <div className="mb-2 text-[10px] text-emerald-300/60">
        {t(
          'props.greengo.noConfig',
          'No GreenGo configuration in the project. Open the Intercom planner or load a preset to define beltpacks.',
        )}
      </div>
    )
  }
  // List of all users for the assignment dropdown. We label them by name
  // and decorate with the linked equipment id if any (so the user can
  // see at a glance which slots are already taken).
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="mb-2 rounded bg-emerald-950/40 [&_summary]:cursor-pointer"
    >
      <summary className="flex items-center gap-1 px-2 py-1.5 text-[10px] uppercase tracking-wide text-emerald-300 hover:text-emerald-200 [&::-webkit-details-marker]:hidden">
        <span className="text-emerald-400/70">{open ? '▾' : '▸'}</span>
        <span className="flex-1">{t('props.greengo.beltpack', 'Beltpack')}</span>
        {info?.channelNames && info.channelNames.length > 0 && (
          <span
            className="font-normal normal-case text-emerald-400/80"
            title={format(t('props.greengo.groupsTitle', 'Groups: {names}'), {
              names: info.channelNames.join(', '),
            })}
          >
            {format(
              info.channelNames.length === 1
                ? t('props.greengo.groupCountOne', '{n} group')
                : t('props.greengo.groupCountMany', '{n} groups'),
              { n: info.channelNames.length },
            )}
          </span>
        )}
      </summary>
      <div className="px-2 pb-2">
      <label className="block">
        <span className="mb-1 block text-emerald-200/70">{t('props.greengo.name', 'Name')}</span>
        <input
          type="text"
          value={info?.station.name ?? ''}
          disabled={!info}
          placeholder={info ? '' : t('props.greengo.assignFirst', 'Assign first ↓')}
          onChange={(event) => rename(event.target.value)}
          className="w-full rounded border border-emerald-700 bg-emerald-950 p-1 text-cp-xs text-emerald-50 disabled:opacity-50"
          title={t(
            'props.greengo.nameTitle',
            'Changes are written immediately to the intercom plan and .gg5 export',
          )}
        />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-emerald-200/70">
          {t('props.greengo.userSlot', 'Assigned user slot')}
        </span>
        <select
          value={info?.number ?? ''}
          onChange={(event) => {
            const v = event.target.value
            assignUser(v === '' ? null : Number(v))
          }}
          className="w-full rounded border border-emerald-700 bg-emerald-950 p-1 text-cp-xs text-emerald-50"
        >
          <option value="">{t('props.greengo.noSlot', '(no slot assigned)')}</option>
          {config.users.map((u) => {
            const takenBy = u.equipmentId && u.equipmentId !== equipmentId
            return (
              <option key={u.id} value={u.id}>
                {u.id}. {u.name}
                {takenBy ? t('props.greengo.assignedOther', ' (assigned to another device)') : ''}
              </option>
            )
          })}
        </select>
      </label>
      {info?.channelNames && info.channelNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {info.channelNames.map((g) => (
            <span
              key={g}
              className="rounded bg-emerald-700/40 px-1.5 py-0.5 text-emerald-100"
              title={t('props.greengo.groupChipTitle', 'Groups are edited in the intercom planner')}
            >
              {g}
            </span>
          ))}
        </div>
      )}
      </div>
    </details>
  )
}
