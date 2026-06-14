import type { ReactNode } from 'react'

/**
 * #307 — Shared SettingsCard wrapper. Aus SettingsDialog ausgelagert
 * weil mehrere Tab-Files den Wrapper nutzen.
 */
export const SettingsCard = ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) => (
  <div className="rounded border border-[var(--cp-border-muted)] bg-cp-surface-3/40 p-3">
    <div className="mb-2 text-cp-xs font-semibold text-[var(--cp-text-secondary)]">{title}</div>
    {description && <p className="mb-2 text-cp-xs text-[var(--cp-text-faint)]">{description}</p>}
    {children}
  </div>
)
