/**
 * File-Picker-Helpers für den Renderer.
 *
 * Trigger einen unsichtbaren <input type="file"> und resolve mit dem
 * gelesenen Inhalt (Text, ArrayBuffer oder Data-URI). Browser-fires-
 * kein-Event-bei-Cancel-Quirk wird konsequent als `null` resolved
 * (Promise rejected nie). Used by every "import …" entry-point im
 * Renderer (XLSX import, GG5 import, ConfigsTab uploads, Library-File-
 * import, Logo-Picker, …).
 *
 * v7.9.42 — Gemeinsamer Core extrahiert. Vorher waren pickTextFile und
 * pickBinaryFile fast identische Funktionen — einziger Unterschied
 * `reader.readAsText` vs `reader.readAsArrayBuffer`. Plus mehrere Call-
 * Sites haben den File-Picker komplett ad-hoc neu gebaut. Jetzt liegen
 * Picker und Reader getrennt — File-Picker einmal, Reader-Varianten
 * dünn drüber.
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

export interface PickedDataUriFile {
  name: string
  content: string
  mimeType: string
}

/**
 * Dateiendungen, die iOS/iPadOS einem eigenen Typ (UTI) zuordnet. Nur die
 * darf ein `accept` auf einem iPhone nennen: Safari uebersetzt `accept` in
 * UTIs, und eine Endung ohne UTI (`.cableplan`, `.cpviewer`, `.avplan`,
 * `.gg5` …) faellt dabei still heraus. Die Datei selbst traegt dann nur
 * einen dynamischen Typ, der zu keinem der uebrigen Eintraege passt — die
 * Dateien-App graut sie aus, „Oeffnen" nimmt sie nicht (#1197).
 */
export const IOS_BEKANNTE_ENDUNGEN = new Set([
  '.json', '.csv', '.txt', '.xml', '.pdf', '.png', '.jpg', '.jpeg', '.gif',
  '.webp', '.svg', '.heic', '.html', '.htm', '.xlsx', '.zip',
])

/** iPhone, iPod oder iPad — auch das iPad, das sich als Mac ausgibt. */
export const istIos = (
  nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> | undefined =
    typeof navigator === 'undefined' ? undefined : navigator,
): boolean => {
  if (!nav) return false
  if (/iPad|iPhone|iPod/.test(nav.userAgent)) return true
  return nav.platform === 'MacIntel' && nav.maxTouchPoints > 1
}

/**
 * Das `accept`, das dieses Geraet wirklich anwenden kann. Auf iOS ohne
 * Filter, sobald eine eigene Endung darin steht — sonst waere genau die
 * eigene Datei nicht waehlbar. Was gewaehlt wurde, pruefen die Aufrufer
 * ohnehin beim Lesen (JSON.parse, Formatpruefung).
 */
export const acceptFuerGeraet = (accept: string, ios: boolean = istIos()): string => {
  if (!ios) return accept
  const eigene = accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .some((s) => s.startsWith('.') && !IOS_BEKANNTE_ENDUNGEN.has(s))
  return eigene ? '' : accept
}

/** Open a hidden file picker. Resolves with the picked File or null
 *  (auf Cancel oder Browser-Quirk wo onchange nie feuert; in dem Fall
 *  bleibt die Promise hängen — caller sollte nicht auf Cleanup hoffen). */
export const openFilePicker = (accept = '*/*'): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = acceptFuerGeraet(accept)
    input.onchange = () => {
      const file = input.files?.[0]
      resolve(file ?? null)
    }
    input.click()
  })

const readFile = <T extends 'text' | 'arrayBuffer' | 'dataUrl'>(
  file: File,
  mode: T,
): Promise<string | ArrayBuffer | null> =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => resolve(null)
    if (mode === 'text') reader.readAsText(file)
    else if (mode === 'arrayBuffer') reader.readAsArrayBuffer(file)
    else reader.readAsDataURL(file)
  })

/** Pick a file and read it as text. */
export const pickTextFile = async (
  accept = '*/*',
): Promise<PickedTextFile | null> => {
  const file = await openFilePicker(accept)
  if (!file) return null
  const result = await readFile(file, 'text')
  if (typeof result !== 'string') return null
  return {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    content: result,
  }
}

/** Pick a file and read it as an ArrayBuffer (XLSX, binaries, …). */
export const pickBinaryFile = async (
  accept = '*/*',
): Promise<PickedBinaryFile | null> => {
  const file = await openFilePicker(accept)
  if (!file) return null
  const result = await readFile(file, 'arrayBuffer')
  if (!(result instanceof ArrayBuffer)) return null
  return {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    content: result,
  }
}

/** Pick a file and read it as a data: URI (Images für Logos / Panel-
 *  Bilder, die in der Projekt-JSON inline liegen sollen). */
export const pickDataUriFile = async (
  accept = '*/*',
): Promise<PickedDataUriFile | null> => {
  const file = await openFilePicker(accept)
  if (!file) return null
  const result = await readFile(file, 'dataUrl')
  if (typeof result !== 'string') return null
  return {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    content: result,
  }
}
