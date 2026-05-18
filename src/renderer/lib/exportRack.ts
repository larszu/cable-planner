/**
 * v7.9.83 / #170 — Rack-Export-Pipeline.
 *
 * Vier Export-Modi für den Rack-Builder:
 *  1. 2D-PNG    — html-to-image Capture des aktuell sichtbaren 2D-Panels
 *  2. 3D-PNG    — canvas.toBlob() vom three.js Canvas, optional aus mehreren
 *                 vordefinierten Perspektiven gleichzeitig (Front / Rear /
 *                 Iso / Top) als getrennte Dateien
 *  3. 3D-STL    — STLExporter aus three-stdlib durch die r3f-Szene
 *  4. .cpgroup  — JSON-Dump des GroupPreset mit allen inline-base64-Assets
 *                 (STL, Panel-Fotos), portierbar zwischen Rechnern
 *
 * Alle Exporte triggern automatisch einen Browser-Download via
 * downloadBlob-Helper.
 */
import { toPng } from 'html-to-image'
import * as THREE from 'three'
import { STLExporter } from 'three-stdlib'

const downloadFile = (filename: string, blob: Blob): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}

const sanitizeFilename = (name: string): string =>
  name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80) || 'rack'

// ── 1) 2D Rack-Panel-Export ────────────────────────────────────────────

export const exportRack2DAsPng = async (
  rackCanvasEl: HTMLElement,
  rackName: string,
): Promise<void> => {
  // 2× Pixel-Ratio für Retina-Qualität.
  const dataUri = await toPng(rackCanvasEl, {
    pixelRatio: 2,
    backgroundColor: '#0f172a',
    cacheBust: true,
  })
  // dataUri → Blob
  const res = await fetch(dataUri)
  const blob = await res.blob()
  downloadFile(`${sanitizeFilename(rackName)}_2D.png`, blob)
}

// ── 2) 3D Rack-Canvas-Export aus mehreren Perspektiven ─────────────────

export type Rack3DPerspective = 'front' | 'rear' | 'iso' | 'top'

export interface Rack3DExportOpts {
  rackName: string
  /** Welt-Dimensionen, damit wir die Kamera entsprechend positionieren können. */
  rackWidthMm: number
  rackHeightMm: number
  rackDepthMm: number
  /** Welche Perspektiven exportieren. Default = alle 4. */
  perspectives?: Rack3DPerspective[]
}

/**
 * Render-Helper: nimmt einen vorhandenen WebGL-Canvas der r3f-Szene,
 * bewegt die Kamera kurz auf die gewünschte Perspektive, rendert ein
 * Frame und downloaded das Bild.
 *
 * Wir nutzen REAL die scene/camera des r3f-Trees — übergeben werden müssen
 * sie vom Caller. Der "Snapshot"-Mechanismus dokumentiert sich im Rack-
 * Dialog (Caller hält camera+scene+gl Refs via useThree).
 */
export const exportRack3DPerspective = async (
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  perspective: Rack3DPerspective,
  opts: { rackWidthMm: number; rackHeightMm: number; rackDepthMm: number },
): Promise<Blob> => {
  // Originale Kamera-Position merken damit wir sie nach dem Snapshot
  // wieder herstellen können (sonst springt die User-Sicht).
  const origPos = camera.position.clone()
  const origQuat = camera.quaternion.clone()

  const targetX = opts.rackWidthMm / 2
  const targetY = opts.rackHeightMm / 2
  const targetZ = opts.rackDepthMm / 2

  switch (perspective) {
    case 'front':
      camera.position.set(targetX, targetY, -opts.rackDepthMm * 1.5)
      camera.lookAt(targetX, targetY, targetZ)
      break
    case 'rear':
      camera.position.set(targetX, targetY, opts.rackDepthMm * 2.5)
      camera.lookAt(targetX, targetY, targetZ)
      break
    case 'top':
      camera.position.set(targetX, opts.rackHeightMm + opts.rackDepthMm * 1.5, targetZ)
      camera.lookAt(targetX, 0, targetZ)
      break
    case 'iso':
    default:
      camera.position.set(
        opts.rackWidthMm * 1.8,
        opts.rackHeightMm * 0.7,
        -opts.rackDepthMm * 1.8,
      )
      camera.lookAt(targetX, targetY, targetZ)
      break
  }
  camera.updateProjectionMatrix()

  // Render und canvas.toBlob() — wir warten einen Frame damit r3f das
  // neue Camera-State auch wirklich rendert.
  gl.render(scene, camera)
  await new Promise((r) => requestAnimationFrame(r))
  gl.render(scene, camera)

  const blob = await new Promise<Blob | null>((resolve) =>
    gl.domElement.toBlob(resolve, 'image/png'),
  )

  // Kamera zurück.
  camera.position.copy(origPos)
  camera.quaternion.copy(origQuat)
  camera.updateProjectionMatrix()
  gl.render(scene, camera)

  if (!blob) throw new Error('Canvas-Capture lieferte kein Bild')
  return blob
}

export const exportRack3DAsPngs = async (
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  opts: Rack3DExportOpts,
): Promise<void> => {
  const perspectives = opts.perspectives ?? ['front', 'rear', 'iso', 'top']
  const safeName = sanitizeFilename(opts.rackName)
  for (const p of perspectives) {
    const blob = await exportRack3DPerspective(gl, scene, camera, p, opts)
    downloadFile(`${safeName}_3D_${p}.png`, blob)
    // kurze Pause damit der Browser den nächsten Download nicht blockt.
    await new Promise((r) => setTimeout(r, 200))
  }
}

// ── 3) 3D-STL-Export (gesamtes Rack als eine Mesh-Datei) ───────────────

export const exportRackAsStl = (
  scene: THREE.Scene,
  rackName: string,
): void => {
  const exporter = new STLExporter()
  // binary=true → kompakter (binär-STL), false → ASCII-STL.
  // Binary ist Industrie-Standard für 3D-Druck und kleinere Dateigröße.
  const result = exporter.parse(scene, { binary: true })
  const blob = result instanceof DataView
    ? new Blob([result.buffer as ArrayBuffer], { type: 'application/octet-stream' })
    : new Blob([result], { type: 'model/stl' })
  downloadFile(`${sanitizeFilename(rackName)}.stl`, blob)
}

// ── 4) .cpgroup Download mit allen inline-Assets ───────────────────────
// (Delegiert an exportPresetToFile, das schon die korrekte File-V1
//  Wrapper-Struktur baut — damit das exportierte File auf einem anderen
//  Rechner via parseLibraryItemFile wieder importiert werden kann.)
export { exportPresetToFile as exportRackAsCpgroup } from './itemExport'
