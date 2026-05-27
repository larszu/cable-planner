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
  <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
    <div className="mb-2 text-xs font-semibold text-slate-300">{title}</div>
    {description && <p className="mb-2 text-[11px] text-slate-500">{description}</p>}
    {children}
  </div>
)
