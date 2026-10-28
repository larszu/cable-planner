import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import {
  TITLE_BLOCK_ROWS,
  titleBlockRowVisible,
  type TitleBlockOptions,
  type TitleBlockRow,
} from '../../lib/titleBlockScale'

const ROW_LABEL: Record<TitleBlockRow, [string, string]> = {
  name: ['export.tb.row.name', 'Project'],
  projectNumber: ['export.tb.row.projectNumber', 'Project no.'],
  client: ['export.tb.row.client', 'Client'],
  contractor: ['export.tb.row.contractor', 'Contractor'],
  author: ['export.tb.row.author', 'Planner'],
  createdAt: ['export.tb.row.createdAt', 'Created'],
  updatedAt: ['export.tb.row.updatedAt', 'Modified'],
  revision: ['export.tb.row.revision', 'Revision'],
  stand: ['export.tb.row.stand', 'State'],
}

const SIZES: ('auto' | number)[] = ['auto', 0.75, 1, 1.5, 2, 3]

/** Schriftfeld unten rechts im PDF — gehoert zum Projekt, nicht zur Ausgabe. */
export const TitleBlockSettings = () => {
  const t = useTranslation()
  const tb = useProjectStore((s) => s.project.metadata.titleBlock)
  const update = useProjectStore((s) => s.updateProjectMetadata)
  const set = (patch: Partial<TitleBlockOptions>) => update({ titleBlock: { ...tb, ...patch } })
  const show = tb?.show !== false

  const toggleRow = (row: TitleBlockRow, on: boolean) => {
    const hidden = new Set(tb?.hidden ?? [])
    if (on) hidden.delete(row)
    else hidden.add(row)
    set({ hidden: TITLE_BLOCK_ROWS.filter((r) => hidden.has(r)) })
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">
        {t('export.tb.title', 'Title block')}
      </legend>
      <label className="flex items-center gap-2 text-cp-xs">
        <input type="checkbox" checked={show} onChange={(e) => set({ show: e.target.checked })} />
        <span>{t('export.tb.show', 'Show title block (bottom right)')}</span>
      </label>
      {show && (
        <div className="space-y-2 pl-5">
          <label className="flex items-center gap-2 text-cp-xs">
            <span className="w-16 text-cp-text-muted">{t('export.tb.size', 'Size')}</span>
            <select
              value={String(tb?.size ?? 'auto')}
              onChange={(e) =>
                set({ size: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })
              }
              className="flex-1 border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-xs text-cp-text"
            >
              {SIZES.map((s) => (
                <option key={String(s)} value={String(s)}>
                  {s === 'auto'
                    ? t('export.tb.sizeAuto', 'Auto — grows with the sheet')
                    : `${Math.round(s * 100)} %`}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <label className="flex items-center gap-2 text-cp-xs">
              <input
                type="checkbox"
                checked={tb?.qr !== false}
                onChange={(e) => set({ qr: e.target.checked })}
              />
              <span>{t('export.tb.qr', 'QR code')}</span>
            </label>
            <label className="flex items-center gap-2 text-cp-xs">
              <input
                type="checkbox"
                checked={tb?.logos !== false}
                onChange={(e) => set({ logos: e.target.checked })}
              />
              <span>{t('export.tb.logos', 'Logos')}</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {TITLE_BLOCK_ROWS.map((row) => (
              <label key={row} className="flex items-center gap-2 text-cp-xs">
                <input
                  type="checkbox"
                  checked={titleBlockRowVisible(tb, row)}
                  onChange={(e) => toggleRow(row, e.target.checked)}
                />
                <span>{t(ROW_LABEL[row][0], ROW_LABEL[row][1])}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  )
}
