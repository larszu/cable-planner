// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Popover (docs/architecture/ui.md): one implementation for the panel ⚙ menus, the header
// overflow menu and other small option panels. Native `popover="auto"` puts the panel in the
// top layer (no clipping by the dock), closes it on Esc and outside clicks and keeps only one
// open. Here: positioning next to the trigger, clamped to the viewport, and a bottom sheet on
// narrow screens (CSS: .popover.sheet).

import { h, type Kid } from './dom';

/** Narrow screens and phones get bottom sheets instead of anchored popovers. */
export const SHEET_QUERY = '(max-width: 640px), (pointer: coarse) and (max-height: 500px)';
export const isSheet = () => typeof matchMedia === 'function' && matchMedia(SHEET_QUERY).matches;

export interface PopoverOpts {
  /** trigger content (glyph or text) */
  label: Kid;
  /** accessible name and tooltip of the trigger */
  title: string;
  /** heading inside the panel */
  heading?: Kid;
  /** rows, built each time the popover opens */
  content: () => Kid[];
  align?: 'start' | 'end';
  cls?: string;
  /** trigger class (default: icon button) */
  triggerCls?: string;
}

export interface PopoverEl extends HTMLElement {
  open(): void;
  close(): void;
  /** rebuild the rows of an open popover (state changed, rows appear or disappear) */
  refresh(): void;
  readonly isOpen: boolean;
  readonly panel: HTMLElement;
}

let seq = 0;

export interface PlaceOpts {
  /** below (or above) the anchor, or beside it (submenus: right, flips to the left) */
  side?: 'below' | 'right';
  align?: 'start' | 'end';
  /** bottom sheet on narrow screens (option panels); menus stay anchored */
  sheet?: boolean;
}

/**
 * Place a top-layer `panel` at `anchor`: flip to the other side when the preferred one is too
 * small, clamp into the viewport (8 px margin) and cap the height so long menus scroll inside.
 * One routine for popovers, menu bar menus and submenus.
 */
export function place(panel: HTMLElement, anchor: DOMRect, o: PlaceOpts = {}) {
  if (o.sheet !== false && isSheet()) { panel.classList.add('sheet'); panel.style.cssText = ''; return; }
  panel.classList.remove('sheet');
  const vw = innerWidth, vh = innerHeight, m = 8;
  const s = panel.style;
  s.position = 'fixed'; s.margin = '0'; s.right = 'auto'; s.bottom = 'auto';
  s.maxWidth = `${vw - 2 * m}px`;
  if (o.side === 'right') {
    s.maxHeight = `${vh - 2 * m}px`;
    const w = Math.min(panel.offsetWidth || 240, vw - 2 * m), hgt = Math.min(panel.offsetHeight || 200, vh - 2 * m);
    const right = anchor.right - 2, left = anchor.left - w + 2;
    const x = right + w <= vw - m ? right : left >= m ? left : vw - m - w;
    s.left = `${Math.round(Math.max(m, x))}px`;
    s.top = `${Math.round(Math.max(m, Math.min(vh - m - hgt, anchor.top - 5)))}px`;
    return;
  }
  const below = vh - anchor.bottom - m, above = anchor.top - m;
  const hgt = panel.offsetHeight || 220;
  const up = hgt > below && above > below;
  s.maxHeight = `${Math.max(120, (up ? above : below) - 4)}px`;
  if (up) { s.top = 'auto'; s.bottom = `${vh - anchor.top + 4}px`; } else s.top = `${anchor.bottom + 4}px`;
  // horizontal: after layout we know the width; keep it inside the viewport
  const w = Math.min(panel.offsetWidth || 320, vw - 2 * m);
  const left = o.align === 'end' ? anchor.right - w : anchor.left;
  s.left = `${Math.round(Math.max(m, Math.min(vw - m - w, left)))}px`;
}

/** Place `panel` next to `anchor`, inside the viewport (8 px margin); bottom sheet on phones. */
export const placePopover = (panel: HTMLElement, anchor: DOMRect, align: 'start' | 'end' = 'start') => place(panel, anchor, { align });

/** Trigger button + popover panel. */
export function popover(o: PopoverOpts): PopoverEl {
  const id = `pop-${++seq}`;
  const panel = h('div', { class: ['popover', o.cls], id, popover: 'auto', role: 'dialog', 'aria-label': o.title });
  const trigger = h('button', { type: 'button', class: o.triggerCls ?? 'icon pop-trigger', title: o.title, 'aria-label': o.title, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', popovertarget: id }, o.label);
  const render = () => panel.replaceChildren(...(o.heading ? [h('div', { class: 'popover-head' }, o.heading)] : []), h('div', { class: 'popover-body' }, ...o.content().flat()));
  panel.addEventListener('beforetoggle', (e) => {
    if ((e as ToggleEvent).newState === 'open') { render(); trigger.setAttribute('aria-expanded', 'true'); } else trigger.setAttribute('aria-expanded', 'false');
  });
  panel.addEventListener('toggle', (e) => { if ((e as ToggleEvent).newState === 'open') placePopover(panel, trigger.getBoundingClientRect(), o.align); });
  // typing in the panel must not reach the global shortcuts (S, F, 1–6, Esc …)
  panel.addEventListener('keydown', (e) => e.stopPropagation());
  const wrap = h('span', { class: 'pop' }, trigger, panel) as unknown as PopoverEl;
  Object.defineProperties(wrap, {
    open: { value: () => { if (!panel.matches(':popover-open')) panel.showPopover(); } },
    close: { value: () => { if (panel.matches(':popover-open')) panel.hidePopover(); } },
    refresh: { value: () => { if (panel.matches(':popover-open')) { render(); placePopover(panel, trigger.getBoundingClientRect(), o.align); } } },
    isOpen: { get: () => panel.matches(':popover-open') },
    panel: { value: panel },
  });
  return wrap;
}
