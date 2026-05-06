/**
 * Read a user-picked image (or any binary file) as a data URI so it can travel
 * with the project file — no separate filesystem path to keep in sync.
 *
 * Replaces 6 inline FileReader.readAsDataURL setups in
 * EquipmentProperties (3×), RackBuilderDialog, SettingsDialog and
 * ProjectMetaDialog. Resolves with the data URI on success or `null` if the
 * read fails (e.g. the user cancelled the picker after selecting a file the
 * browser can't open). Never rejects.
 */
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
export const pickImageAsDataUri = (
  mimeAccept = 'image/png,image/jpeg,image/svg+xml,image/webp',
): Promise<string | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = mimeAccept
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      resolve(await readImageAsDataUri(file))
    }
    // Browser fires no event when the user closes the picker without
    // choosing — we just leave the promise unresolved in that case (the
    // typical UX, matching window.prompt cancel).
    input.click()
  })
