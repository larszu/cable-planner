// ───────────────────────────────────────────────────────────────────────────
// Anhänge — was im Projekt über die Dateien in `Anhaenge/` steht.
//
// Das Verzeichnis ist die Liste, die mit der Übergabe an den Betreiber geht:
// welche Datei zu welchem Kabel oder Gerät gehört, mit Prüfsumme, damit sich
// in fünf Jahren sagen lässt, ob die Datei im Ordner noch dieselbe ist.
//
// ─── DIE LÜCKE, NACH DER ES FRAGT ──────────────────────────────────────────
//
// Ein Kabel mit eingetragenem Messergebnis, aber ohne Protokoll — weder als
// Anhang noch als Verweis im Messergebnis (`reportRef`). Das ist die eine
// Lücke, die der Plan selbst erkennen kann: die Messung behauptet er, den
// Beleg dafür hat er nicht. Eine fehlende Herstellerunterlage dagegen ist
// keine: der Plan weiss nicht, ob es zu einem Gerät eine gibt.
//
// Ob die Datei im Ordner liegt, steht NICHT in der Liste. Das ist eine Frage
// an das Dateisystem dieses Rechners, und der Stand des Verzeichnisses darf
// nicht davon abhängen, auf welchem Rechner man es ausgibt. Die Oberfläche
// fragt es live und sagt es an der Zeile.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import { ANHANG_ARTEN, ANHANG_ART_LABEL, type AnhangArt, type AnhangDatei, type ProjektAnhang } from '../types/anhang'
import type { CsvCell, CsvTable } from './csv'
import { vergleich } from './druckblatt'

const text = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

/**
 * Ein gespeicherter Pfad ist relativ und bleibt im Projektordner. main prüft
 * das ohnehin bei jedem Zugriff; hier fällt ein Eintrag, der es nicht tut,
 * schon beim Laden heraus, statt als Zeile zu erscheinen, hinter der main
 * jede Auskunft verweigert.
 */
const relativUndInnen = (p: string): boolean =>
  !p.startsWith('/') && !/^[A-Za-z]:/.test(p) && !p.split(/[\\/]/).includes('..')

const heileDatei = (roh: unknown): AnhangDatei | null => {
  if (!roh || typeof roh !== 'object') return null
  const d = roh as Record<string, unknown>
  if (!text(d.sha256) || !text(d.storedAs) || !relativUndInnen(d.storedAs)) return null
  return {
    sha256: d.sha256,
    fileName: text(d.fileName) ? d.fileName : d.storedAs,
    storedAs: d.storedAs,
    mediaType: text(d.mediaType) ? d.mediaType : 'application/octet-stream',
    bytes: typeof d.bytes === 'number' && d.bytes >= 0 ? d.bytes : 0,
    addedAt: text(d.addedAt) ? d.addedAt : '',
  }
}

/** Schema-Heilung für `healProjectPositions`. Leer → `undefined`, damit ein unverändertes Projekt keinen Unterschied zeigt. */
export function normaliseAnhaenge(roh: unknown): ProjektAnhang[] | undefined {
  if (!Array.isArray(roh)) return undefined
  const out: ProjektAnhang[] = []
  const ids = new Set<string>()
  for (const r of roh) {
    if (!r || typeof r !== 'object') continue
    const a = r as Record<string, unknown>
    const datei = heileDatei(a.datei)
    if (!text(a.id) || ids.has(a.id) || !datei) continue
    ids.add(a.id)
    const art = ANHANG_ARTEN.includes(a.art as AnhangArt) ? (a.art as AnhangArt) : 'sonstiges'
    const z = a.ziel as Record<string, unknown> | undefined
    const ziel =
      z && (z.type === 'cable' || z.type === 'equipment') && text(z.id)
        ? { type: z.type as 'cable' | 'equipment', id: z.id }
        : undefined
    out.push({ id: a.id, art, titel: typeof a.titel === 'string' ? a.titel : '', datei, ...(ziel ? { ziel } : {}) })
  }
  return out.length ? out : undefined
}

/** Ein neuer Eintrag aus einer frisch abgelegten Datei. */
export const neuerAnhang = (
  datei: AnhangDatei,
  art: AnhangArt,
  ziel: ProjektAnhang['ziel'],
  id: string,
): ProjektAnhang => ({ id, art, titel: '', datei, ...(ziel ? { ziel } : {}) })

/** Wie das Ziel heute heisst — oder `null`, wenn es nicht mehr im Plan ist. */
export const zielName = (project: CablePlannerProject, ziel: ProjektAnhang['ziel']): string | null => {
  if (!ziel) return ''
  if (ziel.type === 'cable') {
    const c = project.cables.find((x) => x.id === ziel.id)
    return c ? c.cableNumber || c.name || c.id : null
  }
  return project.equipment.find((x) => x.id === ziel.id)?.name ?? null
}

/** Kabel mit Messergebnis, zu denen weder ein Protokoll-Anhang noch ein `reportRef` besteht. */
export const messungenOhneProtokoll = (project: CablePlannerProject): string[] => {
  const mitProtokoll = new Set(
    (project.anhaenge ?? []).filter((a) => a.art === 'messprotokoll' && a.ziel?.type === 'cable').map((a) => a.ziel!.id),
  )
  return project.cables
    .filter((c) => c.testResult && !c.testResult.reportRef?.trim() && !mitProtokoll.has(c.id))
    .map((c) => c.id)
}

/** Kanonisch deutsch — das gestempelte Anhänge-Verzeichnis. */
export const anhaengeTable = (project: CablePlannerProject): CsvTable => {
  const zeilen: CsvCell[][] = (project.anhaenge ?? []).map((a) => {
    const name = zielName(project, a.ziel)
    return [
      ANHANG_ART_LABEL[a.art],
      a.titel || a.datei.fileName,
      name ?? '',
      a.datei.storedAs,
      Math.ceil(a.datei.bytes / 1024),
      a.datei.sha256,
      a.datei.addedAt.slice(0, 10),
      name === null ? 'Ziel nicht mehr im Plan' : '',
    ]
  })
  const kabel = new Map(project.cables.map((c) => [c.id, c]))
  for (const id of messungenOhneProtokoll(project)) {
    const c = kabel.get(id)!
    zeilen.push([ANHANG_ART_LABEL.messprotokoll, '', c.cableNumber || c.name || c.id, '', '', '', '', 'Messung eingetragen, Protokoll fehlt'])
  }
  zeilen.sort(
    (a, b) =>
      vergleich(String(a[0]), String(b[0])) ||
      vergleich(String(a[2]), String(b[2])) ||
      vergleich(String(a[1]), String(b[1])) ||
      vergleich(String(a[5]), String(b[5])),
  )
  return {
    headers: ['Art', 'Titel', 'Betrifft', 'Datei', 'Größe (KB)', 'SHA-256', 'Angehängt', 'Befund'],
    rows: zeilen,
  }
}
