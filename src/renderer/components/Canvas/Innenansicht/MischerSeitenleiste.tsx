// #1240 Stufe 2 — Seitenleiste der Mischer-Innenansicht: Profil und
// Betriebsart, fehlende Bausteine ergaenzen, Media-Pool mit PNGs.
//
// Bilder laedt man mit „Bild laden…“ oder per Drag & Drop (`Standbild.tsx`).
// Sie liegen im Projekt und gehen damit auch im Browser. Vorhandene
// Bild-Anhaenge (Ordner „Anhaenge“) bleiben waehlbar.
import { useProjectStore } from '../../../store/projectStore'
import { format, useTranslation } from '../../../lib/i18n'
import {
  effectiveCounts,
  innerPathsFrom,
  limitNotes,
  pathBlocks,
  routePatch,
  setMediaSlot,
  stillRef,
  type InnerMatrix,
  type SwitchingBlockCountKey,
  type SwitchingProfile,
} from '../../../lib/switching'
import type { EquipmentItem } from '../../../types/equipment'
import type { ProjektAnhang } from '../../../types/anhang'
import { blockLabel } from './labels'
import { BildAblage, BildLadenKnopf, StillName, StillVorschau } from './Standbild'
import { useStandbildLaden } from './useStandbild'
import { AtemSetupDatei } from './AtemSetupDatei'

const ERGAENZBAR: SwitchingBlockCountKey[] = [
  'inputs',
  'mixEffects',
  'upstreamKeyersPerMe',
  'downstreamKeyers',
  'superSources',
  'superSourceBoxes',
  'mediaPlayers',
  'stills',
  'colorGenerators',
  'aux',
  'multiviewers',
]

const COUNT_EN: Record<SwitchingBlockCountKey, string> = {
  inputs: 'Inputs',
  mixEffects: 'M/Es',
  subMixEffects: 'Sub-M/Es (MiniME, MELite)',
  upstreamKeyers: 'Upstream keyers',
  upstreamKeyersPerMe: 'Keyers per M/E',
  downstreamKeyers: 'Downstream keyers',
  superSources: 'SuperSources',
  superSourceBoxes: 'Boxes per SuperSource',
  mediaPlayers: 'Media players',
  stills: 'Stills in the media pool',
  clips: 'Clips in the media pool',
  colorGenerators: 'Colour generators',
  aux: 'Aux outputs',
  multiviewers: 'Multiviewers',
  dves: 'DVEs',
  macros: 'Macros',
}

const istBild = (a: ProjektAnhang) =>
  /^image\/(png|jpeg|gif|bmp|tiff)$/.test(a.datei.mediaType) || /\.png$/i.test(a.datei.fileName)

