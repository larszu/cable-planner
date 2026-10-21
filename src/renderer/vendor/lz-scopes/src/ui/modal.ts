// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Modal dialog (docs/architecture/ui.md): one native <dialog> pattern for the settings window,
// tool dialogs (layouts, outputs, LUT library, window picker, manual, calibration, LED tool,
// test media). showModal() makes the rest of the page inert (focus stays inside), Esc closes,
// a click on the backdrop closes. On narrow screens the dialog becomes a full-screen sheet
// (CSS: dialog.modal at max-width 640px).

import { h, restoreFocus, type Kid } from './dom';
import { t } from '../i18n';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalOpts {
  title: Kid;
  id?: string;
  /** extra class (feature hook, e.g. 'settings', 'calib') */
  cls?: string;
  size?: ModalSize;
  body?: Kid[];
  /** buttons in the footer */
  actions?: Kid[];
  onClose?: () => void;
  /** remove from the DOM when closed (one-shot dialogs) */
  removeOnClose?: boolean;
  /** the backdrop click does not close (long forms, running measurements) */
  sticky?: boolean;
  /** extra content in the head, before the close button */
  headExtra?: Kid[];
}

export interface Modal {
  dlg: HTMLDialogElement;
  head: HTMLElement;
  body: HTMLElement;
  foot: HTMLElement;
  open(): void;
  close(): void;
  setBody(...kids: Kid[]): void;
}

export function modal(o: ModalOpts): Modal {
  const title = h('h2', { class: 'modal-title' }, o.title);
  const close = h('button', { type: 'button', class: 'icon', title: t('common.closeEsc'), 'aria-label': t('common.close'), onclick: () => dlg.close() }, h('span', { 'aria-hidden': 'true' }, '✕'));
  const head = h('div', { class: 'modal-head' }, title, ...(o.headExtra ?? []), close);
  // the body takes the initial focus (no focus ring on the close button when the dialog opens)
  const body = h('div', { class: 'modal-body', tabindex: -1, autofocus: true }, ...(o.body ?? []));
  const foot = h('div', { class: 'modal-foot', hidden: !o.actions?.length }, ...(o.actions ?? []));
  const dlg = h('dialog', { class: ['modal', `modal-${o.size ?? 'md'}`, o.cls], id: o.id || null }, head, body, foot);
  dlg.setAttribute('aria-labelledby', (title.id = `${o.id ?? 'dlg'}-title-${Math.random().toString(36).slice(2, 7)}`));
  // keys typed in a dialog must not trigger the global shortcuts (S, F, 1–6 …); Esc closes it
  dlg.addEventListener('keydown', (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
  if (!o.sticky) dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  // focus back to the opener (the browser does it when it can; a menu item or a popover row is gone by now)
  let opener: Element | null = null;
  dlg.addEventListener('close', () => { o.onClose?.(); if (o.removeOnClose) dlg.remove(); requestAnimationFrame(() => restoreFocus(opener)); });
  return {
    dlg, head, body, foot,
    open: () => { if (!dlg.isConnected) document.body.append(dlg); if (!dlg.open) { opener = document.activeElement; dlg.showModal(); } },
    close: () => dlg.close(),
    setBody: (...kids) => body.replaceChildren(...kids.flat(Infinity as 1).filter((k) => k !== null && k !== undefined && k !== false && k !== '') as (Node | string)[]),
  };
}

/** One-shot dialog: built, opened, removed when closed. */
export function openModal(o: Omit<ModalOpts, 'removeOnClose'>): Modal {
  const m = modal({ ...o, removeOnClose: true });
  m.open();
  return m;
}
