// #1240 Stufe 3 — „Pult“: den Mischer gegen die Simulation bedienen.
//
// Je M/E Programm- und Vorschau-Reihe, Cut, Auto und T-Bar, Keyer an/aus;
// dazu DSK, Aux, Makros und die SuperSource-Boxen. Daneben das simulierte
// Ergebnisbild. Die Zustandsmaschine ist `lib/switching/simulation.ts`;
// hier liefern nur `requestAnimationFrame` die Zeit und der Store den Stand.
// Was ein Schnitt aendert, landet am Geraet im Projekt; der laufende
// Uebergang selbst nur in dieser Sitzung.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { format, useTranslation } from '../../../lib/i18n'
import {
  EASE_DIRECTIONS,
  EASE_FAMILIES,
  TRANSITION_STYLES,
  WIPE_PATTERNS,
  allRoutes,
  buildInnerMatrix,
  fullBox,
  routePatch,
  runOf,
  simStep,
  transitionOf,
  type EaseDirection,
  type EaseFamily,
  type InnerBlock,
  type MeRun,
  type SimCommand,
  type SwitchingProfile,
  type TransitionStyle,
  type WipePattern,
} from '../../../lib/switching'
import type { EquipmentItem } from '../../../types/equipment'
import { Ergebnisbild } from './Ergebnisbild'
import { blockLabel, shortLabel } from './labels'

const STYLE_EN: Record<TransitionStyle, string> = { mix: 'Mix', dip: 'Dip', wipe: 'Wipe' }
const WIPE_EN: Record<WipePattern, string> = {
  right: 'Left to right',
  left: 'Right to left',
  down: 'Top to bottom',
  up: 'Bottom to top',
  barnDoor: 'Barn door',
  circle: 'Circle',
  diamond: 'Diamond',
  box: 'Box',
}

