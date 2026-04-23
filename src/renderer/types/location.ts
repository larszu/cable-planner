export interface LocationFrame {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  color: string // hex colour for border / title accent
  /** Optional floor / level (e.g. "EG", "1.OG", "Basement"). */
  floor?: string
  /** Free-form notes about the location. */
  notes?: string
  /** When true, dragging the frame also moves contained equipment (group drag). Defaults to false. */
  moveContents?: boolean
}
