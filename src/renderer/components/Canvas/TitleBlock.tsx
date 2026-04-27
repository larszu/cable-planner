import { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'

const fmtDate = (iso?: string): string => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

/**
 * yEd-style "Bauplan-Signatur" pinned to the canvas bottom-right corner.
 *
 * Displays project metadata (name, number, client, contractor, author,
 * dates, version) plus optional company / client logos. Reads everything
 * straight from `project.metadata` — values are edited in the Settings
 * dialog (Projekt-Einstellungen tab) and persisted with the project file.
 *
 * The block can be collapsed via the corner toggle so it doesn't get in
 * the way of fine drawing work, and the collapsed state is local-only.
 */
export const TitleBlock = () => {
  const metadata = useProjectStore((state) => state.project.metadata)
  const [collapsed, setCollapsed] = useState(false)

  const projectName = metadata.name?.trim() || 'Unbenanntes Projekt'
  const rows: { label: string; value?: string }[] = [
    { label: 'Projekt-Nr.', value: metadata.projectNumber },
    { label: 'Kunde', value: metadata.client },
    { label: 'Auftragnehmer', value: metadata.contractor },
    { label: 'Planer', value: metadata.author },
    { label: 'Erstellt', value: fmtDate(metadata.createdAt) },
    { label: 'Geändert', value: fmtDate(metadata.updatedAt) },
  ]

  const hasLogo = !!(metadata.companyLogo || metadata.clientLogo)

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Bauplan-Signatur einblenden"
        className="nodrag nopan absolute bottom-2 right-2 z-10 rounded border border-slate-700 bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-slate-200 shadow hover:bg-slate-800"
      >
        Signatur
      </button>
    )
  }

  return (
    <div
      className="nodrag nopan absolute bottom-2 right-2 z-10 select-none rounded border border-slate-700 bg-slate-900/95 text-[11px] text-slate-200 shadow-lg"
      style={{ width: 280, fontFamily: 'system-ui, sans-serif' }}
    >
      <div className="flex items-center justify-between border-b border-slate-700 px-2 py-1">
        <span className="truncate font-semibold text-slate-100" title={projectName}>
          {projectName}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Signatur einklappen"
          className="ml-2 rounded px-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          –
        </button>
      </div>
      {hasLogo && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/50 p-1.5">
          <div className="flex h-10 flex-1 items-center justify-center overflow-hidden rounded bg-white/5">
            {metadata.companyLogo ? (
              <img
                src={metadata.companyLogo}
                alt="Auftragnehmer"
                className="max-h-10 max-w-full object-contain"
              />
            ) : (
              <span className="text-[9px] text-slate-600">kein Logo</span>
            )}
          </div>
          <div className="flex h-10 flex-1 items-center justify-center overflow-hidden rounded bg-white/5">
            {metadata.clientLogo ? (
              <img
                src={metadata.clientLogo}
                alt="Kunde"
                className="max-h-10 max-w-full object-contain"
              />
            ) : (
              <span className="text-[9px] text-slate-600">kein Logo</span>
            )}
          </div>
        </div>
      )}
      <div className="px-2 py-1.5">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map(({ label, value }) => (
              <tr key={label} className="border-b border-slate-800/60 last:border-b-0">
                <td className="py-0.5 pr-2 align-top text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {label}
                </td>
                <td className="py-0.5 text-right align-top text-slate-200">
                  {value && value !== '—' ? value : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
