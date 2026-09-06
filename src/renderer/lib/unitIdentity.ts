// ───────────────────────────────────────────────────────────────────────────
// Zwei Identitäten je Einheit, und wer welche liest (Bedarf 107, P3).
//
//   > Systems with a single code field force the warehouse to choose which
//   > identity to store; the other one is then needed for insurance, sub-hire
//   > to third parties and maintenance history, and gets kept in a spreadsheet
//   > or ON THE CASE WITH A MARKER.
//
// Beleg zweiter Hand aus dem Schwester-Dossier: Rentman trennt „Internal
// Reference" von „Manufacturer Serial Number" ausdruecklich, und zwar weil die
// zweite fuer Versicherung, Fremdvermietung und das Wartungsmodul gebraucht
// wird. Die Bedarfs-Datenbank zieht daraus die Konsequenz fuer den Zeitpunkt:
// „Cheap today, expensive after the first real deployment."
//
// ─── EINE ENGSTELLE FUER „WIE HEISST DIESE KISTE AUF DEM BLATT" ────────────
//
// Vor diesem Modul stand an drei Stellen dieselbe Zeile:
//   `u.serial || u.code || u.id.slice(0, 6)`
// Drei Kopien einer Regel, die sich mit zwei Identitaeten aendern MUSS — und
// die dritte haette man beim Aendern uebersehen. Sie steht jetzt einmal hier.
//
// ─── UND DIE REGEL SELBST ──────────────────────────────────────────────────
//
// Wer liest, entscheidet, was vorne steht:
//
//   `house`     Kommissionierliste, Inventur, Packliste. Die Hausreferenz
//               ist die Nummer, die auf dem Case klebt und die der Lagerist
//               ruft.
//   `external`  Versicherung, Sub-Vermietung, Wartung. Dort zaehlt die
//               HERSTELLERNUMMER; eine Hausnummer bedeutet ausserhalb des
//               Hauses nichts, und auf einem Versicherungsblatt ist sie
//               schlimmer als eine leere Zelle: sie sieht aus wie eine
//               Seriennummer.
//
// Fehlt die gewuenschte, wird die andere genommen — aber BENANNT. „AV-0421
// (Hausreferenz)" auf einem Versicherungsblatt ist eine Auskunft; „AV-0421"
// allein ist eine Verwechslung.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { InventoryUnit } from '../types/inventory'
import type { CsvTable } from './csv'

export type IdentityAudience = 'house' | 'external'

/** Wie eine fremde Nummer beschriftet wird, wenn die gewuenschte fehlt. */
export const HOUSE_REF_NOTE = 'Hausreferenz'
export const SERIAL_NOTE = 'Herstellernummer'
/** Was dasteht, wenn die Einheit gar keine Nummer traegt. */
export const NO_IDENTITY = 'ohne Nummer'

/**
 * Die eine Beschriftung einer Einheit auf einem Blatt.
 *
 * Der Etiketten-Code (`code`) kommt als DRITTE Wahl: er ist eine
 * Scan-Kennung und keine Identitaet — zwei Einheiten koennen nacheinander
 * denselben aufgeklebt bekommen, wenn eine ausgemustert wurde.
 */
export function unitLabel(unit: InventoryUnit, audience: IdentityAudience): string {
  const serial = unit.serial?.trim()
  const house = unit.houseRef?.trim()
  const code = unit.code?.trim()
  const bevorzugt = audience === 'external' ? serial : house
  if (bevorzugt) return bevorzugt
  const ersatz = audience === 'external' ? house : serial
  if (ersatz) {
    return `${ersatz} (${audience === 'external' ? HOUSE_REF_NOTE : SERIAL_NOTE})`
  }
  if (code) return code
  return NO_IDENTITY
}

export type IdentityFindingKind = 'serial-duplicate' | 'houseref-duplicate' | 'no-identity'

export const IDENTITY_FINDING_LABEL: Readonly<Record<IdentityFindingKind, string>> = {
  'serial-duplicate': 'Zwei Einheiten mit derselben Herstellernummer',
  'houseref-duplicate': 'Zwei Einheiten mit derselben Hausreferenz',
  'no-identity': 'Einheit ganz ohne Nummer',
}

