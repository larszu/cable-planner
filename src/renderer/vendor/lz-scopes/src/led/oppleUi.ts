// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Light-meter section of the LED-wall dialog (#10/#11): measure cabinets with the Opple Light
// Master through the patch sequencer, map the results, white-point Δ and gain hints, flicker.

import type { XY } from '../color';
import { PatchSequencer, sendPatch } from '../patchSequencer';
import { oppleMeter, pickerBox } from '../opple/ui';
import { lightStore } from '../opple/store';
import type { FlickerResult } from '../opple/protocol';
import { drawCabinetMap, stackCanvases } from './map';
import {
  COLOUR_LABELS, WHITE_TARGETS, buildPlan, evaluatePoints, meterCsv, summarize, whiteCorrection,
  type MeterResults, type PlanStep, type PointStat, type WhiteCorrection, type XYZ,
} from './oppleCheck';
import { PROCESSOR_LABELS, type WallConfig } from './wall';
import { cabinetMatch, cabinetMatchHint, whitePointHints } from './processorHints';
import { num, t } from '../i18n';
import { button, checkbox, download, h, hint, inlineLabel as lab, numberInput, row, select as sel, table, textInput, type Kid } from '../ui';

export interface MeterCheckHost {
  wall: () => WallConfig;
  /** open an output window (patches are drawn by every open pattern output window) */
  openOutput: () => void;
  cameraCsv: () => string | null;
  cameraHeat: () => HTMLCanvasElement | null;
  /** new light-meter statistics (for the camera heatmap's meter modes) */
  onStats: (s: PointStat[]) => void;
}

