import { useTranslation } from '../../lib/i18n'

interface RentmanProject {
  id: string
  name: string
  status?: string
  number?: string | number
  periodStart?: string
  periodEnd?: string
}

interface ProjectSelectorProps {
  projects: RentmanProject[]
  selectedProjectId: string
  onSelect: (projectId: string) => void
}

const formatDate = (iso?: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatLabel = (project: RentmanProject): string => {
  const parts: string[] = []
  if (project.number !== undefined && project.number !== '') parts.push(`#${project.number}`)
  parts.push(project.name)
  const from = formatDate(project.periodStart)
  const to = formatDate(project.periodEnd)
  if (from && to) parts.push(`${from} → ${to}`)
  else if (from) parts.push(from)
  if (project.status) parts.push(`(${project.status})`)
  return parts.join(' · ')
}

export const ProjectSelector = ({ projects, selectedProjectId, onSelect }: ProjectSelectorProps) => {
  const t = useTranslation()
  if (projects.length === 0) return null
  // Scrollbare, durchsuchbare Liste statt nativem <select>: Nummer/Name/Status
  // pro Zeile auf einen Blick scanbar, und die Such-/Sortier-Controls darüber
  // wirken jetzt sichtbar auf die Liste (beim Dropdown war beides unsichtbar).
  return (
    <div
      role="listbox"
      aria-label={t('rentman.projectSelector.aria', 'Rentman project')}
      className="max-h-64 overflow-auto rounded border border-cp-border bg-cp-surface-1"
    >
      {projects.map((project) => {
        const active = project.id === selectedProjectId
        return (
          <button
            key={project.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(project.id)}
            title={formatLabel(project)}
            className={`flex w-full items-center justify-between gap-2 border-b border-cp-border-muted px-2.5 py-1.5 text-left text-cp-xs last:border-b-0 ${
              active ? 'bg-sky-600 text-white' : 'text-cp-text-bright hover:bg-cp-surface-2'
            }`}
          >
            <span className="min-w-0 flex-1 truncate">
              {project.number !== undefined && project.number !== '' && (
                <span className={active ? 'text-sky-100' : 'text-cp-text-muted'}>#{project.number} </span>
              )}
              {project.name}
              {(() => {
                const from = formatDate(project.periodStart)
                const to = formatDate(project.periodEnd)
                const span = from && to ? `${from} → ${to}` : from
                return span ? <span className={`ml-1 ${active ? 'text-sky-100' : 'text-cp-text-faint'}`}>· {span}</span> : null
              })()}
            </span>
            {project.status && (
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${active ? 'bg-sky-700 text-sky-50' : 'bg-cp-surface-2 text-cp-text-muted'}`}>
                {project.status}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
