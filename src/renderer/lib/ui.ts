/**
 * UI token sheet — a single source of truth for button styles, focus
 * rings and panel chrome. Used everywhere instead of repeating
 * Tailwind class chains so the visual language stays consistent
 * across the 14+ dialogs and the topbar.
 *
 * Token system (kept tight — only what's used in two or more places):
 *   • primary  → sky-7 background, white text, focus-sky-300
 *   • secondary → slate-7 background, slate-100 text
 *   • danger   → red-7 background, white text, focus-red-300
 *   • ghost    → transparent, slate-300 text, hover slate-800
 *   • chip     → small rounded square chip (toolbar dividers, version chip)
 *   • iconBtn  → square 28×28 icon button (close, collapse, …)
 *
 * Sizes:
 *   • sm = px-2 py-1 text-xs
 *   • md = px-3 py-1.5 text-xs (default)
 *   • lg = px-4 py-2 text-sm
 *
 * Focus ring on every button: `focus-visible:outline-none
 * focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2
 * focus-visible:ring-offset-slate-900` — paste once per token,
 * applied everywhere.
 */

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900'

const DISABLED = 'disabled:cursor-not-allowed disabled:opacity-50'

const SIZE_MD = 'px-3 py-1.5 text-xs'

export const btn = {
  primary: `inline-flex items-center justify-center gap-1 rounded bg-sky-700 ${SIZE_MD} font-medium text-white transition-colors hover:bg-sky-600 ${FOCUS} ${DISABLED}`,
  secondary: `inline-flex items-center justify-center gap-1 rounded bg-slate-700 ${SIZE_MD} font-medium text-slate-100 transition-colors hover:bg-slate-600 ${FOCUS} ${DISABLED}`,
  success: `inline-flex items-center justify-center gap-1 rounded bg-emerald-600 ${SIZE_MD} font-medium text-white transition-colors hover:bg-emerald-500 ${FOCUS} ${DISABLED}`,
  danger: `inline-flex items-center justify-center gap-1 rounded bg-red-700 ${SIZE_MD} font-medium text-white transition-colors hover:bg-red-600 ${FOCUS} ${DISABLED}`,
  ghost: `inline-flex items-center justify-center gap-1 rounded ${SIZE_MD} text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100 ${FOCUS} ${DISABLED}`,
  outline: `inline-flex items-center justify-center gap-1 rounded border border-slate-700 bg-slate-900 ${SIZE_MD} text-slate-100 transition-colors hover:border-slate-600 hover:bg-slate-800 ${FOCUS} ${DISABLED}`,
  /** 28×28 square button — for close (✕), collapse (‹/›), settings (⚙). */
  iconBtn: `inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-sky-500 hover:bg-slate-800 hover:text-sky-300 ${FOCUS} ${DISABLED}`,
  /** Smaller variant for inside panels / list rows. */
  iconBtnSm: `inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-sky-500 hover:bg-slate-800 hover:text-sky-300 ${FOCUS} ${DISABLED}`,
} as const

/** Common dialog overlay (used by ~20 dialogs). Keeps the
 *  `bg-black/60 p-4 flex items-center justify-center` muscle memory in
 *  one place so future changes (animations, click-outside-to-close)
 *  apply consistently. */
export const overlayClass =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'

export const dialogShell =
  'w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl'

export const dialogHeader =
  'flex items-center justify-between border-b border-slate-700 px-4 py-3'