/** Table of figures (right-aligned, tabular), scrolled inside .table-wrap on phones. */
const numTable = (head: Kid[], rows: Kid[][]) => h('div', { class: 'table-wrap' }, table(rows, { head, cls: 'num-table' }));
const de = (v: number, d: number) => (Number.isFinite(v) ? num(v, d) : '–');
const sg = (v: number, d: number) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${de(v, d)}` : '–');

export function mountMeterCheck(box: HTMLElement, host: MeterCheckHost) {
  const picker = pickerBox();
  const results: MeterResults = new Map();
  let points: 'all' | 'full' | 'list' = 'all', list = '', white = 100, gray = 0, primaries = true;
  let auto = false, settle = 1500, avgN = 3, distance = t('led.m.distanceDefault');
  let ref = '', mapMode: 'dy' | 'duv' | 'cct' = 'dy', range = 5;
  let targetId = 'd65', customXy: XY = [0.3127, 0.329], primSource: 'measured' | 'xy' = 'measured', primXy = ['', '', '', '', '', ''];
  let whitePoint = '';
  let seq: PatchSequencer<XYZ> | null = null, running = false, progress = '', answer: ((ok: boolean) => void) | null = null;
  let flicker: FlickerResult | null = null, flickerMsg = '';
  const map = h('canvas', { class: 'heat', width: 960, height: 300 });
  let stats: PointStat[] = [];

  const status = () => oppleMeter.state === 'connected' ? t('led.m.connected', { model: oppleMeter.model === 'lm4' ? 'Light Master 4' : 'Light Master 3' }) : oppleMeter.message || t('led.m.notConnected');
  oppleMeter.addEventListener('status', () => render());
  document.addEventListener('keydown', (e) => {
    if (!answer || !box.isConnected || (e.target as Element | null)?.closest?.('input, select, textarea')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); answer(true); }
  });

  async function run() {
    if (oppleMeter.state !== 'connected') { progress = t('led.m.connectFirst'); render(); return; }
    const plan: PlanStep[] = buildPlan(host.wall(), {
      points: points === 'list' ? list.split(/[\s,;]+/).filter(Boolean) : points, white: white / 100, gray: gray / 100, primaries,
    });
    if (!plan.length) { progress = t('led.m.noPoints'); render(); return; }
    running = true; render();
    seq = new PatchSequencer<XYZ>(plan.map((s) => s.frame), async (_f, i, signal) => {
      const st = plan[i];
      if (!auto) {
        progress = t('led.m.stepPlace', { i: i + 1, n: plan.length, point: st.point, colour: COLOUR_LABELS[st.colour] });
        render();
        const ok = await new Promise<boolean>((res) => { answer = res; signal.addEventListener('abort', () => res(false), { once: true }); });
        answer = null;
        if (!ok) return null;
      }
      progress = t('led.m.stepMeasuring', { i: i + 1, n: plan.length, point: st.point, colour: COLOUR_LABELS[st.colour] }); render();
      const r = await oppleMeter.measureAveraged(avgN);
      const xyz: XYZ = [r.X, r.Y, r.Z];
      const cur = results.get(st.point) ?? {};
      cur[st.colour] = xyz; results.set(st.point, cur);
      if (!ref) ref = st.point;
      evaluate();
      return xyz;
    }, { settleMs: auto ? settle : 300 });
    try { await seq.run(); progress = seq.stopped ? t('led.m.aborted') : t('led.m.done'); }
    catch (e) { progress = t('led.m.error', { msg: (e as Error).message }); }
    running = false; seq = null; answer = null; render();
  }

  function evaluate() {
    stats = ref ? evaluatePoints(results, ref) : [];
    host.onStats(stats);
  }

  function correction(): WhiteCorrection | null {
    const pt = results.get(whitePoint || ref);
    if (!pt?.W) return null;
    const target = targetId === 'custom' ? customXy : WHITE_TARGETS.find((x) => x.id === targetId)!.xy();
    if (primSource === 'measured') return whiteCorrection(pt.W, target, pt.R && pt.G && pt.B ? { measured: [pt.R, pt.G, pt.B] } : {});
    const n = primXy.map(Number);
    const ok = primXy.every((v) => v.trim() !== '') && n.every((v) => v > 0 && v < 1);
    return whiteCorrection(pt.W, target, ok ? { xy: [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]]] } : {});
  }

  /** Entered primary chromaticities, if complete. */
  function enteredXy(): [XY, XY, XY] | undefined {
    const n = primXy.map(Number);
    return primSource === 'xy' && primXy.every((v) => v.trim() !== '') && n.every((v) => v > 0 && v < 1) ? [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]]] : undefined;
  }
  let currentK = 6504;

  function drawMap() {
    const vals = new Map<string, number>();
    for (const s of stats) vals.set(s.point, mapMode === 'dy' ? s.dY : mapMode === 'duv' ? s.duv * 1000 : s.cct);
    const cctRef = stats.find((s) => s.point === ref)?.cct ?? NaN;
    if (mapMode === 'cct') for (const [k, v] of vals) vals.set(k, v - cctRef);
    const what = { dy: t('led.m.mapDy'), duv: t('led.m.mapDuv'), cct: t('led.m.mapCct') }[mapMode];
    drawCabinetMap(map, host.wall(), vals, mapMode === 'cct' ? range * 20 : range, t('led.m.mapCaption', { name: host.wall().name, what, range: mapMode === 'cct' ? range * 20 : range, ref }),
      (v) => (mapMode === 'duv' ? de(v, 1) : mapMode === 'cct' ? sg(v, 0) : sg(v, 1)), { oneSided: mapMode === 'duv', mark: ref });
  }

  function render() {
    const measured = [...results.keys()];
    const sum = stats.length > 1 ? summarize(stats) : null;
    const corr = correction();
    const whiteOpts: [string, string][] = measured.filter((p) => results.get(p)?.W).map((p) => [p, p]);
    box.replaceChildren(
      h('p', { class: 'note' }, t('led.m.disclaimer')),
      row(
        h('b', {}, status()),
        oppleMeter.state === 'connected'
          ? button(t('led.m.disconnect'), () => { oppleMeter.disconnect(); render(); })
          : button(t('led.m.search'), () => { lightStore().connectNew().catch(() => {}).finally(render); }, { variant: 'primary' }),
        button(t('led.m.openOutput'), () => host.openOutput(), { title: t('led.m.outputTitle') })),
      picker,
      row(
        lab(t('led.m.points'), sel(points, [['all', t('led.m.allCabinets')], ['list', t('led.m.selection')], ['full', t('led.m.fullOne')]], (v) => { points = v as typeof points; render(); })),
        points === 'list' && textInput(list, (v) => { list = v; }, { placeholder: 'C1-R1, C5-R3 …' }),
        lab(t('led.m.whitePct'), numberInput(white, (n) => { white = Math.min(100, Math.max(1, n)); }, { title: t('led.m.whiteTitle') })),
        lab(t('led.m.greyPct'), numberInput(gray, (n) => { gray = Math.min(100, Math.max(0, n)); }, { title: t('led.m.greyTitle') })),
        checkbox(primaries, 'R G B', (v) => { primaries = v; }, t('led.m.primCheckTitle'))),
      row(
        lab(t('led.m.sequence'), sel(auto ? 'auto' : 'manual', [['manual', t('led.m.manualConfirm')], ['auto', t('led.m.autoFixed')]], (v) => { auto = v === 'auto'; })),
        lab(t('led.m.settle'), numberInput(settle, (n) => { settle = Math.max(100, n); }, { title: t('led.m.settleTitle'), step: '100', size: 'l' })),
        lab(t('led.cam.average'), numberInput(avgN, (n) => { avgN = Math.max(1, Math.min(20, Math.round(n))); }, { title: t('led.m.avgTitle'), size: 's' })),
        lab(t('led.m.distance'), textInput(distance, (v) => { distance = v; }, { title: t('led.m.distanceTitle') }))),
      row(
        running
          ? button(t('led.m.abort'), () => seq?.stop())
          : button(t('led.m.start'), run, { variant: 'primary' }),
        running && answer && button(t('led.m.measureSpace'), () => answer?.(true), { variant: 'primary' }),
        running && answer && button(t('led.m.skip'), () => answer?.(false)),
        results.size > 0 && button(t('led.m.clear'), () => { results.clear(); stats = []; ref = ''; host.onStats([]); render(); }),
        h('span', { class: 'hint', role: 'status' }, progress)),
      hint(t('led.m.howto')),
      stats.length ? h('div', {},
        row(
          lab(t('led.m.reference'), sel(ref, measured.map((p) => [p, p]), (v) => { ref = v; evaluate(); render(); })),
          lab(t('led.res.map'), sel(mapMode, [['dy', t('led.m.brightnessPct')], ['duv', 'Δu′v′'], ['cct', 'CCT']], (v) => { mapMode = v as typeof mapMode; drawMap(); })),
          lab(t('led.res.scale'), sel(String(range), ['1', '2', '5', '10', '20'].map((v) => [v, v] as [string, string]), (v) => { range = Number(v); drawMap(); })),
          sum ? h('b', {}, t('led.m.summary', { u: de(sum.uniformity, 1), lo: sg(sum.minDY, 1), hi: sg(sum.maxDY, 1), duv: de(sum.maxDuv, 4) })) : ''),
        h('div', { class: 'cam-wrap' }, map),
        numTable([t('led.m.point'), 'E lx', 'ΔY %', 'x', 'y', 'Δu′v′', 'CCT K', 'Duv'],
          stats.map((s) => [s.point, de(s.Y, 1), sg(s.dY, 2), de(s.xy[0], 4), de(s.xy[1], 4), de(s.duv, 4), de(s.cct, 0), sg(s.duvPlanck, 4)]))) : '',
      row( h('b', {}, t('led.m.whiteBalance')),
        whiteOpts.length ? lab(t('led.m.measPoint'), sel(whitePoint || ref, whiteOpts, (v) => { whitePoint = v; render(); })) : h('span', { class: 'hint' }, t('led.m.measureFirst')),
        lab(t('led.m.targetLabel'), sel(targetId, [...WHITE_TARGETS.map((x) => [x.id, x.name] as [string, string]), ['custom', t('led.m.customXy')]], (v) => { targetId = v; render(); })),
        targetId === 'custom' && h('span', { class: 'row' }, numberInput(customXy[0], (n) => { customXy = [n, customXy[1]]; render(); }, { title: t('led.m.targetX'), step: '0.0001', size: 'l' }), numberInput(customXy[1], (n) => { customXy = [customXy[0], n]; render(); }, { title: t('led.m.targetY'), step: '0.0001', size: 'l' })),
        lab(t('led.m.primaries'), sel(primSource, [['measured', t('led.m.primMeasured')], ['xy', t('led.m.primEnter')]], (v) => { primSource = v as typeof primSource; render(); }))),
      primSource === 'xy' ? row(...['Rx', 'Ry', 'Gx', 'Gy', 'Bx', 'By'].map((c, i) =>
        textInput(primXy[i], (v) => { primXy[i] = v.replace(',', '.'); render(); }, { placeholder: c, title: t('led.m.primTitle', { c }), attrs: { class: 'xy', inputmode: 'decimal' } }))) : '',
      corr ? whiteBox(corr) : '',
      row( h('b', {}, t('led.m.flicker')),
        button(t('led.m.flickerMeasure'), async () => {
          flickerMsg = t('led.m.measuring'); render();
          try { flicker = await oppleMeter.flicker(); flickerMsg = ''; } catch (e) { flickerMsg = (e as Error).message; }
          render();
        }, { disabled: oppleMeter.state !== 'connected' || running, title: t('led.m.flickerTitle') }),
        h('span', { class: 'hint' }, flicker ? t('led.m.flickerResult', { p: de(flicker.percent, 1), i: de(flicker.index, 3), f: de(flicker.frequency, 0), sr: de(flicker.sampleRate / 1000, 1) }) : flickerMsg)),
      hint(t('led.m.flickerHint')),
      row(
        button(t('led.m.reportCsv'), () => {
          const parts = [host.cameraCsv(), results.size ? meterCsv(host.wall(), results, ref, stats, corr, flicker ? `Percent ${flicker.percent.toFixed(1)} %, Index ${flicker.index.toFixed(3)}, ${flicker.frequency.toFixed(0)} Hz` : '', distance) : null].filter(Boolean);
          download(`${t('led.file.prefix')}-${host.wall().name}-${t('led.file.report')}.csv`, new Blob([parts.join('\n')], { type: 'text/csv' }));
        }, { disabled: !results.size && !host.cameraCsv(), title: t('led.m.reportTitle') }),
        button(t('led.m.reportPng'), async () => {
          const list = [host.cameraHeat(), stats.length ? map : null].filter((c): c is HTMLCanvasElement => !!c);
          const b = await stackCanvases(list);
          if (b) download(`${t('led.file.prefix')}-${host.wall().name}-${t('led.file.report')}.png`, b);
        }, { disabled: !results.size && !host.cameraHeat() })),
    );
    if (stats.length) drawMap();
  }

  function whiteBox(c: WhiteCorrection) {
    return h('div', {},
      numTable(['', 'x', 'y', 'CCT K', 'Duv'], [
        [t('led.m.actual'), de(c.ist.xy[0], 4), de(c.ist.xy[1], 4), de(c.ist.cct, 0), sg(c.ist.duv, 4)],
        [t('led.m.target'), de(c.soll.xy[0], 4), de(c.soll.xy[1], 4), de(c.soll.cct, 0), sg(c.soll.duv, 4)],
        ['Δ', sg(c.ist.xy[0] - c.soll.xy[0], 4), sg(c.ist.xy[1] - c.soll.xy[1], 4), sg(c.ist.cct - c.soll.cct, 0), `Δu′v′ ${de(c.duv, 4)}`],
      ]),
      c.gains ? h('p', {}, h('b', {}, t('led.m.corrHint', { r: de(c.gains[0], 1), g: de(c.gains[1], 1), b: de(c.gains[2], 1) })),
        ` ${t('led.m.corrDetail', { after: de(c.luminanceAfter ?? NaN, 0), src: c.primariesSource ? t(`led.m.src.${c.primariesSource}`) : '–', add: c.additivity != null ? t('led.m.additivity', { v: de(c.additivity, 1) }) : '' })}`)
        : hint(t('led.m.noGains')),
      host.wall().processor === 'brompton' ? row(lab(t('led.m.tesseraAt'), numberInput(currentK, (n) => { currentK = Math.min(11000, Math.max(2000, n)); render(); }, { title: t('led.m.tesseraTitle'), size: 'l' }), 'K')) : '',
      ...whitePointHints(host.wall().processor, c, currentK).map((hint) => h('div', {}, h('b', {}, `${PROCESSOR_LABELS[host.wall().processor]} – ${hint.title}`), h('ul', {}, ...hint.lines.map((l) => h('li', {}, l))))),
      matchBox(),
      ...c.warnings.map((w) => h('p', { class: 'note' }, w)));
  }

  /** Per-cabinet gains to match the reference cabinet. */
  function matchBox() {
    if (stats.length < 2) return '';
    const m = cabinetMatch(results, ref, enteredXy());
    const ok = m.rows.filter((r) => r.gains);
    if (!ok.length) return hint(t('led.m.matchNone'));
    return h('div', {},
      h('b', {}, t('led.m.matchTitle', { ref })),
      hint(`${cabinetMatchHint(host.wall().processor)} ${t('led.m.matchDetail', { f: de(m.scale * 100, 1) })}`),
      numTable(['Cabinet', 'R %', 'G %', 'B %', t('led.chk.csvNote')],
        m.rows.map((r) => [r.point, ...(r.gains ? r.gains.map((g) => de(g, 1)) : ['–', '–', '–']), h('span', { class: 'hint' }, r.warnings.join(' '))])));
  }

  render();
  return { stop: () => { seq?.stop(); sendPatch(null); } };
}
