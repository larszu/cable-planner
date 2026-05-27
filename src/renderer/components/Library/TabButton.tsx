import type { ReactNode } from 'react'

/**
 * #305 — Tab-Button im LibraryPanel-Header. Wurde aus LibraryPanel.tsx
 * extrahiert um den God-Component-Refactor zu starten. Pure Komponente,
 * kein Store-Subscribe.
 */
export const TabButton = ({
  active,
  onClick,
  label,
  icon,
  count,
  title,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: ReactNode
  count?: number
  title?: string
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`flex items-center gap-1 rounded px-2 py-1 ${
      active ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    }`}
  >
    <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
    <span>{label}</span>
    {count != null && count > 0 && (
      <span
        className={`ml-1 rounded-full px-1 text-[10px] ${
          active ? 'bg-sky-900/70 text-sky-100' : 'bg-slate-900 text-slate-400'
        }`}
      >
        {count}
      </span>
    )}
  </button>
)
