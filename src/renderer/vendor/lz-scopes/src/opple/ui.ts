// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Light meter panel in the sidebar (#11): find and connect one or more Opple Light Masters over
// Web Bluetooth, name them, show lux / CCT / Duv / xy, take measuring points (grid, comparison
// with gel suggestion), export CSV, open the light scopes in the dock.

import { bluetoothSupport } from './meter';
import { LM3_MODE_NAMES, readingsCsv, type Reading } from './photometry';
import { compareLights, greenMagentaHint } from './lightScience';
import { desktopBluetooth, lightStore, oppleMeter, type LightStore } from './store';
import { ArgyllLightMeter, DRIVER_LABELS } from './drivers';
import type { SpectrumUnit } from './spectrum';
import { num, t } from '../i18n';
import { button, download as save, filePicker, h, hint, iconButton, kicker, numberInput, row, select, statusDot, textInput } from '../ui';

export { oppleMeter };

const de = (v: number, d: number) => (Number.isFinite(v) ? num(v, d).replace('-', '−') : '–');
const sgn = (v: number, d: number) => (Number.isFinite(v) ? (v >= 0 ? '+' : '−') + num(Math.abs(v), d) : '–');
const download = (name: string, text: string) => save(name, text, 'text/csv');
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

export const NO_PAIRING_HINT = t('opple.ui.noPairing');

/**
 * Device list of the Electron app while a scan runs (Chrome shows its own chooser). Also used by
 * the LED-wall dialog.
 */
export function pickerBox(s: LightStore = lightStore()): HTMLElement {
  const box = h('div');
  const render = () => {
    if (!s.picker) { box.replaceChildren(); return; }
    const p = s.picker;
    box.replaceChildren(h('div', { class: 'picker' },
      hint(p.devices.length ? t('opple.ui.found') : t('opple.ui.searching')),
      ...p.devices.map((d) => {
        const known = s.known.find((k) => k.nativeId === d.id);
        const busy = [...s.meters.keys()].includes(known?.key ?? '-');
        return button(`${known ? `${known.alias} · ` : ''}${d.name || 'Light Master'}${busy ? ` ${t('opple.ui.alreadyConnected')}` : known ? '' : ` ${t('opple.ui.new')}`}`, () => s.pick(d.id), { disabled: busy, attrs: { class: 'btn pick' } });
      }),
      row(button(t('opple.ui.cancel'), () => s.cancelPick()), p.scanning && h('span', { class: 'hint' }, t('opple.ui.scanning')))));
  };
  s.addEventListener('change', render);
  render();
  return box;
}