export const MischerSeitenleiste = ({
  device,
  profile,
  matrix,
  auswahl,
}: {
  device: EquipmentItem
  profile: SwitchingProfile | null
  matrix: InnerMatrix
  auswahl: string | null
}) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const anhaenge = useProjectStore((s) => s.project.anhaenge) ?? []
  const { inPlatz, leeren, fehler } = useStandbildLaden(device.id)
  const state = device.switching
  const counts = effectiveCounts(profile, state)
  const bilder = anhaenge.filter(istBild)
  const notes = limitNotes(profile, matrix, state)
  const fehlend = ERGAENZBAR.filter((k) => profile?.blocks[k] === undefined)

  const setBlocks = (k: SwitchingBlockCountKey, v: number | undefined) => {
    const blocks = { ...(state?.blocks ?? {}) }
    if (v === undefined || !Number.isFinite(v)) delete blocks[k]
    else blocks[k] = Math.max(0, Math.min(100, Math.floor(v)))
    updateEquipment(device.id, { switching: { ...(state ?? {}), blocks } })
  }

  const gewaehlt = auswahl ? matrix.byId.get(auswahl) : undefined
  const wege = gewaehlt?.source ? innerPathsFrom(device, matrix, state, gewaehlt.id) : []
  const endText = (e: string) =>
    ({
      output: t('switching.path.output', 'reaches an output'),
      preview: t('switching.path.preview', 'only on a preview bus'),
      'off-air': t('switching.path.offAir', 'keyer not on air'),
      unused: t('switching.path.unused', 'not routed anywhere'),
      loop: t('switching.path.loop', 'runs in a loop'),
    })[e] ?? e

  return (
    <aside className="w-72 shrink-0 space-y-4 overflow-y-auto border-l border-cp-border bg-cp-surface-1 p-3 text-cp-xs">
      <AtemSetupDatei device={device} profile={profile} />
      <section>
        {profile ? (
          <p className="text-cp-text-muted">
            {t('switching.profile.from', 'Blocks and limits from the manufacturer’s datasheet.')}{' '}
            <a href={profile.manufacturerUrl} target="_blank" rel="noreferrer" className="text-cp-accent underline">
              {t('switching.profile.source', 'Source')}
            </a>
          </p>
        ) : (
          <p
            className="rounded-cp-card border border-cp-border bg-cp-surface-2 p-2 text-cp-text-secondary"
            data-testid="innenansicht-leer"
          >
            {t(
              'switching.empty.hint',
              'There is no profile for this device in the catalogue yet. Add the blocks it has below; nothing is locked.',
            )}
          </p>
        )}
        {profile?.modes && (
          <label className="mt-2 flex items-center gap-2">
            <span>{t('switching.mode', 'Operating mode')}</span>
            <select
              value={state?.mode ?? ''}
              onChange={(e) =>
                updateEquipment(device.id, {
                  switching: {
                    ...(state ?? {}),
                    mode: e.target.value || undefined,
                  },
                })
              }
              className="border border-cp-border bg-cp-surface-2 px-1 py-0.5"
            >
              <option value="">{t('switching.mode.none', 'not set')}</option>
              {profile.modes.map((m) => (
                <option key={m.id} value={m.id}>
                  {t(`switching.mode.${m.id}`, m.label)}
                </option>
              ))}
            </select>
          </label>
        )}
        {notes.map((n) => (
          <p key={n.key} className="mt-1 text-cp-warn">
            {format(
              t('switching.limit.note', 'In this mode the device has only {limit} × {what}; the plan uses {used}.'),
              {
                limit: n.limit,
                used: n.used,
                what: t(`switching.count.${n.key}`, COUNT_EN[n.key]),
              },
            )}
          </p>
        ))}
      </section>

      {fehlend.length > 0 && (
        <section>
          <h3 className="mb-1 font-medium text-cp-text">
            {profile
              ? t('switching.missing.title', 'Not in the datasheet — add if needed')
              : t('switching.blocks.title', 'Blocks')}
          </h3>
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
            {fehlend.map((k) => (
              <label key={k} className="contents">
                <span>{t(`switching.count.${k}`, COUNT_EN[k])}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={state?.blocks?.[k] ?? ''}
                  onChange={(e) => setBlocks(k, e.target.value === '' ? undefined : Number(e.target.value))}
                  className="w-16 border border-cp-border bg-cp-surface-2 px-1 py-0.5"
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {(counts.mediaPlayers ?? 0) > 0 && (
        <section>
          <h3 className="mb-1 font-medium text-cp-text">{t('switching.media.players', 'Media players')}</h3>
          {Array.from({ length: counts.mediaPlayers ?? 0 }, (_, i) => i + 1).map((mp) => (
            <label key={mp} className="mb-1 flex items-center gap-2">
              <span className="w-28 shrink-0 whitespace-nowrap">
                {format(t('switching.block.mediaPlayer', 'Media player {n}'), {
                  n: mp,
                })}
              </span>
              <select
                value={state?.routes?.[`mp:${mp}/still`] ?? ''}
                onChange={(e) =>
                  updateEquipment(device.id, routePatch(device, matrix, `mp:${mp}/still`, e.target.value || undefined))
                }
                className="min-w-0 flex-1 border border-cp-border bg-cp-surface-2 px-1 py-0.5"
                aria-label={format(t('switching.block.mediaPlayer', 'Media player {n}'), { n: mp })}
              >
                <option value="">{t('switching.media.none', '— none —')}</option>
                {Array.from({ length: counts.stills ?? 0 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={`still:${s}`}>
                    {format(t('switching.media.still', 'Still {n}'), { n: s })}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
      )}

      {(counts.stills ?? 0) > 0 && (
        <section>
          <h3 className="mb-1 font-medium text-cp-text">{t('switching.media.pool', 'Media pool')}</h3>
          <p className="mb-1 text-cp-text-muted">
            {t('switching.media.dropHint', 'Load a PNG or drop it onto a slot. PNG transparency is kept for keys.')}
          </p>
          {fehler && <p className="mb-1 text-cp-danger">{fehler}</p>}
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {Array.from({ length: counts.stills ?? 0 }, (_, i) => i + 1).map((slot) => {
              const ref = stillRef(state, slot)
              const a = ref?.fotoId ? undefined : anhaenge.find((x) => x.id === ref?.anhangId)
              return (
                <li key={slot} data-slot={slot}>
                  <BildAblage
                    onFile={(f) => void inPlatz(slot, f)}
                    className="flex items-center gap-1.5 rounded-cp-s p-0.5"
                    testId={`pool-platz-${slot}`}
                  >
                    <span className="w-16 shrink-0 whitespace-nowrap text-cp-text-muted">
                      {format(t('switching.media.still', 'Still {n}'), { n: slot })}
                    </span>
                    <StillVorschau refState={ref} />
                    {!ref && <span className="text-cp-text-faint">{t('switching.media.empty', 'empty')}</span>}
                    {ref?.fotoId && <StillName refState={ref} />}
                    {bilder.length > 0 && !ref?.fotoId && (
                      <select
                        value={a?.id ?? ''}
                        onChange={(e) =>
                          updateEquipment(device.id, {
                            switching: setMediaSlot(state, slot, e.target.value || undefined),
                          })
                        }
                        className="min-w-0 flex-1 border border-cp-border bg-cp-surface-2 px-1 py-0.5"
                        aria-label={format(t('switching.media.attachmentFor', 'Attachment for still {n}'), { n: slot })}
                      >
                        <option value="">{t('switching.media.attachmentNone', 'no attachment')}</option>
                        {bilder.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.titel || b.datei.fileName}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="ml-auto flex shrink-0 items-center">
                      <BildLadenKnopf onFile={(f) => void inPlatz(slot, f)} ersetzen={!!ref} testId={`pool-laden-${slot}`} />
                      {ref && (
                        <button
                          type="button"
                          onClick={() => leeren(slot)}
                          className="rounded-cp-s px-1.5 py-0.5 text-cp-danger hover:bg-cp-surface-3"
                          title={t('switching.media.remove', 'Remove image')}
                          aria-label={t('switching.media.remove', 'Remove image')}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  </BildAblage>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {gewaehlt && (
        <section>
          <h3 className="mb-1 font-medium text-cp-text">{blockLabel(gewaehlt, t)}</h3>
          {wege.length === 0 && (
            <p className="text-cp-text-muted">{t('switching.path.selectSource', 'Select a source to see its path.')}</p>
          )}
          <ul className="space-y-1">
            {wege.map((w, i) => (
              <li key={i} className="text-cp-text-secondary">
                {pathBlocks(w)
                  .map((id) => {
                    const b = matrix.byId.get(id)
                    return b ? blockLabel(b, t) : id
                  })
                  .join(' › ') || blockLabel(gewaehlt, t)}
                {' — '}
                <span className={w.end === 'output' ? 'text-cp-ok' : 'text-cp-text-muted'}>{endText(w.end)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
