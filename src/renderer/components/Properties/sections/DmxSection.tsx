import { useProjectStore } from '../../../store/projectStore'
import { format, useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import {
  UNIVERSE_GROESSE,
  fussabdruck,
  geraetBefunde,
  modusVon,
  type DmxModus,
  type ModusHerkunft,
} from '../../../lib/dmx'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'

/**
 * DMX: Betriebsmodus, Universe und Startadresse einer Lampe.
 *
 * ─── WARUM DER MODUS OBEN STEHT UND NICHT DIE ADRESSE ──────────────────────
 *
 * Weil er sie bestimmt. Ein Moving Head belegt je Betriebsart verschieden
 * viele Kanaele; wer die Adresse zuerst setzt und den Modus danach, hat
 * zwischendurch einen Plan, der eine Zahl behauptet, die er nicht kennt.
 * Ohne Modus vergibt die Automatik hier bewusst NICHTS.
 *
 * ─── DIE HERKUNFT IST PFLICHT, UND ZWAR SICHTBAR ───────────────────────────
 *
 * Eine Kanalzahl ist eine Behauptung ueber ein fremdes Geraet. `herkunft`
 * sagt, worauf sie sich stuetzt; `geschaetzt` wird im Plan-Check als solches
 * gemeldet. Dieselbe Regel wie beim Senkenprofil (B-47) und den sechs
 * Katalogen (B-11) — und hier faellt sie besonders ins Gewicht: eine Zahl
 * daneben verschiebt JEDE Folgeadresse im Rig.
 */

const HERKUNFT_REIHE: ModusHerkunft[] = ['handbuch', 'gdtf', 'pult', 'geraet', 'geschaetzt']

export const DmxSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)

  const profil = equipment.dmxProfil
  const modi = profil?.modi ?? []
  const geraet = {
    id: equipment.id,
    name: equipment.name,
    profil,
    modusId: equipment.dmxModusId,
    universe: equipment.dmxUniverse,
    adresse: equipment.dmxAdresse,
    adresseFestgesetzt: equipment.dmxAdresseFestgesetzt,
  }
  const modus = modusVon(geraet)
  const fp = fussabdruck(geraet)
  const befunde = profil ? geraetBefunde(geraet) : []

  const HERKUNFT_LABEL: Record<ModusHerkunft, string> = {
    handbuch: t('dmx.origin.manual', 'Manual'),
    gdtf: t('dmx.origin.gdtf', 'GDTF file'),
    pult: t('dmx.origin.console', 'Console patch'),
    geraet: t('dmx.origin.device', 'Read off the device'),
    geschaetzt: t('dmx.origin.estimated', 'Estimate'),
  }

  const setzeProfil = (modiNeu: DmxModus[]) =>
    updateEquipment(equipment.id, {
      dmxProfil: { hersteller: profil?.hersteller ?? '', modell: profil?.modell ?? equipment.name, modi: modiNeu },
    })

  const modusAendern = (id: string, teil: Partial<DmxModus>) =>
    setzeProfil(modi.map((m) => (m.id === id ? { ...m, ...teil } : m)))

  const summary = !profil
    ? t('dmx.noProfile', 'no DMX')
    : !modus
      ? t('dmx.noMode', 'mode not chosen')
      : format(t('dmx.summary', '{mode} · {ch} ch · {u}.{a}'), {
          mode: modus.name,
          ch: modus.kanaele,
          u: equipment.dmxUniverse ?? '–',
          a: equipment.dmxAdresse ?? '–',
        })

  return (
    <SortableSection id="dmx" title={t('dmx.title', 'DMX')} subtitle={summary}>
      <label className="flex items-center gap-2 text-cp-xs">
        <input
          type="checkbox"
          checked={!!profil}
          onChange={(e) =>
            updateEquipment(equipment.id, {
              dmxProfil: e.target.checked
                ? { hersteller: '', modell: equipment.name, modi: [] }
                : undefined,
              ...(e.target.checked ? {} : { dmxModusId: undefined }),
            })
          }
        />
        <span>{t('dmx.isDmxDevice', 'This device is addressed via DMX')}</span>
      </label>

      {profil && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-cp-xs">
              <span className="text-cp-text-muted">{t('dmx.manufacturer', 'Manufacturer')}</span>
              <input
                value={profil.hersteller}
                onChange={(e) => updateEquipment(equipment.id, { dmxProfil: { ...profil, hersteller: e.target.value } })}
                placeholder="Robe"
                className="mt-0.5 w-full border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
              />
            </label>
            <label className="text-cp-xs">
              <span className="text-cp-text-muted">{t('dmx.model', 'Model')}</span>
              <input
                value={profil.modell}
                onChange={(e) => updateEquipment(equipment.id, { dmxProfil: { ...profil, modell: e.target.value } })}
                placeholder="Robin MegaPointe"
                className="mt-0.5 w-full border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
              />
            </label>
          </div>

          {/* ── Die Modi ───────────────────────────────────────────────────
              Je Zeile Name, Kanalzahl und Herkunft. Die Herkunft steht NEBEN
              der Zahl und nicht in einem Untermenue: wer sie dort verstecken
              muesste, um Platz zu sparen, hat sie faktisch weggelassen. */}
          <div className="border border-cp-border p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-cp-xs font-semibold uppercase tracking-wide text-cp-text-secondary">
                {t('dmx.modes', 'Modes')}
              </span>
              <button
                type="button"
                onClick={() =>
                  setzeProfil([
                    ...modi,
                    {
                      id: `m${modi.length + 1}-${Date.now().toString(36)}`,
                      name: format(t('dmx.modeDefaultName', 'Mode {n}'), { n: modi.length + 1 }),
                      kanaele: 1,
                      herkunft: 'handbuch',
                    },
                  ])
                }
                className="bg-cp-surface-4 px-2 py-0.5 text-cp-xs hover:bg-cp-surface-5"
              >
                {t('dmx.addMode', '+ Mode')}
              </button>
            </div>

            {modi.length === 0 && (
              <PanelHint
                text={t(
                  'dmx.noModesHint',
                  'No mode stated yet, so this device gets no address. Without a mode the footprint is unknown, and a guessed channel count would shift every following address in the rig.',
                )}
              />
            )}

            <ul className="space-y-1">
              {modi.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-1">
                  <input
                    type="radio"
                    name={`dmx-mode-${equipment.id}`}
                    checked={equipment.dmxModusId === m.id}
                    onChange={() => updateEquipment(equipment.id, { dmxModusId: m.id })}
                    title={t('dmx.useThisMode', 'Run this mode')}
                  />
                  <input
                    value={m.name}
                    onChange={(e) => modusAendern(m.id, { name: e.target.value })}
                    className="min-w-24 flex-1 border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    max={UNIVERSE_GROESSE}
                    value={m.kanaele}
                    onChange={(e) => modusAendern(m.id, { kanaele: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                    title={t('dmx.channelCount', 'Channels in this mode')}
                    className="w-16 border border-cp-border bg-cp-surface-3 p-1 text-center text-cp-xs tabular-nums"
                  />
                  <select
                    value={m.herkunft}
                    onChange={(e) => modusAendern(m.id, { herkunft: e.target.value as ModusHerkunft })}
                    title={t('dmx.originTitle', 'Where this channel count comes from')}
                    className="border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                  >
                    {HERKUNFT_REIHE.map((h) => (
                      <option key={h} value={h}>
                        {HERKUNFT_LABEL[h]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setzeProfil(modi.filter((x) => x.id !== m.id))}
                    className="px-1 text-cp-xs text-cp-text-muted hover:text-cp-danger"
                    title={t('dmx.removeMode', 'Remove mode')}
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Adresse ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-3">
            <label className="text-cp-xs">
              <span className="text-cp-text-muted">{t('dmx.universe', 'Universe')}</span>
              <input
                type="number"
                min={1}
                value={equipment.dmxUniverse ?? ''}
                onChange={(e) =>
                  updateEquipment(equipment.id, {
                    dmxUniverse: e.target.value === '' ? undefined : Math.max(1, Math.floor(Number(e.target.value))),
                    dmxAdresseFestgesetzt: true,
                  })
                }
                className="mt-0.5 w-full border border-cp-border bg-cp-surface-3 p-1 text-cp-xs tabular-nums"
              />
            </label>
            <label className="text-cp-xs">
              <span className="text-cp-text-muted">{t('dmx.address', 'Address')}</span>
              <input
                type="number"
                min={1}
                max={UNIVERSE_GROESSE}
                value={equipment.dmxAdresse ?? ''}
                onChange={(e) =>
                  updateEquipment(equipment.id, {
                    dmxAdresse: e.target.value === '' ? undefined : Math.max(1, Math.floor(Number(e.target.value))),
                    // Eine von Hand getippte Adresse ist ab hier seine. Dieselbe
                    // Bauform wie `Port.nameFromUser` (#838).
                    dmxAdresseFestgesetzt: true,
                  })
                }
                className="mt-0.5 w-full border border-cp-border bg-cp-surface-3 p-1 text-cp-xs tabular-nums"
              />
            </label>
            <div className="text-cp-xs text-cp-text-muted">
              {fp === null
                ? t('dmx.footprintUnknown', 'footprint unknown')
                : format(t('dmx.footprintTo', '{ch} ch → {to}'), { ch: fp, to: (equipment.dmxAdresse ?? 1) + fp - 1 })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-cp-xs">
            <input
              type="checkbox"
              checked={!!equipment.dmxAdresseFestgesetzt}
              onChange={(e) => updateEquipment(equipment.id, { dmxAdresseFestgesetzt: e.target.checked })}
            />
            <span>{t('dmx.pinned', 'Keep this address — automatic assignment skips it')}</span>
          </label>

          {befunde.map((b) => (
            <PanelHint
              key={`${b.art}:${b.geraetId}`}
              text={format(t(b.schluessel, b.text), b.werte)}
            />
          ))}
        </div>
      )}
    </SortableSection>
  )
}
