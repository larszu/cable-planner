/**
 * v7.9.116 — Einheitlicher Filename-Stempel fuer alle Exporte.
 *
 * Format: YYYYMMDD_<Basename>_NNN.<ext>
 *   - YYYYMMDD = lokales Datum, kein Trennzeichen damit Datei-Listen
 *     chronologisch sortieren.
 *   - <Basename> = Projektname oder anderer Identifier, sanitized fuer
 *     Datei-Systeme (keine /, \, :, *, ?, ", <, >, |).
 *   - NNN = pro Datum aufsteigend, 3-stellig (001, 002, ...) damit das
 *     letzte Export-File alphabetisch ans Ende sortiert.
 *
 * Counter wird pro Tag in localStorage gespeichert. Wechsel des Tages
 * setzt automatisch auf 001 zurueck (alter Counter wird beim
 * Get-Zugriff einfach nicht mehr gefunden).
 *
 * Wer den Helper nutzt:
 *  - exportPdf (Raster + Vektor)
 *  - exportImage (PNG/JPEG)
 *  - exportDevicePdf (Patch-Sheets)
 *  - CableBomDialog (BOM PDF)
 *  - LocationBomDialog (Stueckliste PDF)
 *  - ExportDialog (BOM CSV)
 *  - VideohubExportDialog (Routing-Text)
 *  - GreenGoExportDialog (Config JSON)
 *  - AtemAudioRouterDialog (Audio-Config)
 *  - PatchListDialog (Patch-CSV)
 *  - Settings (Logs-Dump)
 *  - Project-Save-as-Default (Vorbelegung des Dateinamens)
 */

const COUNTER_KEY_PREFIX = 'cable-planner:export-counter:'

/** Heutiges Datum als YYYYMMDD-String, basierend auf lokaler Zeit. */
const today = (): string => {
  const d = new Date()
  const yyyy = d.getFullYear().toString().padStart(4, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

/** Holt den naechsten Counter-Wert fuer heute. Speichert direkt ab,
 *  sodass der naechste Aufruf eine hoehere Nummer bekommt. Beim ersten
 *  Aufruf an einem Tag steht der Counter auf 1.
 *
 *  Localstorage-unavailable (z.B. SSR-/Test-Env) → fallback auf 1. */
const nextCounter = (date: string): number => {
  try {
    const key = `${COUNTER_KEY_PREFIX}${date}`
    const raw = localStorage.getItem(key)
    const current = raw ? parseInt(raw, 10) : 0
    const next = Number.isFinite(current) && current > 0 ? current + 1 : 1
    localStorage.setItem(key, String(next))
    return next
  } catch {
    return 1
  }
}

/** Sanitize: nur Datei-System-sichere Zeichen erlauben. Behaelt Bindestrich,
 *  Unterstrich, Punkt und Leerzeichen — alles andere wird durch _ ersetzt. */
const sanitize = (name: string): string => {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return 'cable-planner'
  return trimmed.replace(/[^a-zA-Z0-9\-_. äöüÄÖÜß]/g, '_').slice(0, 80)
}

/**
 * Baut den finalen Dateinamen: `YYYYMMDD_<Basename>_NNN.<ext>`.
 *
 * @param baseName  Z.B. Projekt-Name. Wird sanitized.
 * @param ext       Datei-Endung OHNE fuehrenden Punkt, z.B. 'pdf', 'csv'.
 * @returns         Z.B. '20260519_Demo-Show_007.pdf'
 */
export const buildExportFilename = (baseName: string, ext: string): string => {
  const date = today()
  const counter = nextCounter(date)
  const clean = sanitize(baseName)
  const safeExt = (ext ?? '').replace(/^\.+/, '').toLowerCase() || 'bin'
  const counterStr = String(counter).padStart(3, '0')
  return `${date}_${clean}_${counterStr}.${safeExt}`
}

/**
 * Wie buildExportFilename, aber mit einem zusaetzlichen Suffix VOR der
 * Endung — z.B. fuer BOM-Files: 'YYYYMMDD_<Name>_NNN_kabel-bom.pdf'.
 * Suffix wird sanitized und mit Bindestrich angehaengt.
 */
export const buildExportFilenameWithSuffix = (
  baseName: string,
  suffix: string,
  ext: string,
): string => {
  const date = today()
  const counter = nextCounter(date)
  const clean = sanitize(baseName)
  const cleanSuffix = sanitize(suffix).replace(/\s+/g, '-')
  const safeExt = (ext ?? '').replace(/^\.+/, '').toLowerCase() || 'bin'
  const counterStr = String(counter).padStart(3, '0')
  return `${date}_${clean}_${counterStr}_${cleanSuffix}.${safeExt}`
}
