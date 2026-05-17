/**
 * Read a user-picked image (or any binary file) as a data URI so it can travel
 * with the project file — no separate filesystem path to keep in sync.
 *
 * v7.9.42 — Picker-Setup nutzt jetzt openFilePicker aus lib/pickFile;
 * Reader-Logik bleibt hier weil sie File-Object→Data-URI nimmt (statt
 * Picker-flow). readImageAsDataUri ist immer noch das öffentliche
 * Interface, das Dialoge mit ihrem eigenen `<input>` benutzen.
 */
import { openFilePicker } from './pickFile'

export const readImageAsDataUri = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })

/**
 * Imperative helper that wraps the entire "open file picker → read → return
 * data URI" flow. The caller passes a `mimeAccept` string (e.g. "image/png,
 * image/jpeg,image/svg+xml,image/webp") and gets back a promise that resolves
 * to the chosen image's data URI, or `null` if the user dismissed the picker
 * or picked something unreadable.
 */
export const pickImageAsDataUri = async (
  mimeAccept = 'image/png,image/jpeg,image/svg+xml,image/webp',
): Promise<string | null> => {
  const file = await openFilePicker(mimeAccept)
  if (!file) return null
  return readImageAsDataUri(file)
}
