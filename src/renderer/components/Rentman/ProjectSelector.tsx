interface RentmanProject {
  id: string
  name: string
  status?: string
}

interface ProjectSelectorProps {
  projects: RentmanProject[]
  selectedProjectId: string
  onSelect: (projectId: string) => void
}

export const ProjectSelector = ({ projects, selectedProjectId, onSelect }: ProjectSelectorProps) => {
  return (
    <select
      className="w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
      value={selectedProjectId}
      onChange={(event) => onSelect(event.target.value)}
    >
      <option value="">Select project</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name} {project.status ? `(${project.status})` : ''}
        </option>
      ))}
    </select>
  )
}
