/**
 * Trigger a file picker and resolve with the picked file's text or
 * binary content. Used by every "import …" entry-point in the
 * renderer (XLSX import, GG5 import, ConfigsTab uploads, project
 * paste, etc.). Returns `null` when the user cancels.
 */

export interface PickedTextFile {
  name: string
  content: string
  mimeType: string
}

export interface PickedBinaryFile {
  name: string
  content: ArrayBuffer
  mimeType: string
}

/** Pick a file and read it as text. */
export const pickTextFile = (accept = '*/*'): Promise<PickedTextFile | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () =>
        resolve({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          content: typeof reader.result === 'string' ? reader.result : '',
        })
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    }
    input.click()
  })

/** Pick a file and read it as an ArrayBuffer (for binary formats like XLSX). */
export const pickBinaryFile = (accept = '*/*'): Promise<PickedBinaryFile | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const buffer = reader.result
        if (!(buffer instanceof ArrayBuffer)) {
          resolve(null)
          return
        }
        resolve({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          content: buffer,
        })
      }
      reader.onerror = () => resolve(null)
      reader.readAsArrayBuffer(file)
    }
    input.click()
  })