export function mountOpple(root: HTMLElement, hooks: { openScopes?: () => void; bridgeWs?: () => string } = {}) {
  root.classList.add('opple');
  const s = lightStore();
  if (hooks.bridgeWs) s.bridgeWs = hooks.bridgeWs;
  const sup = bluetoothSupport();

  const status = hint();
  const devices = h('div');
  const vals = h('div', { class: 'big' });
  const chart = h('canvas', { width: 280, height: 40, title: t('opple.ui.chartTitle') });
  const info = hint();
  const buttons = row();
  const points = h('div');

  const cell = (label: string, value: string) => h('div', {}, h('b', {}, value), h('span', {}, label));
  const connect = (p: Promise<unknown>) => p.then(() => s.setRunning(true)).catch(() => { /* message shows it */ }).finally(render);

  function renderDevices() {
    const rows = s.known.map((k) => {
      const m = s.meters.get(k.key), st = m?.state ?? 'idle';
      const r = s.latest(k.key);
      const alias = textInput(k.alias, (v) => s.rename(k.key, v), { title: t('opple.ui.aliasTitle', { name: k.name }), attrs: { class: 'alias' } });
      return h('div', { class: `dev${s.active === k.key ? ' active' : ''}` },
        statusDot(st === 'connected' ? 'live' : st === 'error' ? 'error' : st === 'idle' ? 'idle' : 'connecting', m?.message || t('opple.ui.notConnected')),
        alias,
        st === 'connected'
          ? button(t('opple.ui.disconnect'), () => s.disconnect(k.key), { small: true })
          : button(t('opple.ui.connect'), () => connect(s.reconnect(k)), { small: true, disabled: (k.driver !== 'argyll' && !sup.ok) || (st !== 'idle' && st !== 'error'), title: t('opple.ui.connectTitle') }),
        m instanceof ArgyllLightMeter && st !== 'idle' && button(t('opple.ui.calibrate'), () => m.key('k'), { small: true, title: t('opple.ui.calTitle') }),
        st === 'connected' && s.active !== k.key && button(t('opple.ui.active'), () => { s.active = k.key; s.changed(); }, { small: true, title: t('opple.ui.activeTitle') }),
        iconButton('✕', t('opple.ui.forget'), () => s.forget(k.key), { small: true }),
        h('div', { class: 'val' }, st === 'connected' && r ? `${de(r.lux, r.lux < 10 ? 1 : 0)} ${r.quantity ?? 'lx'} · ${de(r.cct, 0)} K · Duv ${sgn(r.duv, 4)}` : `${k.driver === 'argyll' ? `${DRIVER_LABELS.argyll} ${t('opple.ui.unverified')}` : `${k.name}${k.model ? ` · ${k.model === 'lm4' ? 'LM4' : 'LM3'}` : ''}`}${m?.message && st !== 'connected' ? ` · ${m.message}` : ''}`));
    });
    devices.replaceChildren(...(rows.length ? [kicker(t('opple.ui.devices')), ...rows] : []));
  }

  function render() {
    renderDevices();
    const act = s.meters.get(s.active);
    const r = s.latest(s.active) ?? s.latest();
    vals.replaceChildren(
      cell(r?.quantity === 'cd/m²' ? t('opple.ui.cdNoAmbient') : 'Lux', r ? de(r.lux, r.lux < 10 ? 2 : 0) : '–'),
      cell('CCT K (McCamy)', r ? de(r.cct, 0) : '–'),
      cell('Duv (Ohno)', r ? de(r.duv, 4) : '–'),
      cell('x / y (CIE 1931)', r ? `${de(r.x, 4)} / ${de(r.y, 4)}` : '–'),
    );
    info.textContent = r
      ? `${s.label(r.device ?? '')} · ${r.model === 'argyll' ? 'ArgyllCMS' : r.model === 'datei' /* lang-ok: driver id */ ? t('opple.ui.fromFile') : r.model === 'lm4' ? 'Light Master 4' : `Light Master 3${r.mode ? `, Matrix ${LM3_MODE_NAMES[r.mode]}` : ''}`}${r.spectrum ? ` · ${t('opple.ui.spectrumN', { n: r.spectrum.values.length })}` : ''}${r.cri ? ` · Ra ${de(r.cri.ra, 1)}` : ''} · ${r.model === 'lm3' || r.model === 'lm4' ? (r.calibrated ? t('opple.ui.withCal') : t('opple.ui.withoutCal')) : t('opple.ui.deviceValues')}${r.temperature != null ? ` · ${de(r.temperature, 1)} °C` : ''} · ${t('opple.ui.historyN', { n: s.history.length })}`
      : '';
    const anyConnected = s.connected.length > 0;
    const scanning = [...s.meters.values()].some((m) => m.state === 'requesting' || m.state === 'connecting' || m.state === 'calibrating');
    buttons.replaceChildren(
      ...[
        button(anyConnected ? t('opple.ui.searchMore') : t('opple.ui.search'), () => connect(s.connectNew()), { variant: 'primary', disabled: !sup.ok || scanning, title: NO_PAIRING_HINT }),
        anyConnected && button(s.running ? t('opple.ui.pause') : t('opple.ui.run'), () => s.setRunning(!s.running)),
        hooks.openScopes && button(t('opple.ui.scopes'), () => hooks.openScopes!(), { title: t('opple.ui.scopesTitle') }),
        s.history.length > 0 && button('⤓ CSV', () => download(`${t('opple.file.prefix')}-${stamp()}.csv`, readingsCsv(s.history)), { title: t('opple.ui.csvTitle') }),
        s.history.length > 0 && button(t('opple.ui.clearHistory'), () => { s.history.length = 0; s.changed(); }),
        !!act?.frames.length && button(t('opple.ui.raw'), () => navigator.clipboard?.writeText(act.frames.join('\n')), { title: t('opple.ui.rawTitle') }),
      ].filter((b): b is HTMLButtonElement => !!b),
    );
    const msg = s.message || act?.message || '';
    status.textContent = msg || (sup.ok ? (anyConnected ? '' : [NO_PAIRING_HINT, sup.reason].filter(Boolean).join(' ')) : sup.reason);
    status.classList.toggle('bad', act?.state === 'error' || !!s.message);
    renderPoints();
  }

  let label = '';
  function renderPoints() {
    const o = s.opts;
    const commit = () => { s.saveOpts(); s.changed(); };
    const can = s.connected.length > 0;
    const take = (grid: boolean) => { s.capture(label, grid).then(() => { label = ''; }).catch((e) => { s.message = (e as Error).message; s.changed(); }); };
    const cellName = `${String.fromCharCode(65 + o.cursor[1])}${o.cursor[0] + 1}`;
    const a = s.point(o.ref), b = s.point(o.cmp);
    const cmp = a && b && a !== b ? compareLights(a.reading, b.reading, o.gelMaker) : null;
    points.replaceChildren(
      kicker(t('opple.ui.pointsTitle')),
      row(
        textInput(label, (v) => { label = v; }, { placeholder: t('opple.ui.namePh'), live: true }),
        select(String(o.avg), [1, 3, 5, 10].map((n) => [String(n), `⌀ ${n}`] as [string, string]), (v) => { o.avg = Number(v); s.saveOpts(); }, t('opple.ui.avgTitle'))),
      row(
        button(t('opple.ui.point'), () => take(false), { disabled: !can, title: t('opple.ui.pointTitle') }),
        button(t('opple.ui.cell', { cell: cellName }), () => take(true), { disabled: !can, title: t('opple.ui.cellTitle') }),
        iconButton('→', t('opple.ui.skipCell'), () => s.advance(), { small: true })),
      row(t('opple.ui.grid'), numberInput(o.cols, (n) => { o.cols = n; commit(); }, { min: 1, max: 12, clamp: true, size: 's' }), '×',
        numberInput(o.rows, (n) => { o.rows = n; commit(); }, { min: 1, max: 26, clamp: true, size: 's' }),
        h('span', { class: 'hint' }, t('opple.ui.gridHint'))),
      s.points.length ? h('table', {},
        h('tr', {}, h('td', {}, ''), h('td', {}, 'Ref'), h('td', {}, 'B'), h('td', { class: 'n' }, 'lx'), h('td', { class: 'n' }, 'K'), h('td', { class: 'n' }, 'Duv'), h('td', {}, '')),
        ...s.points.map((p) => h('tr', {},
          h('td', {}, p.label),
          h('td', {}, h('input', { type: 'radio', name: 'opple-ref', checked: p.id === o.ref, title: t('opple.ui.refTitle'), onchange: () => { o.ref = p.id; s.saveOpts(); s.changed(); } })),
          h('td', {}, h('input', { type: 'radio', name: 'opple-cmp', checked: p.id === o.cmp, title: t('opple.ui.cmpTitle'), onchange: () => { o.cmp = p.id; s.saveOpts(); s.changed(); } })),
          h('td', { class: 'n' }, de(p.reading.lux, p.reading.lux < 10 ? 1 : 0)), h('td', { class: 'n' }, de(p.reading.cct, 0)), h('td', { class: 'n' }, sgn(p.reading.duv, 3)),
          h('td', {}, iconButton('✕', t('opple.ui.deletePoint'), () => s.removePoint(p.id), { small: true }))))) : '',
      cmp ? h('div', { class: 'cmp' },
        h('b', {}, `${a!.label} (A) → ${b!.label} (B)`), h('br'),
        t('opple.ui.cmpLine', { duv: de(cmp.duv, 4), a: de(cmp.cctA, 0), b: de(cmp.cctB, 0), stops: sgn(cmp.stops, 2) }), h('br'),
        `${t('opple.ui.miredFix', { v: sgn(cmp.shift, 0) })} `,
        select(o.gelMaker, [['Lee', 'Lee'], ['Rosco', 'Rosco']], (v) => { o.gelMaker = v as 'Lee' | 'Rosco'; s.saveOpts(); s.changed(); }), h('br'),
        ...(cmp.gels.length ? cmp.gels.map((g, i) => h('span', {}, t('opple.ui.gelLine', { i: i + 1, gels: g.gels.map((x) => x.name).join(' + '), m: sgn(g.mired, 0), k: de(g.resultK, 0), rest: sgn(g.residual, 0) }), h('br'))) : [t('opple.ui.noGel'), h('br')]),
        greenMagentaHint(cmp.dDuv, cmp.cctB), h('br'),
        h('span', { class: 'hint' }, t('opple.ui.gelSources'))) : '',
      s.points.length ? row(
        button(t('opple.ui.pointsCsv'), () => download(`${t('opple.file.prefix')}-${t('opple.file.points')}-${stamp()}.csv`, pointsCsv(s)), { small: true }),
        button(t('opple.ui.clearPoints'), () => s.clearPoints(), { small: true })) : '',
    );
  }

  function drawChart() {
    const ctx = chart.getContext('2d')!, W = chart.width, H = chart.height;
    const pts = s.history.filter((r) => !s.active || r.device === s.active).slice(-120);
    ctx.clearRect(0, 0, W, H);
    if (pts.length < 2) return;
    const max = Math.max(...pts.map((p) => p.lux), 1e-6);
    ctx.strokeStyle = '#8cff9e'; ctx.beginPath();
    pts.forEach((p, i) => { const x = (i / (pts.length - 1)) * (W - 1), y = H - 2 - (p.lux / max) * (H - 4); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.fillStyle = '#888'; ctx.font = '10px system-ui'; ctx.fillText(`max ${de(max, 0)} lx`, 2, 10);
  }

  let queued = false;
  s.addEventListener('change', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      // don't rebuild while typing a name
      const f = document.activeElement;
      if (f && root.contains(f) && f.tagName === 'INPUT' && (f as HTMLInputElement).type !== 'radio') { drawChart(); return; }
      render(); drawChart();
    });
  });

  root.replaceChildren(
    h('p', { class: 'warnbox' }, t('opple.ui.tested')),
    buttons, pickerBox(s), status, devices, vals, chart, info, points, otherMeters(s, () => render()),
    hint(`${t('opple.ui.footer')}${desktopBluetooth() ? '' : ` ${t('opple.ui.footerBrowser')}`}`),
  );
  render();
}

