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
    className={`flex min-w-0 items-center gap-1 rounded px-2 py-1 ${
      active ? 'bg-sky-700 text-white' : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
    }`}
  >
    <span className={`shrink-0 ${active ? 'text-white' : 'text-cp-text-muted'}`}>{icon}</span>
    {/* `truncate` + `title` als Gürtel und Hosenträger: das Raster gibt jedem
        Register dieselbe Breite, aber eine künftige Sprache mit längerem Wort
        soll das Label KÜRZEN und nicht die Nachbarn aus dem Panel schieben —
        genau das ist am 2026-09-07 mit „Gruppen" und „Racks" passiert. */}
    <span className="truncate">{label}</span>
    {count != null && count > 0 && (
      <span
        className={`ml-1 rounded-full px-1 text-cp-xs ${
          active ? 'bg-sky-900/70 text-sky-100' : 'bg-cp-surface-1 text-cp-text-muted'
        }`}
      >
        {count}
      </span>
    )}
  </button>
)