export interface IdentityFinding {
  kind: IdentityFindingKind
  text: string
  unitIds: string[]
}

const gruppiere = (
  units: readonly InventoryUnit[],
  feld: (u: InventoryUnit) => string | undefined,
): Map<string, InventoryUnit[]> => {
  const m = new Map<string, InventoryUnit[]>()
  for (const u of units) {
    // Gross-/Kleinschreibung und Bindestriche zaehlen nicht: „av-0421" und
    // „AV0421" sind dieselbe Nummer, zweimal getippt. Dieselbe Normalisierung
    // wie bei `sameSerial` in `assetIdentity.ts` (Bedarf 78).
    const k = (feld(u) ?? '').trim().replace(/[\s-]/g, '').toLowerCase()
    if (!k) continue
    m.set(k, [...(m.get(k) ?? []), u])
  }
  return m
}

/**
 * Was an den Nummern nicht stimmt.
 *
 * Beide Doppelungen sind unmoeglich und deshalb aussagekraeftig: eine
 * Herstellernummer gibt es genau einmal auf der Welt, eine Hausreferenz genau
 * einmal im Haus. Eine doppelte heisst entweder Tippfehler oder doppelt
 * angelegte Einheit — und im zweiten Fall zaehlt die Inventur eine Kiste zu
 * viel.
 */
export function identityFindings(units: readonly InventoryUnit[]): IdentityFinding[] {
  const out: IdentityFinding[] = []
  for (const [k, gruppe] of gruppiere(units, (u) => u.serial)) {
    if (gruppe.length < 2) continue
    out.push({
      kind: 'serial-duplicate',
      unitIds: gruppe.map((u) => u.id),
      text: `${gruppe.length} Einheiten tragen die Herstellernummer „${k}". Eine Seriennummer gibt es genau einmal — entweder ist eine falsch getippt, oder dieselbe Kiste steht zweimal im Bestand und die Inventur zählt eine zu viel.`,
    })
  }
  for (const [k, gruppe] of gruppiere(units, (u) => u.houseRef)) {
    if (gruppe.length < 2) continue
    out.push({
      kind: 'houseref-duplicate',
      unitIds: gruppe.map((u) => u.id),
      text: `${gruppe.length} Einheiten tragen die Hausreferenz „${k}". Im eigenen Haus ist das die Nummer, die der Lagerist ruft — sie zweimal zu vergeben heißt, dass er die falsche Kiste holt.`,
    })
  }
  const ohne = units.filter(
    (u) => !u.serial?.trim() && !u.houseRef?.trim() && !u.code?.trim(),
  )
  if (ohne.length > 0) {
    out.push({
      kind: 'no-identity',
      unitIds: ohne.map((u) => u.id),
      text: `${ohne.length} Einheit(en) tragen weder Herstellernummer noch Hausreferenz noch Etiketten-Code. Auf jedem Blatt stehen sie als „${NO_IDENTITY}" — unterscheidbar sind sie dann nur über ihren Platz im Regal.`,
    })
  }
  return out
}

/**
 * Beide Identitäten nebeneinander — das Blatt für die Versicherung und für
 * die Sub-Vermietung.
 *
 * Genau das ist der Zweck der Trennung: eine Liste, die BEIDE Nummern trägt,
 * musste bisher von Hand aus zwei Quellen zusammengeschrieben werden.
 */
export function identityTable(
  units: readonly InventoryUnit[],
  modelOf: (unit: InventoryUnit) => string,
): CsvTable {
  return {
    headers: ['Modell', 'Herstellernummer', 'Hausreferenz', 'Etiketten-Code'],
    rows: units.map((u) => [
      modelOf(u),
      u.serial?.trim() || NO_IDENTITY,
      u.houseRef?.trim() || NO_IDENTITY,
      u.code?.trim() || NO_IDENTITY,
    ]),
  }
}
