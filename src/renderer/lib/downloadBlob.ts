/**
 * Single download helper used by every export path in the renderer.
 *
 * Before this module existed each caller hand-rolled the same pattern
 * (`document.createElement('a')` + `URL.createObjectURL` + `click()` +
 * deferred `revokeObjectURL`). That copy-pasted boilerplate showed up
 * in 14+ places — Settings, GreenGo, ATEM, Cable BOM, Videohub, image
 * export, intercom matrix, project save fallback, …
 *
 * Putting it here lets future tweaks (Safari workarounds, telemetry,
 * progress callbacks) happen in one spot.
 */

type DownloadContent = ArrayBuffer | Uint8Array | Blob | string

const inferType = (content: DownloadContent, override?: string): string => {
  if (override) return override
  if (typeof content === 'string') return 'application/octet-stream'
  if (content instanceof Blob) return content.type || 'application/octet-stream'
  return 'application/octet-stream'
}

const toBlob = (content: DownloadContent, mimeType: string): Blob => {
  if (content instanceof Blob) return content
  if (typeof content === 'string') return new Blob([content], { type: mimeType })
  // Cast — TS 6 disallows ArrayBufferLike-backed Uint8Array as BlobPart
  // even though it's structurally fine for the runtime Blob constructor.
  return new Blob([content as unknown as BlobPart], { type: mimeType })
}

/**
 * Trigger a browser download. Returns void; the caller doesn't need
 * to handle the temporary anchor lifecycle. Filename is sanitised
 * (forward/back-slashes replaced) so a project name with a path
 * separator can't leak into the OS save-as dialog.
 */
export const downloadBlob = (
  filename: string,
  content: DownloadContent,
  mimeType?: string,
): void => {
  const cleanName = filename.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'download'
  const blob = toBlob(content, inferType(content, mimeType))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = cleanName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke so Safari has time to start the download. 1 s is the
  // conventional grace period used by file-saver and friends.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
