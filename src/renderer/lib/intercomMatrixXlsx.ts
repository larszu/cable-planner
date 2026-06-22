/**
 * Issue: Intercom-Excel ↔ GreenGo config round-trip.
 *
 * The user produces a planning spreadsheet (see PFIJUKO25 example) that
 * lists every intercom user as a row and every reachable group/user as a
 * column. Each "x" in the matrix means "user A talks to / belongs to
 * resource B". We parse that into a GreenGoConfig (.gg5 logical shape)
 * and can serialize a GreenGoConfig back into the same XLSX layout so the
 * Excel file stays in sync with whatever the user edits in the matrix
 * view inside the app.
 *
 * Layout assumptions (extracted from the supplied PFIJUKO25 file — the
 * format is loose enough that we sniff section headers instead of
 * hardcoding column numbers):
 *
 *   Row containing "Equipment", "Gruppen", "User" cells → column-group header
 *   Row directly below it (numeric IDs 1.. and 101..) → ID row
 *   Row directly below the ID row (BPX, PGM, V Bimi, …) → label row
 *   All subsequent rows where col B has a numeric user-id and col D has a
 *   non-empty name → user rows. "x" cells under group columns mean
 *   user ∈ group; "x" cells under user columns are direct-talk entries
 *   that we capture as a `directTalkUserIds` audit array (we don't
 *   reflect them in .gg5 groupIds because GreenGo's data model lists
 *   group memberships, not user-to-user shortcuts).
 */

// v7.9.4 — Wechsel von 'xlsx' auf 'xlsx-js-style' (drop-in API).
// Grund: Das offizielle 'xlsx' Paket auf npm ist auf 0.18.5 stehen
// geblieben, der Maintainer published nur noch auf cdn.sheetjs.com.
// 0.18.5 hat zwei offene High-Severity-Advisories (Prototype
// Pollution + ReDoS beim Parsen), und beim Intercom-Matrix-Import
// parsen wir User-Files. 'xlsx-js-style' ist ein maintained Fork
// mit identischer API + bewussten Patches gegen die CVEs.
// Nur als Typ importieren (wird beim Build entfernt) — so landet SheetJS'
// top-level require('stream') NICHT im Startup-Bundle. Der Laufzeit-Wert
// wird in den beiden Funktionen unten per dynamischem import() lazy geladen:
// hält die schwere Lib aus dem Initial-Chunk und beseitigt Vites
// "stream has been externalized"-Dev-Warnung.
import type * as XLSXNs from 'xlsx-js-style'
import type { GreenGoConfig, GreenGoGroup, GreenGoUser } from '../types/greengo'
import { translate, format } from './i18n'
import { useUiStore } from '../store/uiStore'

const tr = (key: string, fallback: string) =>
  translate(useUiStore.getState().language, key, fallback)

/** What a single cell can contain after we've stringified it. */
type Cell = string

const SECTION_HEADER_LABELS = ['Equipment', 'Gruppen', 'User'] as const
type SectionHeader = (typeof SECTION_HEADER_LABELS)[number]

interface SectionRange {
  header: SectionHeader
  startCol: number
  /** Exclusive — the column where the next section starts (or sheet width). */
  endCol: number
}

interface MatrixLayout {
  sectionHeaderRow: number
  idRow: number
  labelRow: number
  sections: SectionRange[]
  /** First row of user data (1-based). */
  firstUserRow: number
  /** Width of the data area on the sheet. */
  width: number
  /** Height of the data area on the sheet. */
  height: number
}

const cellAt = (rows: Cell[][], r: number, c: number): string =>
  (rows[r] && rows[r][c]) ?? ''

const isMark = (s: string): boolean => {
  const t = s.trim().toLowerCase()
  return t === 'x' || t === '✓' || t === 'y' || t === 'ja' || t === '1'
}

/** Trim and collapse whitespace inside a cell — the source spreadsheet
 *  often contains leading/trailing spaces in shared strings. */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

/** Find a row whose cells contain at least two of the section header
 *  labels (`Equipment`, `Gruppen`, `User`). Returns -1 if the file
 *  doesn't look like an intercom matrix. */
const findSectionHeaderRow = (rows: Cell[][]): number => {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? []
    const hits = SECTION_HEADER_LABELS.filter((label) =>
      row.some((cell) => norm(cell) === label),
    ).length
    if (hits >= 2) return r
  }
  return -1
}

