// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// UI language (#94): English is the source language and the fallback, German the first
// translation. Pattern taken from cable-planner (English source, German dictionary,
// `npm run lang:check`), without a library: the app has a few hundred strings, plural rules and
// placeholders are a dozen lines on top of Intl.PluralRules.
//
//   t('lang.auto', { lang: 'Deutsch' })            → "Automatic (Deutsch)"
//   t('sources.count', { n: 3 })                    → plural form for 3
//
// The language comes from the saved choice (Settings → Interface), otherwise from the system:
// Electron app.getLocale() (handed over by the preload) or navigator.languages. Anything that
// is not German shows English. Switching reloads the window (setLangPref), so no module has to
// re-render its texts by itself.

import { de } from './de';
import { en, type Key } from './en';
import type { Msg, Plural } from './types';

export type { Key } from './en';
export type Lang = 'de' | 'en';
export type LangPref = 'auto' | Lang;
export type Params = Record<string, string | number>;

export const LANGS: Lang[] = ['en', 'de'];
/** Language names in their own language, as language pickers show them. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', de: 'Deutsch' };
const DICTS: Record<Lang, Record<Key, Msg>> = { en, de };
const PREF_KEY = 'lz-scopes.lang';

/** `de-AT`, `de_CH`, `German` … → de; everything else → en. */
export function toLang(tag: string | null | undefined): Lang | null {
  const s = (tag ?? '').trim().toLowerCase();
  if (!s) return null;
  return s.startsWith('de') ? 'de' : 'en';
}

type DesktopLocale = { lzsDesktop?: { locale?: string } };

/** System language: Electron's app locale, otherwise the browser's preferred languages. */
export function systemLang(): Lang {
  const g = globalThis as typeof globalThis & DesktopLocale;
  const fromApp = toLang(g.lzsDesktop?.locale);
  if (fromApp) return fromApp;
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  return toLang(nav?.languages?.[0] ?? nav?.language) ?? 'en';
}

export function langPref(): LangPref {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === 'de' || v === 'en' ? v : 'auto';
  } catch { return 'auto'; }
}

let current: Lang = langPref() === 'auto' ? systemLang() : (langPref() as Lang);
if (typeof document !== 'undefined') document.documentElement.lang = current;

/** The active UI language. */
export const lang = (): Lang => current;

/** Tests and the output windows: switch without reload or storage. */
export function setLang(l: Lang) {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

/** Save the choice and reload the window (sources and layout are persisted by main.ts). */
export function setLangPref(p: LangPref, reload = true) {
  try {
    if (p === 'auto') localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, p);
  } catch { /* storage unavailable: applies to this session only */ }
  const next = p === 'auto' ? systemLang() : p;
  if (next === current) return;
  setLang(next);
  if (reload && typeof location !== 'undefined') location.reload();
}

const plurals = new Map<Lang, Intl.PluralRules>();
function pickPlural(m: Plural, l: Lang, n: number): string {
  if (n === 0 && m.zero !== undefined) return m.zero;
  let pr = plurals.get(l);
  if (!pr) plurals.set(l, (pr = new Intl.PluralRules(l)));
  return pr.select(n) === 'one' ? m.one : m.other;
}

/** Replace `{name}` with params.name; unknown placeholders stay visible (a missing value shows). */
export function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (all, k: string) => (k in params ? String(params[k]) : all));
}

/** Translate in a given language (tests, output windows with their own language). */
export function tIn(l: Lang, key: Key, params?: Params): string {
  const m: Msg | undefined = DICTS[l][key] ?? en[key];
  if (m === undefined) return key;
  const text = typeof m === 'string' ? m : pickPlural(m, l, Number(params?.n ?? params?.count ?? 0));
  return fill(text, params);
}

/** Translate into the active UI language. Placeholders `{name}`; plurals pick by `n` (or `count`). */
export const t = (key: Key, params?: Params): string => tIn(current, key, params);

/** Is `key` a known message? For keys built at runtime (`stage.${id}`). */
export const hasKey = (key: string): key is Key => key in en;

/** Number in the UI language (decimal comma in German). */
export const num = (v: number, digits?: number): string =>
  v.toLocaleString(current === 'de' ? 'de-DE' : 'en-US', digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits });
