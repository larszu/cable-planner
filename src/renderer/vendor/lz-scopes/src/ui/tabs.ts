// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Tabs (WAI-ARIA tablist): settings categories, tool pages. Arrow keys move and select,
// Home/End jump. The panel itself is up to the caller (role="tabpanel").

import { h } from './dom';

export interface TabItem { id: string; label: string; title?: string }

export function tabs(o: { items: readonly TabItem[]; current: string; onSelect: (id: string) => void; label?: string; orientation?: 'vertical' | 'horizontal'; cls?: string }) {
  const vertical = o.orientation === 'vertical';
  const list = h('div', { class: ['tabs', vertical ? 'tabs-v' : 'tabs-h', o.cls], role: 'tablist', 'aria-orientation': vertical ? 'vertical' : 'horizontal', 'aria-label': o.label || null },
    o.items.map((it) => h('button', {
      type: 'button', class: ['tab', it.id === o.current ? 'on' : ''], role: 'tab', 'aria-selected': it.id === o.current,
      tabindex: it.id === o.current ? 0 : -1, title: it.title || null, 'data-page': it.id, onclick: () => o.onSelect(it.id),
    }, it.label)));
  list.addEventListener('keydown', (e) => {
    const next = vertical ? 'ArrowDown' : 'ArrowRight', prev = vertical ? 'ArrowUp' : 'ArrowLeft';
    if (![next, prev, 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    // from the focused tab (it can differ from the selected one), otherwise from the selected
    const from = (e.target as HTMLElement).closest<HTMLElement>('[role=tab]')?.dataset.page ?? o.current;
    const i = o.items.findIndex((x) => x.id === from), n = o.items.length;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === next ? 1 : -1) + n) % n;
    o.onSelect(o.items[j].id);
    (list.isConnected ? list : document).querySelector<HTMLElement>(`[role=tab][data-page="${o.items[j].id}"]`)?.focus();
  });
  return list;
}
