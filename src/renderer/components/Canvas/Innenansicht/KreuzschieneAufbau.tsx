// #1240 Stufe 2 — Innenansicht einer Kreuzschiene: Matrix je Ebene,
// Sperren und Salvos. Eine eigene Ansicht, nicht die des Mischers.
//
// Die Video-Ebene ist dieselbe Tabelle, die Videohub-Export, Salvo-Blatt und
// Signalweg lesen (`videohubRouting.planned`); die Salvos sind die schon
// vorhandenen `videohubRouting.salvos`. Ohne Profil zeigt die Ansicht die
// Anschluesse des Geraets — gesperrt wird nichts.
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '../../../store/projectStore'
import { format, useTranslation } from '../../../lib/i18n'
import { promptDialog } from '../../../lib/promptDialog'
import {
  VIDEO_LEVEL,
  isBreakaway,
  routerMatrixOf,
  routerPatch,
  setCrosspoint,
  take,
  type SwitchingProfile,
} from '../../../lib/switching'
import type { EquipmentItem } from '../../../types/equipment'
import { detectDeviceKind } from '../../../lib/deviceKind'
import { EmulatorSchalter } from './EmulatorSchalter'

export const KreuzschieneAufbau = ({
  device,
  profile,
}: {
  device: EquipmentItem
  profile: SwitchingProfile | null
}) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const [ebene, setEbene] = useState<string>(VIDEO_LEVEL)
  const [vormerken, setVormerken] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const levels = profile?.levels?.length ? profile.levels : [{ id: VIDEO_LEVEL, label: 'Video' }]
  const inputs = device.inputs.slice(0, profile?.blocks.inputs ?? device.inputs.length)
  const outputs = device.outputs.slice(0, profile?.outputs ?? device.outputs.length)
  const m = routerMatrixOf(device)
  const table = m.levels[ebene] ?? {}
  const pending = m.pending[ebene] ?? {}
  const sperren = profile?.features?.locks !== false

  const schalte = (dest: string, source: string | undefined) => {
    const r = setCrosspoint(m, profile, {
      dest,
      source,
      level: levels.length > 1 ? ebene : 'all',
      preset: vormerken,
    })
    if (r.refused) {
      setMeldung(
        r.refused === 'locked'
          ? t('switching.router.locked', 'This output is locked.')
          : t('switching.router.protected', 'This output is protected.'),
      )
      return
    }
    setMeldung(null)
    updateEquipment(device.id, routerPatch(device, r.state))
  }

  const salvos = device.videohubRouting?.salvos ?? []
  const salvoSpeichern = async () => {
    const name = await promptDialog(t('switching.router.salvoName', 'Salvo name:'), '')
    if (!name?.trim()) return
    const planned = routerPatch(device, m).videohubRouting?.planned ?? {}
    updateEquipment(device.id, {
      videohubRouting: {
        planned,
        salvos: [
          ...salvos,
          {
            id: uuidv4(),
            name: name.trim(),
            routing: { ...planned },
            createdAt: new Date().toISOString(),
          },
        ],
      },
    })
  }
  const salvoAusloesen = (routing: Record<number, number>) => {
    let s = m
    for (const [o, i] of Object.entries(routing)) {
      const out = device.outputs[Number(o)]
      const inp = device.inputs[i]
      if (!out || !inp) continue
      s = setCrosspoint(s, profile, {
        dest: out.id,
        source: inp.id,
        level: VIDEO_LEVEL,
        preset: vormerken,
      }).state
    }
    updateEquipment(device.id, routerPatch(device, s))
  }

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-auto p-3" data-testid="kreuzschiene-matrix">
        {!profile && (
          <p
            className="mb-2 rounded-cp-card border border-cp-border bg-cp-surface-2 p-2 text-cp-xs text-cp-text-secondary"
            data-testid="innenansicht-leer"
          >
            {t(
              'switching.router.noProfile',
              'There is no profile for this router in the catalogue yet. The matrix shows the device’s ports; nothing is locked.',
            )}
          </p>
        )}
        <table className="border-collapse text-cp-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-10 bg-cp-surface-1 px-2 text-left">
                {t('switching.router.output', 'Output')}
              </th>
              {sperren && <th className="sticky top-0 bg-cp-surface-1 px-1">{t('switching.router.lock', 'Lock')}</th>}
              {inputs.map((p, i) => (
                <th
                  key={p.id}
                  className="sticky top-0 bg-cp-surface-1 px-0.5 font-normal text-cp-text-muted"
                  title={p.name}
                >
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outputs.map((o) => {
              const src = table[o.id]
              const lock = m.locks[o.id]
              return (
                <tr key={o.id}>
                  <th className="sticky left-0 whitespace-nowrap bg-cp-surface-1 px-2 text-left font-normal" title={o.name}>
                    {o.name}
                    {isBreakaway(m, o.id) && (
                      <span className="ml-1 text-cp-warn">{t('switching.router.breakaway', 'breakaway')}</span>
                    )}
                  </th>
                  {sperren && (
                    <td className="px-1 text-center">
                      <input
                        type="checkbox"
                        checked={!!lock}
                        aria-label={format(t('switching.router.lockOutput', 'Lock {name}'), { name: o.name })}
                        onChange={() => {
                          const locks = { ...m.locks }
                          if (lock) delete locks[o.id]
                          else locks[o.id] = 'lock'
                          updateEquipment(device.id, routerPatch(device, { ...m, locks }))
                        }}
                      />
                    </td>
                  )}
                  {inputs.map((p) => {
                    const an = src === p.id
                    const vor = pending[o.id] === p.id
                    return (
                      <td key={p.id} className="p-0">
                        <button
                          type="button"
                          onClick={() => schalte(o.id, an ? undefined : p.id)}
                          title={`${p.name} → ${o.name}`}
                          aria-pressed={an}
                          className={`m-px block h-4 w-4 rounded-cp-s border ${
                            an
                              ? 'border-cp-accent bg-cp-accent'
                              : vor
                                ? 'border-cp-warn bg-cp-accent-soft'
                                : 'border-cp-border bg-cp-surface-2 hover:bg-cp-surface-3'
                          }`}
                        />
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <aside className="w-64 shrink-0 space-y-4 overflow-y-auto border-l border-cp-border bg-cp-surface-1 p-3 text-cp-xs">
        {profile && (
          <p className="text-cp-text-muted">
            {format(t('switching.router.size', '{in} × {out}, {levels} level(s).'), {
              in: inputs.length,
              out: outputs.length,
              levels: levels.length,
            })}{' '}
            <a href={profile.manufacturerUrl} target="_blank" rel="noreferrer" className="text-cp-accent underline">
              {t('switching.profile.source', 'Source')}
            </a>
          </p>
        )}
        {levels.length > 1 && (
          <label className="flex items-center gap-2">
            <span>{t('switching.router.level', 'Level')}</span>
            <select
              value={ebene}
              onChange={(e) => setEbene(e.target.value)}
              className="border border-cp-border bg-cp-surface-2 px-1 py-0.5"
            >
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <section>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={vormerken} onChange={(e) => setVormerken(e.target.checked)} />
            {t('switching.router.preset', 'Preset, then take')}
          </label>
          {vormerken && (
            <button
              type="button"
              onClick={() => updateEquipment(device.id, routerPatch(device, take(m).state))}
              className="mt-1 rounded-cp-control bg-cp-accent px-3 py-1 text-white"
            >
              {t('switching.router.take', 'Take')}
            </button>
          )}
          {meldung && <p className="mt-1 text-cp-warn">{meldung}</p>}
        </section>
        <section>
          <h3 className="mb-1 font-medium text-cp-text">{t('switching.router.salvos', 'Salvos')}</h3>
          <ul className="space-y-1">
            {salvos.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <button
                  type="button"
                  onClick={() => salvoAusloesen(s.routing)}
                  className="rounded-cp-s px-1.5 py-0.5 text-cp-accent hover:bg-cp-surface-3"
                >
                  {t('switching.router.fire', 'Fire')}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void salvoSpeichern()}
            className="mt-1 rounded-cp-s px-1.5 py-0.5 text-cp-accent hover:bg-cp-surface-3"
          >
            {t('switching.router.saveSalvo', 'Save current routing as salvo…')}
          </button>
        </section>
        {(profile?.idScheme === 'videohub' || detectDeviceKind(device) === 'videohub') && (
          <EmulatorSchalter device={device} kind="videohub" />
        )}
      </aside>
    </div>
  )
}
