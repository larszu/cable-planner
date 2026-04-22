interface StatusBarProps {
  projectName: string
  zoom: number
  hasToken: boolean
}

export const StatusBar = ({ projectName, zoom, hasToken }: StatusBarProps) => {
  return (
    <footer className="flex items-center justify-between border-t border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
      <span>Rentman: {hasToken ? 'Configured' : 'Standalone Mode'}</span>
      <span>{projectName}</span>
      <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
    </footer>
  )
}
