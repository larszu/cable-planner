// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Schema-driven settings (docs/architecture/ui.md): one description per setting renders the
// same row in the settings window and in the panel ⚙ popovers, and validates values that
// arrive over the control API (command "setting", docs/control-api.md).

import { checkbox, field, hint, numberInput, select, type Option } from './controls';
import { h, type Kid } from './dom';

interface Base {
  /** stable key, also the name in the control API */
  key: string;
  label: () => string;
  title?: () => string;
  /** hint below the row (settings window only) */
  hint?: () => string;
}
export interface SelectSetting extends Base { kind: 'select'; options: () => readonly Option[]; get: () => string; set: (v: string) => void }
export interface NumberSetting extends Base { kind: 'number'; min: number; max: number; step?: number; unit?: string; get: () => number; set: (v: number) => void }
export interface ToggleSetting extends Base { kind: 'toggle'; text: () => string; get: () => boolean; set: (v: boolean) => void }
/** Two numbers in one row (a range lo–hi). */
export interface RangeSetting extends Base { kind: 'range'; min: number; max: number; unit?: string; get: () => [number, number]; set: (v: [number, number]) => void }
export type Setting = SelectSetting | NumberSetting | ToggleSetting | RangeSetting;

/** The control of one setting (without label). */
export const settingControl = (s: Setting): (Node | string)[] => controlKids(s).filter((k): k is Node | string => !!k);
function controlKids(s: Setting): Kid[] {
  const title = s.title?.() ?? '';
  switch (s.kind) {
    case 'select': return [select(s.get(), s.options(), (v) => s.set(v), title)];
    case 'number': return [numberInput(s.get(), (v) => s.set(v), { min: s.min, max: s.max, step: s.step ?? 1, title }), s.unit ? h('span', { class: 'unit' }, s.unit) : null];
    case 'toggle': return [checkbox(s.get(), s.text(), (v) => s.set(v), title)];
    case 'range': {
      const [lo, hi] = s.get();
      return [
        numberInput(lo, (v) => s.set([v, s.get()[1]]), { min: s.min, max: s.max, title }), '–',
        numberInput(hi, (v) => s.set([s.get()[0], v]), { min: s.min, max: s.max, title }), s.unit ? h('span', { class: 'unit' }, s.unit) : null,
      ];
    }
  }
}

/** Label + control row; `withHint` adds the hint below (settings window). */
export function settingRow(s: Setting, withHint = false): Kid[] {
  const r = field(s.label(), ...settingControl(s));
  return withHint && s.hint ? [r, hint(s.hint())] : [r];
}

export const settingsForm = (list: readonly Setting[], withHint = true): Node[] => list.flatMap((s) => settingRow(s, withHint)) as Node[];

/** Current value for the control API state. */
export const settingValue = (s: Setting): unknown => s.get();

/** Apply a value from outside (control API); throws with an English message when it does not fit. */
export function applySetting(s: Setting, raw: unknown) {
  const bad = (what: string) => new Error(`Setting ${s.key}: ${what}`);
  switch (s.kind) {
    case 'select': {
      const v = String(raw), opts = s.options().map(([k]) => k);
      if (!opts.includes(v)) throw bad(`one of ${opts.join(', ')}`);
      return s.set(v);
    }
    case 'number': {
      const v = Number(raw);
      if (!Number.isFinite(v) || v < s.min || v > s.max) throw bad(`number ${s.min}…${s.max}`);
      return s.set(v);
    }
    case 'toggle':
      if (typeof raw !== 'boolean' && raw !== 'on' && raw !== 'off') throw bad('true/false or on/off');
      return s.set(raw === true || raw === 'on');
    case 'range': {
      const v = Array.isArray(raw) ? raw.map(Number) : [];
      if (v.length !== 2 || v.some((x) => !Number.isFinite(x) || x < s.min || x > s.max)) throw bad(`[lo, hi] in ${s.min}…${s.max}`);
      return s.set([Math.min(v[0], v[1]), Math.max(v[0], v[1])]);
    }
  }
}

/** Describe the settings for the control API (GET state): key, kind, choices or range. */
export function describeSettings(list: readonly Setting[]) {
  return list.map((s) => ({
    key: s.key, kind: s.kind, label: s.label(), value: s.get(),
    ...(s.kind === 'select' ? { options: s.options().map(([v]) => v) } : {}),
    ...(s.kind === 'number' || s.kind === 'range' ? { min: s.min, max: s.max } : {}),
  }));
}
