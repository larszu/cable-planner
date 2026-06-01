import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../renderer/index.css'
import { ViewerApp } from './ViewerApp'

// #143 — Standalone-Web-Viewer-Entry (viewer.html). Komplett unabhängig vom
// Electron-Renderer: kein Store, keine IPC-Bridge, kein Editor. Lädt eine
// .cpviewer/.json-Datei und rendert den Plan read-only.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ViewerApp />
  </StrictMode>,
)
