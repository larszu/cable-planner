import { useState } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useTranslation } from '../../lib/i18n'

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
  const t = useTranslation()
  const metadata = useProjectStore((state) => state.project.metadata)
  const [collapsed, setCollapsed] = useState(false)

  const projectName = metadata.name?.trim() || t('canvas.titleBlock.unnamed', 'Unbenanntes Projekt')
  const rows: { label: string; value?: string }[] = [
    { label: t('canvas.titleBlock.projectNo', 'Projekt-Nr.'), value: metadata.projectNumber },
    { label: t('canvas.titleBlock.client', 'Kunde'), value: metadata.client },
    { label: t('canvas.titleBlock.contractor', 'Auftragnehmer'), value: metadata.contractor },
    { label: t('canvas.titleBlock.planner', 'Planer'), value: metadata.author },
    { label: t('canvas.titleBlock.created', 'Erstellt'), value: fmtDate(metadata.createdAt) },
    { label: t('canvas.titleBlock.modified', 'Geändert'), value: fmtDate(metadata.updatedAt) },
  ]

  const hasLogo = !!(metadata.companyLogo || metadata.clientLogo)

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title={t('canvas.titleBlock.showTitle', 'Bauplan-Signatur einblenden')}
        className="nodrag nopan absolute bottom-2 right-2 z-10 rounded border border-cp-border bg-cp-surface-1/90 px-2 py-1 text-[11px] font-semibold text-cp-text-bright shadow hover:bg-cp-surface-2"
      >
        {t('canvas.titleBlock.signatureBtn', 'Signatur')}
      </button>
    )
  }

  return (
    <div
      className="nodrag nopan absolute bottom-2 right-2 z-10 select-none rounded border border-cp-border bg-cp-surface-1/95 text-[11px] text-cp-text-bright shadow-lg"
      style={{ width: 280, fontFamily: 'system-ui, sans-serif' }}
    >
      <div className="flex items-center justify-between border-b border-cp-border px-2 py-1">
        <span className="truncate font-semibold text-cp-text" title={projectName}>
          {projectName}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title={t('canvas.titleBlock.collapseTitle', 'Signatur einklappen')}
          className="ml-2 rounded px-1 text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text-bright"
        >
          –
        </button>
      </div>
      {hasLogo && (
        <div className="flex items-center justify-between gap-2 border-b border-cp-border-muted bg-cp-surface-3/50 p-1.5">
          <div className="flex h-10 flex-1 items-center justify-center overflow-hidden rounded bg-white/5">
            {metadata.companyLogo ? (
              <img
                src={metadata.companyLogo}
                alt={t('canvas.titleBlock.contractor', 'Auftragnehmer')}
                className="max-h-10 max-w-full object-contain"
              />
            ) : (
              <span className="text-[9px] text-cp-text-muted">
                {t('canvas.titleBlock.noLogo', 'kein Logo')}
              </span>
            )}
          </div>
          <div className="flex h-10 flex-1 items-center justify-center overflow-hidden rounded bg-white/5">
            {metadata.clientLogo ? (
              <img
                src={metadata.clientLogo}
                alt={t('canvas.titleBlock.client', 'Kunde')}
                className="max-h-10 max-w-full object-contain"
              />
            ) : (
              <span className="text-[9px] text-cp-text-muted">
                {t('canvas.titleBlock.noLogo', 'kein Logo')}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="px-2 py-1.5">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map(({ label, value }) => (
              <tr key={label} className="border-b border-cp-border-muted/60 last:border-b-0">
                <td className="py-0.5 pr-2 align-top text-[10px] font-medium uppercase tracking-wide text-cp-text-muted">
                  {label}
                </td>
                <td className="py-0.5 text-right align-top text-cp-text-bright">
                  {value && value !== '—' ? value : <span className="text-cp-text-dim">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