const findSectionsInRow = (row: Cell[]): SectionRange[] => {
  const found: { header: SectionHeader; col: number }[] = []
  for (let c = 0; c < row.length; c++) {
    const label = norm(row[c]) as SectionHeader
    if (SECTION_HEADER_LABELS.includes(label)) {
      found.push({ header: label, col: c })
    }
  }
  found.sort((a, b) => a.col - b.col)
  return found.map((f, i) => ({
    header: f.header,
    startCol: f.col,
    endCol: i + 1 < found.length ? found[i + 1].col : row.length,
  }))
}

const detectLayout = (rows: Cell[][]): MatrixLayout | { error: string } => {
  const sectionHeaderRow = findSectionHeaderRow(rows)
  if (sectionHeaderRow < 0) {
    return {
      error: tr(
        'intercomXlsx.noMatrixDetected',
        'Konnte keine Intercom-Matrix erkennen — es fehlt eine Zeile mit den Spaltenüberschriften "Equipment", "Gruppen" und "User".',
      ),
    }
  }
  const headerCells = rows[sectionHeaderRow] ?? []
  const sections = findSectionsInRow(headerCells)
  if (sections.length === 0) {
    return { error: tr('intercomXlsx.noSections', 'Keine Spalten-Sektionen unterhalb der Header gefunden.') }
  }
  // ID row sits immediately below the header row; label row directly
  // after it. Some templates may have one extra spacer row between
  // header and id — we look for the first row that has at least 2
  // numeric cells in the Group section to be robust.
  let idRow = sectionHeaderRow + 1
  const groupSection = sections.find((s) => s.header === 'Gruppen')
  if (groupSection) {
    for (let r = sectionHeaderRow + 1; r < Math.min(sectionHeaderRow + 4, rows.length); r++) {
      const numericInGroupSection = rows[r]
        ?.slice(groupSection.startCol, groupSection.endCol)
        .filter((c) => /^\d+$/.test(norm(c))).length ?? 0
      if (numericInGroupSection >= 2) {
        idRow = r
        break
      }
    }
  }
  const labelRow = idRow + 1
  return {
    sectionHeaderRow,
    idRow,
    labelRow,
    sections,
    firstUserRow: labelRow + 1,
    width: Math.max(...rows.map((r) => r.length)),
    height: rows.length,
  }
}

export interface IntercomXlsxImportResult {
  config: GreenGoConfig
  /** Audit: user→user direct-talk marks that didn't map onto groups. */
  directTalkPairs: Array<{ fromUserId: number; toUserId: number; note: string }>
  /** Audit: equipment-section "x" marks — meaning the user uses a
   *  particular hardware type (BPX, MCX, SI4WR…). Stored so the caller
   *  can show "this user uses 3 hardware types" but we don't push it
   *  into the .gg5 because GreenGo doesn't model that. */
  equipmentMarks: Array<{ userId: number; label: string }>
  /** Audit/warning strings to surface to the user. */
  warnings: string[]
}

/**
 * Parse an XLSX file into a GreenGoConfig. The first worksheet is used.
 * Throws on malformed files; returns `{ error }` for unrecognised
 * layouts.
 */
