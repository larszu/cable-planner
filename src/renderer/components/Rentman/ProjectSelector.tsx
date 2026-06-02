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
  return (
    <select
      aria-label={t('rentman.projectSelector.aria', 'Rentman project')}
      className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-cp-base"
      value={selectedProjectId}
      onChange={(event) => onSelect(event.target.value)}
    >
      <option value="">{t('rentman.projectSelector.placeholder', 'Select project')}</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {formatLabel(project)}
        </option>
      ))}
    </select>
  )
}
