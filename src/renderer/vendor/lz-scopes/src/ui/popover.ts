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
/** Tablets (touch, wider than a phone, #185): option panels become a sheet over their scope panel. */
export const PANEL_SHEET_QUERY = '(pointer: coarse) and (min-width: 641px)';
const isPanelSheet = () => typeof matchMedia === 'function' && !isSheet() && matchMedia(PANEL_SHEET_QUERY).matches;

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
  /** open beside this rectangle instead of below the trigger (help card next to its panel, #256) */
  beside?: (trigger: HTMLElement) => DOMRect | null | undefined;
  /** on tablets: a sheet over the bottom of this rectangle (the scope panel) instead of anchored (#185) */
  over?: (trigger: HTMLElement) => DOMRect | null | undefined;
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
  panel.classList.remove('over');
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

/**
 * Sheet over a scope panel (tablets, #185): as wide as the panel (at least 320 px, 8 px off the
 * window edge), standing on its bottom edge and reaching up at most to just below the trigger
 * in the panel head, so the head stays visible and the ⚙ closes it again. The settings sit on
 * the scope they change instead of in a bar. Returns false when the panel is too short for a
 * useful sheet (below 160 px); the caller then anchors the popover at its trigger as usual.
 */
export function placeOver(panel: HTMLElement, r: DOMRect, trigger: DOMRect): boolean {
  const vw = innerWidth, vh = innerHeight, m = 8;
  const bottom = Math.min(r.bottom, vh - m), top = Math.max(m, trigger.bottom + 4);
  if (bottom - top < 160) return false;
  panel.classList.remove('sheet');
  panel.classList.add('over');
  const s = panel.style;
  // the panel's width inside the viewport margins; at least 320 px, shifted in when that is wider
  let left = Math.max(m, r.left);
  let w = Math.min(vw - m, r.right) - left;
  if (w < 320) { w = Math.min(320, vw - 2 * m); left = Math.max(m, Math.min(vw - m - w, left)); }
  s.position = 'fixed'; s.margin = '0'; s.top = 'auto'; s.right = 'auto';
  s.left = `${Math.round(left)}px`;
  s.width = `${Math.round(w)}px`; s.maxWidth = `${Math.round(w)}px`;
  s.bottom = `${Math.round(vh - bottom)}px`;
  s.maxHeight = `${Math.round(Math.min(bottom - top, vh * 0.75))}px`;
  return true;
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
  const placeIt = () => {
    const over = o.over && isPanelSheet() ? o.over(trigger) : null;
    if (over && placeOver(panel, over, trigger.getBoundingClientRect())) return;
    const r = o.beside?.(trigger);
    if (r) place(panel, r, { side: 'right' }); else placePopover(panel, trigger.getBoundingClientRect(), o.align);
  };
  panel.addEventListener('toggle', (e) => { if ((e as ToggleEvent).newState === 'open') placeIt(); });
  // typing in the panel must not reach the global shortcuts (S, F, 1–6, Esc …)
  panel.addEventListener('keydown', (e) => e.stopPropagation());
  const wrap = h('span', { class: 'pop' }, trigger, panel) as unknown as PopoverEl;
  Object.defineProperties(wrap, {
    open: { value: () => { if (!panel.matches(':popover-open')) panel.showPopover(); } },
    close: { value: () => { if (panel.matches(':popover-open')) panel.hidePopover(); } },
    refresh: { value: () => { if (panel.matches(':popover-open')) { render(); placeIt(); } } },
    isOpen: { get: () => panel.matches(':popover-open') },
    panel: { value: panel },
  });
  return wrap;
}
