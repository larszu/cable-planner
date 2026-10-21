// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Declarative controls (docs/architecture/ui.md). One builder per pattern; the look lives in
// src/ui/components.css. Labels and titles are passed in already translated (t(...)).

import { h, type Attrs, type Kid } from './dom';

export type Option = readonly [value: string, label: string];
/** Option groups; a group named '' puts its options at the top level. */
export type OptionGroup = readonly [group: string, options: readonly Option[]];

const options = (value: string, list: readonly Option[]) => list.map(([v, l]) => h('option', { value: v, selected: v === value }, l));

/** <select> with [value, label] options. */
export function select(value: string, list: readonly Option[], onChange: (v: string) => void, title = '', attrs: Attrs = {}) {
  return h('select', { title: title || null, ...attrs, onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) }, options(value, list));
}

/** <select> with <optgroup>s. */
export function groupedSelect(value: string, groups: readonly OptionGroup[], onChange: (v: string) => void, title = '', attrs: Attrs = {}) {
  return h('select', { title: title || null, ...attrs, onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
    groups.map(([g, list]) => (g ? h('optgroup', { label: g }, options(value, list)) : options(value, list))));
}

export interface NumberOpts {
  min?: number; max?: number; step?: number | string; title?: string; placeholder?: string;
  /** keep the value inside min…max */
  clamp?: boolean;
  /** width class: s (44 px), m (56 px, default), l (72 px), xl (96 px) */
  size?: 's' | 'm' | 'l' | 'xl';
  /** fire while typing/spinning instead of on commit */
  live?: boolean;
  attrs?: Attrs;
}

/** Number field; onChange gets finite numbers only. */
export function numberInput(value: number | '', onChange: (v: number) => void, o: NumberOpts = {}) {
  const i = h('input', {
    type: 'number', class: `num num-${o.size ?? 'm'}`, min: o.min, max: o.max, step: o.step ?? 1, value,
    title: o.title || null, placeholder: o.placeholder || null, inputmode: 'decimal', ...o.attrs,
  });
  const fire = () => {
    // an empty field counts as 0, as everywhere before (Number(''))
    let v = Number(i.value);
    if (!Number.isFinite(v)) return;
    if (o.clamp) v = Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, v));
    onChange(v);
  };
  if (o.live) i.oninput = fire; else i.onchange = fire;
  return i;
}

/** Checkbox with its text, as one clickable label. */
export function checkbox(on: boolean, label: Kid, onChange: (v: boolean) => void, title = '', attrs: Attrs = {}) {
  const c = h('input', { type: 'checkbox', checked: on, ...attrs });
  c.onchange = () => onChange(c.checked);
  return h('label', { class: 'check', title: title || null }, c, label);
}

export interface SliderOpts {
  min: number; max: number; step: number; title?: string;
  /** value a double click (or the reset button) returns to */
  reset?: number;
  /** number field next to the slider, with this unit after it */
  number?: boolean; unit?: string;
  attrs?: Attrs;
}

/** Range slider, optionally with number field, unit and reset (double click). */
export function slider(value: number, onInput: (v: number) => void, o: SliderOpts) {
  const r = h('input', { type: 'range', min: o.min, max: o.max, step: o.step, value, title: o.title || null, ...o.attrs });
  const n = o.number ? numberInput(value, (v) => { r.value = String(v); onInput(v); }, { min: o.min, max: o.max, step: o.step, clamp: true, size: 's', live: true }) : null;
  const set = (v: number) => { r.value = String(v); if (n) n.value = String(v); onInput(v); };
  r.oninput = () => { if (n) n.value = r.value; onInput(Number(r.value)); };
  if (o.reset !== undefined) r.ondblclick = () => set(o.reset!);
  if (!n && !o.unit) return r;
  return h('span', { class: 'slider' }, r, n, o.unit ? h('span', { class: 'unit' }, o.unit) : null);
}

/** Colour well (sRGB hex). */
export function colour(value: string, onChange: (hex: string) => void, title = '', live = false) {
  const c = h('input', { type: 'color', value, title: title || null });
  if (live) c.oninput = () => onChange(c.value); else c.onchange = () => onChange(c.value);
  return c;
}

