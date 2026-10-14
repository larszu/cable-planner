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
  <div className="rounded-cp-card bg-cp-surface-2/60 p-4">
    <div className="mb-1 text-cp-sm font-semibold text-cp-text-bright">{title}</div>
    {description && <p className="mb-2 text-cp-xs text-[var(--cp-text-faint)]">{description}</p>}
    {children}
  </div>
)
