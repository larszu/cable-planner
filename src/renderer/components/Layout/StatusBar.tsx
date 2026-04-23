interface StatusBarProps {
  projectName: string
  zoom: number
  hasToken: boolean
}

export const StatusBar = ({ projectName, zoom, hasToken }: StatusBarProps) => {
  return (
    <footer className="flex shrink-0 items-center justify-between border-t border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
      <span>Rentman: {hasToken ? 'Konfiguriert' : 'Standalone Modus'}</span>
      <span>{projectName}</span>
      <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
    </footer>
  )
}