/** Single-line text field. */
export function textInput(value: string, onChange: (v: string) => void, o: { placeholder?: string; title?: string; mono?: boolean; live?: boolean; onEnter?: (v: string) => void; attrs?: Attrs } = {}) {
  const i = h('input', { value, placeholder: o.placeholder || null, title: o.title || null, spellcheck: 'false', class: o.mono ? 'mono grow' : 'grow', ...o.attrs });
  if (o.live) i.oninput = () => onChange(i.value); else i.onchange = () => onChange(i.value);
  if (o.onEnter) i.onkeydown = (e) => { if (e.key === 'Enter') o.onEnter!(i.value); };
  return i;
}

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
export interface ButtonOpts {
  title?: string; variant?: ButtonVariant;
  /** small (inline, in lists) */
  small?: boolean;
  /** toggle button: aria-pressed and the "on" look */
  pressed?: boolean;
  disabled?: boolean;
  attrs?: Attrs;
}

/** Text button. */
export function button(label: Kid, onClick: (e: MouseEvent) => void, o: ButtonOpts = {}) {
  const cls = ['btn', o.variant && o.variant !== 'default' ? o.variant : '', o.small ? 'mini' : '', o.pressed ? 'on' : ''];
  return h('button', {
    type: 'button', class: cls, title: o.title || null, disabled: !!o.disabled,
    ...(o.pressed !== undefined ? { 'aria-pressed': o.pressed } : {}), ...o.attrs, onclick: onClick,
  }, label);
}

/** Icon-only button: the glyph is decorative, `label` names it for screen readers and the tooltip. */
export function iconButton(glyph: string, label: string, onClick: (e: MouseEvent) => void, o: ButtonOpts = {}) {
  const b = button(h('span', { 'aria-hidden': 'true' }, glyph), onClick, { ...o, title: o.title ?? label });
  b.classList.add('icon');
  b.setAttribute('aria-label', label);
  return b;
}

/** Segmented control: one choice of a few, as pressed buttons (layout presets, modes). */
export function segmented(value: string, list: readonly (Option | readonly [string, string, string])[], onChange: (v: string) => void, label = '') {
  return h('div', { class: 'seg', role: 'group', 'aria-label': label || null },
    list.map(([v, l, title]) => button(l, () => onChange(v), { pressed: v === value, title })));
}

/** Label + controls in one row (the settings form row). One control: a <label>; several: a labelled group. */
export function field(label: Kid, ...controls: Kid[]) {
  const flat = controls.flat(Infinity as 1).filter((c) => c instanceof Element) as Element[];
  const single = flat.length === 1 && flat[0].matches('input, select, textarea');
  return h(single ? 'label' : 'div', { class: 'field', ...(single ? {} : { role: 'group' }) }, h('span', { class: 'field-label' }, label), ...controls);
}

/** Inline label: text before a control (compact rows in tools). */
export const inlineLabel = (text: Kid, ...kids: Kid[]) => h('label', { class: 'inline' }, text, ...kids);

/** Wrapping cluster of controls (button rows, compact control lines). */
export const row = (...kids: Kid[]) => h('div', { class: 'row' }, ...kids);
export const toolbar = (label: string, ...kids: Kid[]) => h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': label || null }, ...kids);
/** Secondary text below a control. */
export const hint = (...kids: Kid[]) => h('p', { class: 'hint' }, ...kids);
/** Section head: kicker with rule (one per area). */
export const kicker = (text: Kid, level: 'h2' | 'h3' = 'h3') => h(level, { class: 'kicker' }, text);
export const section = (title: Kid, ...kids: Kid[]) => h('section', { class: 'section' }, kicker(title), ...kids);
/** Collapsible section (<details>). */
export function disclosure(summary: Kid, kids: Kid[], o: { open?: boolean; cls?: string; title?: string } = {}) {
  return h('details', { class: ['disclosure', o.cls], open: !!o.open }, h('summary', { title: o.title || null }, summary), ...kids);
}
/** Small status chip; tone 'warn' | 'ok' | 'bad' only as a sign, never as a large area. */
export const chip = (text: Kid, o: { tone?: 'ok' | 'warn' | 'bad'; title?: string; cls?: string; attrs?: Attrs } = {}) =>
  h('span', { class: ['chip', o.tone, o.cls], title: o.title || null, ...o.attrs }, text);
/** Status dot (idle, live, connecting, error). */
export const statusDot = (status: string, title = status) => h('span', { class: 'dot', 'data-status': status, title });
/** Table from rows of cells; the first row can be a head. */
export function table(rows: Kid[][], o: { head?: Kid[]; cls?: string; attrs?: Attrs } = {}) {
  return h('table', { class: ['table', o.cls], ...o.attrs },
    o.head ? h('thead', {}, h('tr', {}, o.head.map((c) => h('th', {}, c)))) : null,
    h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))));
}
