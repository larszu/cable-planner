// ───────────────────────────────────────────────────────────────────────────
// Wartungs- und Prüfplan — wann welches Gerät das nächste Mal dran ist.
//
// Das Asset-Register führt Intervall und letzten Service schon je Gerät. Was
// es nicht sagt, ist das eine Datum, nach dem der Betreiber fragt: WANN. Das
// rechnet dieses Blatt, und nur, wo es sich rechnen lässt.
//
// ─── DIE BASIS DER RECHNUNG ────────────────────────────────────────────────
//
// Nächste Wartung = Ausgangsdatum + Intervall. Ausgangsdatum ist
//
//   1. der jüngste Service-Eintrag am Gerät, sonst
//   2. das Übergabe-Datum der Anlage — ab da läuft der Betrieb, sonst
//   3. nichts. Dann steht das Feld leer und der Befund sagt, warum.
//
// Welche Basis galt, steht in einer eigenen Spalte. Ein Datum aus dem
// Übergabe-Tag sieht sonst genauso aus wie eines aus einer tatsächlichen
// Wartung, und nur das zweite belegt, dass jemand am Gerät war.
//
// ─── WAS HIER BEWUSST NICHT STEHT ──────────────────────────────────────────
//
// Keine Prüffristen nach Vorschrift (etwa die Wiederholungsprüfung
// ortsveränderlicher Geräte). Ob eine gilt und welche Frist, hängt vom
// Einsatz ab und steht nicht im Plan; eine hier eingesetzte Frist sähe aus
// wie eine Auskunft und wäre eine Annahme. Wer eine braucht, trägt sie als
// Wartungsintervall am Gerät ein — dann steht sie auch hier.
//
// Kein „überfällig": das hinge vom heutigen Tag ab, und der Stand desselben
// Plans änderte sich über Nacht. Sortiert wird nach Fälligkeit — das Obere
// ist das Dringende.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { CsvCell, CsvTable } from './csv'
import { equipmentAssetTag } from './docIds'
import { standortText } from './equipmentLocation'
import { vergleich } from './druckblatt'

export type WartungsBasis = 'service' | 'uebergabe'

export interface WartungsZeile {
  geraetId: string
  geraet: string
  assetTag: string
  standort: string
  intervallTage?: number
  letzterService: string
  basis?: WartungsBasis
  /** ISO-Tag, leer wenn nicht zu rechnen. */
  naechste: string
  garantieBis: string
  befund?: 'kein-intervall' | 'keine-basis' | 'basis-unlesbar'
}

const TAG_MS = 86_400_000

/** `YYYY-MM-DD…` → Mitternacht UTC, oder `null`. Ohne Zeitzone: dasselbe Datum auf jedem Rechner. */
const alsTag = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(ms) ? null : ms
}

export function wartungsplan(project: CablePlannerProject): WartungsZeile[] {
  const uebergabe = project.metadata.handoverDate ?? ''
  const zeilen: WartungsZeile[] = []
  for (const e of project.equipment) {
    const intervall = typeof e.maintenanceIntervalDays === 'number' && e.maintenanceIntervalDays > 0 ? e.maintenanceIntervalDays : undefined
    if (intervall === undefined && !e.warrantyUntil) continue
    const letzter = (e.serviceHistory ?? []).reduce<string>((acc, r) => (r.date > acc ? r.date : acc), '')
    const basis: WartungsBasis | undefined = letzter ? 'service' : uebergabe ? 'uebergabe' : undefined
    const zeile: WartungsZeile = {
      geraetId: e.id,
      geraet: e.name,
      assetTag: equipmentAssetTag(e),
      standort: standortText(e, project.locations ?? []),
      ...(intervall !== undefined ? { intervallTage: intervall } : {}),
      letzterService: letzter,
      ...(basis ? { basis } : {}),
      naechste: '',
      garantieBis: e.warrantyUntil ?? '',
    }
    if (intervall === undefined) zeile.befund = 'kein-intervall'
    else if (!basis) zeile.befund = 'keine-basis'
    else {
      const start = alsTag(basis === 'service' ? letzter : uebergabe)
      if (start === null) zeile.befund = 'basis-unlesbar'
      else zeile.naechste = new Date(start + intervall * TAG_MS).toISOString().slice(0, 10)
    }
    zeilen.push(zeile)
  }
  return zeilen.sort(
    (a, b) =>
      // Leere Fälligkeit nach hinten — sie ist kein Datum, sondern eine Lücke.
      (a.naechste ? 0 : 1) - (b.naechste ? 0 : 1) ||
      vergleich(a.naechste, b.naechste) ||
      vergleich(a.geraet, b.geraet) ||
      vergleich(a.geraetId, b.geraetId),
  )
}

const BASIS_TEXT: Record<WartungsBasis, string> = { service: 'Letzter Service', uebergabe: 'Übergabe' }

const befundText = (z: WartungsZeile, uebergabe: string): string =>
  z.befund === 'kein-intervall'
    ? 'kein Wartungsintervall angegeben'
    : z.befund === 'keine-basis'
      ? 'kein Ausgangsdatum: weder Service-Eintrag noch Übergabe-Datum'
      : z.befund === 'basis-unlesbar'
        ? `Ausgangsdatum nicht lesbar: ${z.basis === 'service' ? z.letzterService : uebergabe}`
        : ''

/** Kanonisch deutsch — gestempelt, der Stand darf nicht an der Sprache hängen. */
export const wartungsplanTable = (project: CablePlannerProject): CsvTable => {
  const uebergabe = project.metadata.handoverDate ?? ''
  return {
    headers: [
      'Gerät',
      'Asset-Tag',
      'Standort',
      'Wartungsintervall (Tage)',
      'Letzter Service',
      'Basis',
      'Nächste Wartung',
      'Garantie bis',
      'Befund',
    ],
    rows: wartungsplan(project).map((z): CsvCell[] => [
      z.geraet,
      z.assetTag,
      z.standort,
      z.intervallTage ?? '',
      z.letzterService,
      z.basis ? BASIS_TEXT[z.basis] : '',
      z.naechste,
      z.garantieBis,
      befundText(z, uebergabe),
    ]),
  }
}