/** Captured points as CSV (comma, dot decimals). */
export function pointsCsv(s: LightStore) {
  const f = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d) : '');
  const r0 = s.point(s.opts.ref);
  return [
    `# ${t('opple.csv.pointsHead')}`,
    // column names: stable English ids, independent of the UI language
    'point,cell,device,time,lux,x,y,cct_k,duv,du_v_ref',
    ...s.points.map((p) => {
      const r: Reading = p.reading;
      const d = r0 ? compareLights(r0.reading, r).duv : NaN;
      return [`"${p.label.replace(/"/g, '""')}"`, p.cell ? `${String.fromCharCode(65 + p.cell[1])}${p.cell[0] + 1}` : '', `"${s.label(r.device ?? '')}"`, new Date(r.ts).toISOString(), f(r.lux, 2), f(r.x, 5), f(r.y, 5), f(r.cct, 0), f(r.duv, 5), f(d, 5)].join(',');
    }),
  ].join('\n') + '\n';
}

/** Other light meters: ArgyllCMS spectrometers/colorimeters (bridge) and spectrum files. */
function otherMeters(s: LightStore, done: () => void): HTMLElement {
  const box = h('details', { class: 'hint' });
  let unit: SpectrumUnit = 'relativ';
  let ports: { port: number; name: string }[] = [];
  let info = '';
  const render = () => {
    box.replaceChildren(
      h('summary', {}, t('opple.ui.others')),
      h('p', {}, t('opple.ui.othersHint')),
      row(
        select(sel ? String(sel) : '', [['', ports.length ? t('opple.ui.firstDevice') : t('opple.ui.deviceLoad')], ...ports.map((p): [string, string] => [String(p.port), `${p.port}: ${p.name}`])], (v) => { sel = Number(v) || undefined; }),
        button(t('opple.ui.list'), () => {
          fetch(`${s.bridgeWs().replace(/^ws/, 'http')}/api/meter`).then((r) => r.json()).then((m: { found: boolean; instruments: { port: number; name: string }[]; version?: string }) => {
            ports = m.instruments ?? []; info = m.found ? t('opple.ui.argyllFound', { v: m.version ?? '', n: ports.length }) : t('opple.ui.argyllMissing'); render();
          }).catch(() => { info = t('opple.ui.noBridge'); render(); });
        }, { small: true, title: t('opple.ui.listTitle') }),
        button(t('opple.ui.connect'), () => { s.connectArgyll(sel).then(() => s.setRunning(true)).catch(() => {}).finally(done); }, { small: true })),
      info ? h('p', {}, info) : '',
      h('p', {}, t('opple.ui.fileHint')),
      row(
        select(unit, ([['relativ', t('opple.ui.unitRel')], ['mW/(m²·nm)', t('opple.ui.unitIrr')], ['mW/(m²·sr·nm)', t('opple.ui.unitRad')]] as [SpectrumUnit, string][]), (v) => { unit = v as SpectrumUnit; }, t('opple.ui.unitTitle')),
        spectrumFile.input, button(t('opple.ui.spectrumFile'), () => spectrumFile.pick(), { small: true })),
    );
  };
  let sel: number | undefined;
  const spectrumFile = filePicker('.sp,.csv,.txt,.tsv', async ([f]) => {
    try { s.importSpectrum(await f.text(), f.name, unit); s.message = ''; } catch (err) { s.message = (err as Error).message; s.changed(); }
  });
  render();
  return box;
}
