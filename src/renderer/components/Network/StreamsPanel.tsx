import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { downloadBlob } from '../../lib/downloadBlob'
import { csvFromTable } from '../../lib/documentStamp'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { streamDirectionText, streamsTable, streamZeilen } from '../../lib/streamEndpoints'
import { vlanTag } from '../../lib/vlanAnzeige'

/**
 * #946 — alle Streams im Plan, im Netz-Reiter neben den Adressen. Hier sucht
 * man sie, wenn man vor dem Multiviewer steht und die RTSP-Adresse von
 * Kamera 3 braucht.
 */
export const StreamsPanel = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const zeilen = useMemo(() => streamZeilen(equipment), [equipment])
  if (zeilen.length === 0) return null

  return (
    <div className="border border-[var(--cp-border-muted)] bg-[var(--cp-surface-3)] p-2 text-cp-xs">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="font-semibold text-[var(--cp-text-muted)]">
          {t('streams.title', 'Streams')} ({zeilen.length})
        </span>
        <button
          type="button"
          onClick={() =>
            downloadBlob(
              buildExportFilenameWithSuffix(projectName, 'streams', 'csv'),
              csvFromTable(streamsTable(equipment)),
              'text/csv',
            )
          }
          className="inline-flex items-center gap-1 border border-[var(--cp-border)] px-1.5 py-0.5 hover:bg-[var(--cp-surface-2)]"
        >
          <Icon icon={Download} size="xs" /> CSV
        </button>
      </div>
      <ul className="space-y-0.5">
        {zeilen.map((r) => (
          <li key={r.stream.id} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{r.geraet}</span>
            <span className="text-[var(--cp-text-faint)]">{streamDirectionText(r.stream.direction, t)}</span>
            <span>{r.protokoll}</span>
            {r.stream.label && <span>{r.stream.label}</span>}
            {r.adresse && <span className="font-mono text-[var(--cp-text-muted)]">{r.adresse}</span>}
            {vlanTag(r.vlanId) && <span className="text-[var(--cp-text-muted)]">{vlanTag(r.vlanId)}</span>}
            {r.stream.codec && <span className="text-[var(--cp-text-faint)]">{r.stream.codec}</span>}
            {r.stream.format && <span className="text-[var(--cp-text-faint)]">{r.stream.format}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
