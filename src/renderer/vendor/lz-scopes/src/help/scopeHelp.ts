// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Scope help (Help → Show scope help): a "?" in every panel head opens a short card – what the
// scope is, what it is for, how to read it, one small task to try with the test pattern or a
// camera, and a common pitfall. Tasks can be ticked off; the count shows what is left to try.
// Texts: src/i18n/<lang>/help.ts, checked against the sources in docs/research/scope-hilfe.md.

import { checkbox, h, hint, popover, type Kid } from '../ui';
import { hasKey, t, type Key } from '../i18n';
import type { ScopeType } from '../graticule';

const ON_KEY = 'lz-scopes.help';
const DONE_KEY = 'lz-scopes.help.done';

export function helpOn(): boolean {
  try { return localStorage.getItem(ON_KEY) !== '0'; } catch { return true; }
}
export function setHelpOn(on: boolean) {
  try { localStorage.setItem(ON_KEY, on ? '1' : '0'); } catch { /* private mode */ }
}

function doneSet(): Set<string> {
  try { const v = JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]'); return new Set(Array.isArray(v) ? v.map(String) : []); } catch { return new Set(); }
}
function setDone(scope: string, on: boolean) {
  const s = doneSet(); if (on) s.add(scope); else s.delete(scope);
  try { localStorage.setItem(DONE_KEY, JSON.stringify([...s])); } catch { /* private mode */ }
}

const k = (scope: string, part: string) => `help.${scope}.${part}` as Key;
/** Scopes with a help text (the "?" appears only there). */
export const hasHelp = (scope: ScopeType | string) => hasKey(k(scope, 'one'));

/** All scopes that have a task, for the progress count. */
export function helpScopes(all: readonly string[]) { return all.filter((s) => hasKey(k(s, 'try'))); }

/** Rows of the help card for one scope (rebuilt each time the popover opens). */
export function helpCard(scope: ScopeType | string, all: readonly string[]): Kid[] {
  if (!hasHelp(scope)) return [hint(t('help.none'))];
  const lines = (part: string) => (hasKey(k(scope, part)) ? t(k(scope, part)).split('\n').filter(Boolean) : []);
  const done = doneSet();
  const tasks = helpScopes(all);
  const progress = h('p', { class: 'hint help-progress' }, t('help.progress', { done: tasks.filter((s) => done.has(s)).length, all: tasks.length }));
  // short first (#256): the two sentences "what is it" and "what for"; reading, task and pitfall fold out
  const what = lines('what');
  const firstSentence = (s: string) => /^(.+?[.!?])(\s|$)/.exec(s)?.[1] ?? s;
  return [
    h('p', { class: 'help-one' }, t(k(scope, 'one'))),
    what.length ? h('p', {}, firstSentence(what[0])) : null,
    lines('read').length || what.length ? h('details', { class: 'help-more' },
      h('summary', {}, t('help.read')),
      ...(what.length && firstSentence(what[0]) !== what.join('\n') ? [h('p', {}, what.join(' ').slice(firstSentence(what[0]).length).trim())] : []),
      lines('read').length ? h('ul', { class: 'help-list' }, ...lines('read').map((l) => h('li', {}, l))) : null,
      hasKey(k(scope, 'pitfall')) ? h('p', { class: 'help-pitfall' }, h('strong', {}, t('help.pitfall')), ' ', t(k(scope, 'pitfall'))) : null) : null,
    hasKey(k(scope, 'try')) ? h('details', { class: 'help-try' },
      h('summary', {}, t('help.try')),
      h('p', {}, t(k(scope, 'try'))),
      hasKey(k(scope, 'check')) ? h('p', { class: 'hint' }, t('help.checkPrefix'), ' ', t(k(scope, 'check'))) : null,
      checkbox(done.has(scope), t('help.done'), (v) => { setDone(scope, v); const n = doneSet(); progress.textContent = t('help.progress', { done: tasks.filter((s) => n.has(s)).length, all: tasks.length }); }),
      tasks.length ? progress : null) : null,
  ].filter(Boolean) as Kid[];
}

/**
 * "?" for a tool inside a dialog (LED wall finders, …): the same card as in a panel head, keyed
 * help.<id>.*; nothing when the help is switched off or the id has no text.
 */
export function toolHelp(id: string, title: string): HTMLElement | null {
  if (!helpOn() || !hasHelp(id)) return null;
  return popover({ label: '?', title: t('help.open', { scope: title }), heading: title, align: 'end', cls: 'scopehelp', triggerCls: 'icon pop-trigger help-trigger', content: () => helpCard(id, []) });
}
