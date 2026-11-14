// #1180 — Beschriftung einer Ausstattungsart. Eigenes Modul, damit
// Eigenschaften und Stueckliste dieselbe nutzen; die Uebersetzung kommt als
// Parameter, das Modul selbst bleibt sprachfrei.
import type { AusstattungsArt } from '../types/cable'

export const ausstattungsArtText = (art: AusstattungsArt, t: (k: string, f: string) => string): string =>
  ({
    braid: t('ausstattung.art.braid', 'Braided sleeve'),
    conduit: t('ausstattung.art.conduit', 'Corrugated conduit'),
    tape: t('ausstattung.art.tape', 'Cloth tape'),
    shrink: t('ausstattung.art.shrink', 'Heat shrink'),
  })[art]