const Taste = ({
  an,
  farbe,
  onClick,
  children,
  title,
  testId,
}: {
  an: boolean
  farbe: 'pgm' | 'pvw' | 'key'
  onClick: () => void
  children: React.ReactNode
  title?: string
  testId?: string
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    data-testid={testId}
    aria-pressed={an}
    className={`min-w-[2.25rem] rounded-cp-s border px-1.5 py-1 text-cp-xs font-medium ${
      an
        ? farbe === 'pvw'
          ? 'border-cp-ok bg-cp-ok text-white'
          : 'border-cp-danger bg-cp-danger text-white'
        : 'border-cp-border bg-cp-surface-2 text-cp-text hover:bg-cp-surface-3'
    }`}
  >
    {children}
  </button>
)

const Feld = ({ children }: { children: React.ReactNode }) => (
  <section className="rounded-cp-card border border-cp-border bg-cp-surface-1 p-2.5">{children}</section>
)

const sel = 'border border-cp-border bg-cp-surface-2 px-1 py-0.5 text-cp-xs'

export const MischerPult = ({ device, profile }: { device: EquipmentItem; profile: SwitchingProfile | null }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const [runs, setRuns] = useState<Record<string, MeRun>>({})
  const [ausgabe, setAusgabe] = useState('pgm')
  const runsRef = useRef(runs)
  useEffect(() => {
    runsRef.current = runs
  }, [runs])

  const switching = useMemo(() => device.switching ?? {}, [device.switching])
  const matrix = useMemo(() => buildInnerMatrix(device, profile, switching), [device, profile, switching])
  const routes = useMemo(() => allRoutes(device, matrix, switching), [device, matrix, switching])
  const sim = useMemo(() => ({ switching, runs }), [switching, runs])
  const input = useMemo(() => ({ matrix, routes, sim }), [matrix, routes, sim])

  /** Einen Befehl auf den frischen Stand aus dem Store anwenden. */
  const apply = useCallback(
    (cmd: SimCommand) => {
      const d = useProjectStore.getState().project.equipment.find((e) => e.id === device.id)
      if (!d) return
      const vorher = d.switching ?? {}
      const next = simStep({ switching: vorher, runs: runsRef.current }, cmd)
      runsRef.current = next.runs
      setRuns(next.runs)
      if (next.switching !== vorher) updateEquipment(device.id, { switching: next.switching })
    },
    [device.id, updateEquipment],
  )

  // „Auto“ laeuft im Bildtakt des Browsers.
  const autoLaeuft = Object.values(runs).some((r) => r.auto)
  useEffect(() => {
    if (!autoLaeuft) return
    let frame = 0
    let last = performance.now()
    const loop = (now: number) => {
      apply({ type: 'tick', dtMs: now - last })
      last = now
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [autoLaeuft, apply])

  const mes = matrix.blocks.filter((b) => b.kind === 'mixEffect')
  const quellen = (fuer: string) => matrix.blocks.filter((b) => b.source && b.id !== fuer)
  const dsks = matrix.blocks.filter((b) => b.kind === 'downstreamKeyer')
  const auxe = matrix.blocks.filter((b) => b.kind === 'aux')
  const sss = matrix.blocks.filter((b) => b.kind === 'superSource')
  const mvs = matrix.blocks.filter((b) => b.kind === 'multiviewer')
  const makros = switching.macros ?? []
  const keyerAn = (id: string) => switching.keyers?.[id]?.onAir === true

  const quellOptionen = (fuer: string, leer = true) => (
    <>
      {leer && <option value="">{t('switching.media.none', '— none —')}</option>}
      {quellen(fuer).map((b) => (
        <option key={b.id} value={b.id}>
          {blockLabel(b, t)}
        </option>
      ))}
    </>
  )

  const meZeile = (me: InnerBlock) => {
    const tr = transitionOf(switching, me.id)
    const run = runOf(sim, me.id)
    const reihe = (bus: 'pgm' | 'pvw') => (
      <div className="flex items-start gap-2">
        <span className="w-16 shrink-0 pt-1 text-cp-text-muted">
          {bus === 'pgm' ? t('switching.pult.program', 'Programme') : t('switching.pult.preview', 'Preview')}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {quellen(me.id).map((b) => (
            <Taste
              key={b.id}
              an={routes.get(`${me.id}/${bus}`) === b.id}
              farbe={bus}
              title={blockLabel(b, t)}
              testId={`pult-${me.id}-${bus}-${b.id}`}
              onClick={() => apply({ type: bus === 'pgm' ? 'program' : 'preview', me: me.id, source: b.id })}
            >
              {shortLabel(b, t)}
            </Taste>
          ))}
        </div>
      </div>
    )
    const keyer = matrix.blocks.filter((b) => b.kind === 'upstreamKeyer' && b.parent === me.id)
    return (
      <Feld key={me.id}>
        <h3 className="mb-2 font-medium text-cp-text">{blockLabel(me, t)}</h3>
        <div className="flex flex-col gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            {reihe('pgm')}
            {reihe('pvw')}
            {keyer.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-cp-text-muted">{t('switching.pult.keyers', 'Keyers')}</span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {keyer.map((k) => (
                    <Taste
                      key={k.id}
                      an={keyerAn(k.id)}
                      farbe="key"
                      testId={`pult-${k.id}`}
                      title={routes.get(`${k.id}/fill`) ? blockLabel(matrix.byId.get(routes.get(`${k.id}/fill`)!)!, t) : undefined}
                      onClick={() => apply({ type: 'keyer', id: k.id, onAir: !keyerAn(k.id) })}
                    >
                      {blockLabel(k, t)}
                    </Taste>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="order-first flex flex-wrap items-start gap-3 border-b border-cp-border pb-2">
            <div className="flex w-28 flex-col gap-1">
              <div className="flex gap-1">
                <button
                  type="button"
                  data-testid={`pult-${me.id}-cut`}
                  onClick={() => apply({ type: 'cut', me: me.id })}
                  className="flex-1 rounded-cp-control border border-cp-border bg-cp-surface-2 px-2 py-1.5 font-medium hover:bg-cp-surface-3"
                >
                  {t('switching.pult.cut', 'Cut')}
                </button>
                <button
                  type="button"
                  data-testid={`pult-${me.id}-auto`}
                  onClick={() => apply({ type: 'auto', me: me.id })}
                  className={`flex-1 rounded-cp-control border px-2 py-1.5 font-medium ${
                    run.auto ? 'border-cp-danger bg-cp-danger text-white' : 'border-cp-border bg-cp-surface-2 hover:bg-cp-surface-3'
                  }`}
                >
                  {t('switching.pult.auto', 'Auto')}
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(run.tbar * 1000)}
                onChange={(e) => apply({ type: 'tbar', me: me.id, value: Number(e.target.value) / 1000 })}
                aria-label={format(t('switching.pult.tbar', 'T-bar {me}'), { me: blockLabel(me, t) })}
                data-testid={`pult-${me.id}-tbar`}
                className="w-full accent-cp-accent"
              />
              <div className="h-1 overflow-hidden rounded-cp-s bg-cp-surface-3" aria-hidden>
                <div className="h-full bg-cp-danger" style={{ width: `${Math.round(run.progress * 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-[auto_auto] items-center gap-x-1.5 gap-y-1 text-cp-xs">
              <span>{t('switching.pult.style', 'Transition')}</span>
              <select
                className={sel}
                value={tr.style}
                onChange={(e) => apply({ type: 'transition', me: me.id, patch: { style: e.target.value as TransitionStyle } })}
                data-testid={`pult-${me.id}-style`}
              >
                {TRANSITION_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {t(`switching.transition.${s}`, STYLE_EN[s])}
                  </option>
                ))}
              </select>
              <span>{t('switching.pult.rate', 'Duration (ms)')}</span>
              <input
                type="number"
                min={40}
                max={10000}
                step={40}
                className={`${sel} w-20`}
                value={tr.rateMs}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v > 0) apply({ type: 'transition', me: me.id, patch: { rateMs: v } })
                }}
              />
              {tr.style === 'wipe' && (
                <>
                  <span>{t('switching.pult.pattern', 'Pattern')}</span>
                  <select
                    className={sel}
                    value={tr.wipe}
                    onChange={(e) => apply({ type: 'transition', me: me.id, patch: { wipe: e.target.value as WipePattern } })}
                  >
                    {WIPE_PATTERNS.map((w) => (
                      <option key={w} value={w}>
                        {t(`switching.wipe.${w}`, WIPE_EN[w])}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {tr.style === 'dip' && (
                <>
                  <span>{t('switching.pult.dipSource', 'Dip source')}</span>
                  <select
                    className={sel}
                    value={tr.dipSource}
                    onChange={(e) => apply({ type: 'transition', me: me.id, patch: { dipSource: e.target.value } })}
                  >
                    {quellOptionen(me.id, false)}
                  </select>
                </>
              )}
              <span>{t('switching.pult.easing', 'Curve')}</span>
              <span className="flex gap-1">
                <select
                  className={sel}
                  value={tr.easing.family}
                  onChange={(e) =>
                    apply({ type: 'transition', me: me.id, patch: { easing: { ...tr.easing, family: e.target.value as EaseFamily } } })
                  }
                  aria-label={t('switching.pult.easing', 'Curve')}
                >
                  {EASE_FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <select
                  className={sel}
                  value={tr.easing.direction}
                  onChange={(e) =>
                    apply({
                      type: 'transition',
                      me: me.id,
                      patch: { easing: { ...tr.easing, direction: e.target.value as EaseDirection } },
                    })
                  }
                  aria-label={t('switching.pult.easingDirection', 'Curve direction')}
                >
                  {EASE_DIRECTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>
        </div>
      </Feld>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 text-cp-xs xl:flex-row" data-testid="pult">
      <div className="min-w-0 flex-1 space-y-3">
        {mes.length === 0 && (
          <p className="text-cp-text-muted">
            {t('switching.pult.noMe', 'This switcher has no M/E yet. Add the blocks in the layout view.')}
          </p>
        )}
        {mes.map(meZeile)}

        {dsks.length > 0 && (
          <Feld>
            <h3 className="mb-1.5 font-medium text-cp-text">{t('switching.pult.dsk', 'Downstream keyers')}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {dsks.map((k) => (
                <span key={k.id} className="flex items-center gap-1">
                  <Taste an={keyerAn(k.id)} farbe="key" testId={`pult-${k.id}`} onClick={() => apply({ type: 'keyer', id: k.id, onAir: !keyerAn(k.id) })}>
                    {blockLabel(k, t)}
                  </Taste>
                  <select
                    className={sel}
                    value={routes.get(`${k.id}/fill`) ?? ''}
                    onChange={(e) => apply({ type: 'route', dest: `${k.id}/fill`, source: e.target.value || undefined })}
                    aria-label={format(t('switching.pult.fillOf', 'Fill of {name}'), { name: blockLabel(k, t) })}
                  >
                    {quellOptionen('')}
                  </select>
                </span>
              ))}
            </div>
          </Feld>
        )}

        {auxe.length > 0 && (
          <Feld>
            <h3 className="mb-1.5 font-medium text-cp-text">{t('switching.pult.aux', 'Aux')}</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1.5">
              {auxe.map((a) => (
                <label key={a.id} className="flex items-center gap-1.5">
                  <span className="w-12 shrink-0">{blockLabel(a, t)}</span>
                  <select
                    className={`${sel} min-w-0 flex-1`}
                    value={routes.get(a.id) ?? ''}
                    onChange={(e) => {
                      const d = useProjectStore.getState().project.equipment.find((x) => x.id === device.id)
                      if (d) updateEquipment(device.id, routePatch(d, matrix, a.id, e.target.value || undefined))
                    }}
                    data-testid={`pult-${a.id}`}
                  >
                    {quellOptionen(a.id)}
                  </select>
                </label>
              ))}
            </div>
          </Feld>
        )}

        <Feld>
          <h3 className="mb-1.5 font-medium text-cp-text">{t('switching.pult.macros', 'Macros')}</h3>
          {makros.length === 0 ? (
            <p className="text-cp-text-muted">{t('switching.pult.noMacros', 'No macros in this plan yet.')}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {makros.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => apply({ type: 'macro', macro: m })}
                  className="rounded-cp-s border border-cp-border bg-cp-surface-2 px-2 py-1 hover:bg-cp-surface-3"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </Feld>

        {sss.map((ss) => (
          <Feld key={ss.id}>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="font-medium text-cp-text">{blockLabel(ss, t)}</h3>
              <button
                type="button"
                className="rounded-cp-s px-1.5 py-0.5 text-cp-accent hover:bg-cp-surface-3"
                onClick={() =>
                  ss.dests
                    .filter((d) => d.role === 'box')
                    .forEach((d) => apply({ type: 'box', id: d.id, patch: fullBox(d.index ?? 1, undefined) }))
                }
              >
                {t('switching.pult.quad', 'Quad layout')}
              </button>
            </div>
            <div className="space-y-1">
              {ss.dests
                .filter((d) => d.role === 'box')
                .map((d) => {
                  const b = fullBox(d.index ?? 1, switching.boxes?.[d.id])
                  const zahl = (k: 'x' | 'y' | 'size', step: number, min: number, max: number) => (
                    <input
                      type="number"
                      step={step}
                      min={min}
                      max={max}
                      value={b[k]}
                      className={`${sel} w-16`}
                      aria-label={`${format(t('switching.dest.box', 'Box {n}'), { n: d.index ?? 1 })} ${k}`}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (Number.isFinite(v)) apply({ type: 'box', id: d.id, patch: { [k]: Math.min(max, Math.max(min, v)) } })
                      }}
                    />
                  )
                  return (
                    <div key={d.id} className="flex flex-wrap items-center gap-1.5" data-testid={`pult-${d.id}`}>
                      <label className="flex w-16 items-center gap-1">
                        <input
                          type="checkbox"
                          checked={b.enabled}
                          onChange={() => apply({ type: 'box', id: d.id, patch: { enabled: !b.enabled } })}
                        />
                        {format(t('switching.dest.box', 'Box {n}'), { n: d.index ?? 1 })}
                      </label>
                      <select
                        className={`${sel} w-36`}
                        value={routes.get(d.id) ?? ''}
                        onChange={(e) => apply({ type: 'route', dest: d.id, source: e.target.value || undefined })}
                        aria-label={format(t('switching.pult.boxSource', 'Source of box {n}'), { n: d.index ?? 1 })}
                      >
                        {quellOptionen(ss.id)}
                      </select>
                      <span className="text-cp-text-muted">x</span>
                      {zahl('x', 0.5, -48, 48)}
                      <span className="text-cp-text-muted">y</span>
                      {zahl('y', 0.5, -27, 27)}
                      <span className="text-cp-text-muted">{t('switching.pult.size', 'size')}</span>
                      {zahl('size', 0.05, 0.07, 1)}
                    </div>
                  )
                })}
            </div>
          </Feld>
        ))}
      </div>

      <div className="w-full shrink-0 space-y-2 xl:w-[30rem]">
        <label className="flex items-center gap-2">
          <span className="font-medium text-cp-text">{t('switching.pult.result', 'Result')}</span>
          <select className={sel} value={ausgabe} onChange={(e) => setAusgabe(e.target.value)} data-testid="pult-ausgabe">
            <option value="pgm">{t('switching.block.program', 'PGM')}</option>
            {mes.map((m) => (
              <option key={m.id} value={m.id}>
                {blockLabel(m, t)}
              </option>
            ))}
            {auxe.map((a) => (
              <option key={a.id} value={a.id}>
                {blockLabel(a, t)}
              </option>
            ))}
            {mvs.map((m) => (
              <option key={m.id} value={m.id}>
                {blockLabel(m, t)}
              </option>
            ))}
          </select>
        </label>
        <Ergebnisbild device={device} input={input} target={ausgabe} />
        <p className="text-cp-text-muted">
          {t(
            'switching.pult.hint',
            'Simulated: test patterns with source names and loaded stills, arranged as the switcher would. Not a picture of real signals.',
          )}
        </p>
      </div>
    </div>
  )
}
