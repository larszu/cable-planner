// ───────────────────────────────────────────────────────────────────────────
// Verdaechtige Einheiten (Bedarf 52, P2).
//
// Warum die Historie an der Lager-Einheit haengt und nicht am Plan-Kabel,
// steht in `types/inventory.ts` beim `fault`-Ereignis. Hier steht, was daraus
// abgeleitet wird — und was ausdruecklich nicht.
//
// ─── DIE EINE FRAGE, DIE DER BEDARF STELLT ─────────────────────────────────
//
//   > which drum is suspect lives only in crew memory
//
// „Verdaechtig" ist kein Zustand, den jemand setzt, sondern eine Zaehlung:
// wie viele OFFENE Fehler stehen an dieser Einheit. Genau deshalb traegt das
// Ereignis `services` und `resolved` als Felder und nicht als Freitext — ein
// Satz laesst sich nicht zaehlen.
//
// ─── WAS HIER NICHT GERECHNET WIRD ─────────────────────────────────────────
//
// Keine Ausfallrate, keine Restlebensdauer, keine Wahrscheinlichkeit. Der
// Beleg dieses Bedarfs ist zweiter Hand, und selbst ein erster gaebe fuer
// solche Zahlen nichts her: dafuer braeuchte es Einsatzstunden je Einheit, die
// dieser Planer nicht kennt. Eine Prozentzahl waere eine erfundene Messung —
// dieselbe Grenze wie bei „is it flowing" (Bedarf 76) und beim Sendebericht
// (Bedarf 87).
//
// Und: KEINE AUTOMATISCHE SPERRE. Ob eine verdaechtige Trommel mitfaehrt,
// entscheidet ein Mensch — vielleicht ist sie die einzige, die da ist. Der
// Planer sagt es ihm, er entscheidet nicht fuer ihn.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import {
  FAULT_SERVICE_LABEL,
  type FaultService,
  type InventoryItem,
  type InventoryUnit,
  type UnitEvent,
} from '../types/inventory'
import type { CsvTable } from './csv'

/** Die Fehler-Ereignisse einer Einheit, juengste zuerst. */
export const faultsOf = (unit: InventoryUnit): UnitEvent[] =>
  unit.history.filter((e) => e.kind === 'fault').sort((a, b) => b.at.localeCompare(a.at))

/**
 * Die OFFENEN Fehler. Ein Ereignis ohne `resolved` gilt als offen.
 *
 * Die Richtung ist Absicht: ein unbeantwortetes „ist das behoben?" als
 * erledigt zu lesen ist genau der Weg, auf dem dieselbe Trommel wieder
 * rausgeht.
 */
export const openFaultsOf = (unit: InventoryUnit): UnitEvent[] =>
  faultsOf(unit).filter((e) => e.resolved !== true)

/** Alle Dienste, die an dieser Einheit je ausgefallen sind — ohne Doppelte. */
export const affectedServices = (unit: InventoryUnit): FaultService[] => {
  const s = new Set<FaultService>()
  for (const e of faultsOf(unit)) for (const x of e.services ?? []) s.add(x)
  return [...s]
}

export interface SuspectUnit {
  unit: InventoryUnit
  /** Anzahl offener Fehler. Die Zahl ist der ganze Verdacht. */
  open: number
  /** Anzahl aller je gemeldeten Fehler, auch der erledigten. */
  total: number
  services: FaultService[]
  /** Zeitpunkt des juengsten Fehlers, oder leer. */
  lastAt: string
}

/**
 * Die verdaechtigen Einheiten, die mit den meisten offenen Fehlern zuerst.
 *
 * Einheiten ohne Fehler stehen NICHT in der Liste. Eine Liste, in der alles
 * steht, beantwortet die Frage des Bedarfs nicht — sie stellt sie neu.
 */
export function suspectUnits(units: readonly InventoryUnit[]): SuspectUnit[] {
  return units
    .map((unit) => {
      const alle = faultsOf(unit)
      return {
        unit,
        open: openFaultsOf(unit).length,
        total: alle.length,
        services: affectedServices(unit),
        lastAt: alle[0]?.at ?? '',
      }
    })
    .filter((s) => s.total > 0)
    .sort(
      (a, b) =>
        b.open - a.open ||
        b.total - a.total ||
        b.lastAt.localeCompare(a.lastAt) ||
        a.unit.id.localeCompare(b.unit.id),
    )
}

const NO_SERIAL = 'ohne Seriennummer'
const NO_MODEL = 'Modell unbekannt'
const NO_SERVICE = 'keine Dienste genannt'
const NO_DATE = 'ohne Datum'

/**
 * Das Blatt: welche Einheit ist verdaechtig, womit, und seit wann.
 *
 * Die Spalte „Dienste" ist der Grund, warum dieses Blatt existiert: ein Fehler
 * an einem Strang, der Bild UND Comms mitgenommen hat, ist eine andere
 * Auskunft als einer, bei dem nur das Tally weg war — und im Gedaechtnis der
 * Crew verschwimmt genau dieser Unterschied.
 */
export function faultTable(
  units: readonly InventoryUnit[],
  items: readonly InventoryItem[],
): CsvTable {
  const modell = new Map(items.map((i) => [i.id, i.model]))
  return {
    headers: ['Objekt', 'Serie (Einheit)', 'Offene Fehler', 'Fehler gesamt', 'Dienste', 'Zuletzt'],
    rows: suspectUnits(units).map((s) => [
      modell.get(s.unit.itemId) ?? NO_MODEL,
      s.unit.serial?.trim() || NO_SERIAL,
      s.open,
      s.total,
      s.services.length > 0
        ? s.services.map((x) => FAULT_SERVICE_LABEL[x]).join(', ')
        : NO_SERVICE,
      s.lastAt || NO_DATE,
    ]),
  }
}

/**
 * Normalisiert ein Fehler-Ereignis beim Laden.
 *
 * Ein unbekannter Dienstname fliegt raus, statt als Zeichenkette
 * durchgereicht zu werden: die Spalte „Dienste" waere sonst eine Mischung aus
 * uebersetzten und rohen Namen, und die Zaehlung nach Dienst zerfiele.
 */
export function normaliseFaultEvent(raw: unknown): Pick<UnitEvent, 'services' | 'resolved'> {
  const o = (raw ?? {}) as Record<string, unknown>
  const gueltig = new Set(Object.keys(FAULT_SERVICE_LABEL))
  const services = (Array.isArray(o.services) ? o.services : [])
    .filter((x): x is FaultService => typeof x === 'string' && gueltig.has(x))
  return {
    ...(services.length > 0 ? { services: [...new Set(services)] } : {}),
    // `resolved` bleibt nur als AUSDRUECKLICHES `true` erhalten. Alles andere
    // heisst offen — siehe `openFaultsOf`.
    ...(o.resolved === true ? { resolved: true } : {}),
  }
}