export const parseIntercomMatrixXlsx = async (
  data: ArrayBuffer | Uint8Array,
): Promise<IntercomXlsxImportResult | { error: string }> => {
  const XLSX = await import('xlsx-js-style')
  let workbook: XLSXNs.WorkBook
  try {
    workbook = XLSX.read(data, { type: 'array' })
  } catch (err) {
    return {
      error: format(tr('intercomXlsx.readError', 'XLSX konnte nicht gelesen werden: {msg}'), {
        msg: (err as Error).message,
      }),
    }
  }
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { error: tr('intercomXlsx.noSheet', 'Keine Tabelle in der Datei gefunden.') }
  const sheet = workbook.Sheets[sheetName]
  // Get raw cell values as strings; XLSX returns a 2D array.
  const rows: Cell[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  }) as Cell[][]
  if (rows.length === 0) return { error: tr('intercomXlsx.emptySheet', 'Die erste Tabelle ist leer.') }

  const layoutOrError = detectLayout(rows)
  if ('error' in layoutOrError) return layoutOrError
  const layout = layoutOrError

  const groupSection = layout.sections.find((s) => s.header === 'Gruppen')
  const userSection = layout.sections.find((s) => s.header === 'User')
  const equipmentSection = layout.sections.find((s) => s.header === 'Equipment')

  // ─── Build group list from the Gruppen section ────────────────────────────
  const groups: GreenGoGroup[] = []
  /** column → group id, so we can dereference x-marks in user rows. */
  const groupColumnMap = new Map<number, number>()
  if (groupSection) {
    for (let c = groupSection.startCol; c < groupSection.endCol; c++) {
      const idStr = norm(cellAt(rows, layout.idRow, c))
      const label = norm(cellAt(rows, layout.labelRow, c))
      if (!label) continue
      const id = /^\d+$/.test(idStr) ? Number(idStr) : groups.length + 1
      groups.push({ id, name: label })
      groupColumnMap.set(c, id)
    }
  }

  // ─── Build user list & memberships ────────────────────────────────────────
  const users: GreenGoUser[] = []
  const userColumnMap = new Map<number, number>() // column → user id
  if (userSection) {
    for (let c = userSection.startCol; c < userSection.endCol; c++) {
      const idStr = norm(cellAt(rows, layout.idRow, c))
      if (/^\d+$/.test(idStr)) userColumnMap.set(c, Number(idStr))
    }
  }

  const directTalkPairs: IntercomXlsxImportResult['directTalkPairs'] = []
  const equipmentMarks: IntercomXlsxImportResult['equipmentMarks'] = []
  const warnings: string[] = []

  for (let r = layout.firstUserRow; r < rows.length; r++) {
    const row = rows[r] ?? []
    // User-id column is usually 2 (column "B") but in the sample it's
    // column index 1 (B). Be defensive: take the first numeric cell in
    // the row before the equipment section, and the first non-empty
    // label after it as the user name.
    let idCol = -1
    for (let c = 0; c < (equipmentSection?.startCol ?? 4); c++) {
      if (/^\d+$/.test(norm(row[c] ?? ''))) {
        idCol = c
        break
      }
    }
    if (idCol < 0) continue
    const id = Number(norm(row[idCol]))
    // Find user name: first non-empty cell after idCol but before the
    // first matrix section.
    let name = ''
    for (let c = idCol + 1; c < (equipmentSection?.startCol ?? row.length); c++) {
      const v = norm(row[c] ?? '')
      if (v && !isMark(v)) {
        name = v
        break
      }
    }
    if (!name) continue

    const groupIds: number[] = []
    if (groupSection) {
      for (let c = groupSection.startCol; c < groupSection.endCol; c++) {
        if (isMark(cellAt(rows, r, c))) {
          const gid = groupColumnMap.get(c)
          if (gid !== undefined && !groupIds.includes(gid)) groupIds.push(gid)
        }
      }
    }
    if (userSection) {
      for (let c = userSection.startCol; c < userSection.endCol; c++) {
        if (!isMark(cellAt(rows, r, c))) continue
        const targetUserId = userColumnMap.get(c)
        if (targetUserId !== undefined && targetUserId !== id) {
          directTalkPairs.push({
            fromUserId: id,
            toUserId: targetUserId,
            note: `Direkt-Linie: ${name} → User ${targetUserId}`,
          })
        }
      }
    }
    if (equipmentSection) {
      for (let c = equipmentSection.startCol; c < equipmentSection.endCol; c++) {
        if (!isMark(cellAt(rows, r, c))) continue
        const label = norm(cellAt(rows, layout.labelRow, c))
        if (label) equipmentMarks.push({ userId: id, label })
      }
    }

    users.push({ id, name, groupIds })
  }

  // Sanity warnings
  if (groups.length === 0) {
    warnings.push(tr('intercomXlsx.noGroups', 'Keine Gruppen erkannt — prüfe die "Gruppen"-Spalten im Sheet.'))
  }
  if (users.length === 0) {
    warnings.push(tr('intercomXlsx.noUsers', 'Keine Benutzer erkannt — prüfe die Benutzer-Zeilen unterhalb der Spaltenköpfe.'))
  }
  if (users.length > 0 && users.every((u) => u.groupIds.length === 0)) {
    warnings.push(
      tr(
        'intercomXlsx.noUserGroups',
        'Kein Benutzer ist einer Gruppe zugeordnet — bitte prüfen ob die Matrix-Markierungen ("x") korrekt erkannt wurden.',
      ),
    )
  }

  // Pull the project title (workbook content above the matrix) for a
  // sensible systemName.
  let systemName = 'Intercom-Setup'
  for (let r = 0; r < layout.sectionHeaderRow; r++) {
    const cells = (rows[r] ?? []).map(norm).filter(Boolean)
    if (cells.length > 0 && cells.some((c) => c.length > 4)) {
      systemName = cells.find((c) => c.length > 4) ?? systemName
      break
    }
  }

  return {
    config: {
      systemName,
      description: `Importiert aus XLSX (${new Date().toLocaleString()})`,
      multicastAddress: '239.1.160.1',
      sampleRate: 32000,
      users,
      groups,
    },
    directTalkPairs,
    equipmentMarks,
    warnings,
  }
}

