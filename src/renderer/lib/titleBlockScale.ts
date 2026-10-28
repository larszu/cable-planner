/**
 * Faktor fuer das Schriftfeld unten rechts im PDF. Das Feld ist fuer ein
 * A3-Querblatt bemessen und waechst mit der Blattflaeche mit — sonst schrumpft
 * es auf grossen Plaenen zur Briefmarke. Nie kleiner als 1, nie breiter als
 * knapp die Haelfte des Blatts.
 *
 * `unitsPerPt` rechnet die Blatteinheit um: 1 fuer pt, 4/3 fuer CSS-px.
 */
export const titleBlockScale = (
  pageWidth: number,
  pageHeight: number,
  baseWidth: number,
  unitsPerPt = 1,
): number => {
  const a3W = 1191 * unitsPerPt
  const a3H = 842 * unitsPerPt
  const byArea = Math.sqrt((pageWidth * pageHeight) / (a3W * a3H))
  const byWidth = (pageWidth * 0.45) / baseWidth
  return Math.max(1, Math.min(byArea, byWidth))
}

/** Zeilen des Schriftfelds, in der Reihenfolge auf dem Blatt. */
export const TITLE_BLOCK_ROWS = [
  'name',
  'projectNumber',
  'client',
  'contractor',
  'author',
  'createdAt',
  'updatedAt',
  'revision',
  'stand',
] as const
export type TitleBlockRow = (typeof TITLE_BLOCK_ROWS)[number]

/** Wie das Schriftfeld im PDF aussieht. Wandert mit dem Projekt. */
export interface TitleBlockOptions {
  /** false = kein Schriftfeld. */
  show?: boolean
  qr?: boolean
  logos?: boolean
  /** Abgewaehlte Zeilen. */
  hidden?: TitleBlockRow[]
  /** 'auto' = mit dem Blatt wachsen, sonst fester Faktor (1 = A3-Groesse). */
  size?: 'auto' | number
}

export const resolveTitleBlockScale = (
  opts: TitleBlockOptions | undefined,
  pageWidth: number,
  pageHeight: number,
  baseWidth: number,
  unitsPerPt = 1,
): number => {
  const size = opts?.size ?? 'auto'
  if (size === 'auto') return titleBlockScale(pageWidth, pageHeight, baseWidth, unitsPerPt)
  return Math.max(0.5, Math.min(size, (pageWidth * 0.9) / baseWidth))
}

export const titleBlockRowVisible = (opts: TitleBlockOptions | undefined, row: TitleBlockRow) =>
  !opts?.hidden?.includes(row)