/* ────────────────────────────────────────────────────────────────────────── *\
 *  Export: GreenGoConfig → XLSX                                              *
\* ────────────────────────────────────────────────────────────────────────── */

/**
 * Render the given GreenGoConfig as an Excel matrix in the same layout
 * the importer expects, so the round-trip is symmetric.
 *
 * Columns (1-based):
 *   A: spacer / left margin
 *   B: numeric user id
 *   C: optional function (left blank in the basic export)
 *   D: user display name
 *   E…: one column per group (header in idRow, label in labelRow)
 *
 * The export omits the Equipment + per-user direct-line columns from
 * the original spreadsheet — those weren't part of the .gg5 model. We
 * document this with a banner row above the matrix so the user knows
 * the Excel file is a faithful representation of what's stored in
 * GreenGo, not a 1:1 copy of any uploaded source.
 */
export const exportIntercomMatrixXlsx = async (config: GreenGoConfig): Promise<ArrayBuffer> => {
  const XLSX = await import('xlsx-js-style')
  const ID_COL = 1
  const FN_COL = 2
  const NAME_COL = 3
  const FIRST_GROUP_COL = 4

  const titleRow = 1
  const sectionHeaderRow = 3
  const idRow = 4
  const labelRow = 5
  const firstUserRow = 6

  const numGroups = config.groups.length
  const lastGroupCol = FIRST_GROUP_COL + Math.max(0, numGroups - 1)

  // Build a 2D array of cells. XLSX.utils.aoa_to_sheet ingests this.
  const rowCount = firstUserRow + config.users.length + 2
  const colCount = Math.max(FIRST_GROUP_COL + numGroups, NAME_COL + 1) + 1
  const aoa: (string | number)[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => ''),
  )

  aoa[titleRow][ID_COL] = `${config.systemName} — Intercom Matrix`
  aoa[sectionHeaderRow][NAME_COL] = 'User'
  if (numGroups > 0) aoa[sectionHeaderRow][FIRST_GROUP_COL] = 'Gruppen'

  // Group ID/label row
  config.groups.forEach((g, i) => {
    aoa[idRow][FIRST_GROUP_COL + i] = g.id
    aoa[labelRow][FIRST_GROUP_COL + i] = g.name
  })

  // User rows
  const groupIdToCol = new Map<number, number>(
    config.groups.map((g, i) => [g.id, FIRST_GROUP_COL + i]),
  )
  config.users.forEach((u, i) => {
    const row = firstUserRow + i
    aoa[row][ID_COL] = u.id
    aoa[row][NAME_COL] = u.name
    void aoa[row][FN_COL] // intentionally left blank
    for (const gid of u.groupIds) {
      const col = groupIdToCol.get(gid)
      if (col !== undefined) aoa[row][col] = 'x'
    }
  })

  // Footer note about scope
  aoa[firstUserRow + config.users.length + 1][ID_COL] =
    `Exportiert aus Cable Planner · ${new Date().toLocaleString()} · ${config.users.length} User × ${config.groups.length} Gruppen`

  const sheet = XLSX.utils.aoa_to_sheet(aoa)

  // Column widths so the export looks like the source on first open.
  sheet['!cols'] = [
    { wch: 3 },
    { wch: 5 },
    { wch: 16 },
    { wch: 24 },
    ...config.groups.map(() => ({ wch: 8 })),
  ]
  // Mark the matrix range so Excel doesn't auto-trim.
  sheet['!ref'] = XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: {
      c: Math.max(lastGroupCol, NAME_COL),
      r: firstUserRow + config.users.length + 1,
    },
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Intercom Matrix')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
