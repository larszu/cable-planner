// ───────────────────────────────────────────────────────────────────────────
// #906 — Bestandsaufnahme: vorhandene Technik im Raum erfassen, bevor sie
// ausgearbeitet ist.
//
// „Schulungszentrum ohne Dokumentation": wer durch die Raeume geht, kennt
// Name, Raum und eine Vermutung („haengt am Beamer, HDMI?") — aber weder
// Datenblatt noch Buchsen. Bisher hiess das Zettel und spaeter jedes Geraet
// einzeln neu anlegen. Hier entsteht aus diesen drei Angaben sofort ein
// Geraet im Plan, das ehrlich unfertig ist:
//
//   * `portsUnknown` — keine erfundenen Buchsen; der Plan-Check fordert die
//     Ergaenzung ein, wie bei jeder Kamera aus einem fremden Import.
//   * `notes` — Raum, vermutete Verbindung und Notiz in Klartext, damit sie
//     ueberall stehen, wo Notizen stehen (Eigenschaften, Ausdruck, Export).
//   * `erfasst` — die Marke fuer die Arbeitsliste, bis jemand abhakt.
//
// Die vermutete Verbindung ist bewusst KEIN Kabel. Ein Kabel braucht zwei
// Buchsen, und die sind genau das, was noch niemand weiss.
//
// REIN: keine Uhr, kein Store — Zeit und Lage kommen von aussen.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../types/equipment'
import type { PendingChange } from '../types/lifecycle'
import { mitKatalogTyp } from './deviceTypeMatch'

export interface ErfassungsEintrag {
  name: string
  raum?: string
  /** Vermutete Verbindung, frei: „Beamer, HDMI hinten?" */
  verbindung?: string
  notiz?: string
}

/** Kategorie der erfassten Geraete — kanonisch englisch, de „Erfasst". */
export const ERFASST_KATEGORIE = 'Captured'

const sauber = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

/**
 * Die Notiz-Zeilen. Die Beschriftungen kommen von aussen, damit die Notiz in
 * der Sprache steht, in der erfasst wurde — sie ist Text des Nutzers, keine
 * Oberflaeche, und wechselt nicht mit der Sprache.
 */
export function erfassungsNotiz(
  e: ErfassungsEintrag,
  label: { raum: string; verbindung: string },
): string {
  const zeilen: string[] = []
  const raum = sauber(e.raum)
  const verbindung = sauber(e.verbindung)
  const notiz = sauber(e.notiz)
  if (raum) zeilen.push(`${label.raum}: ${raum}`)
  if (verbindung) zeilen.push(`${label.verbindung}: ${verbindung}`)
  if (notiz) zeilen.push(notiz)
  return zeilen.join('\n')
}

/** Ein unfertiges Geraet aus einem Eintrag — ohne Id (die vergibt der Store). */
export function erfasstesGeraet(
  e: ErfassungsEintrag,
  lage: { x: number; y: number },
  meta: { am: string; quelle: 'planer' | 'handy'; label: { raum: string; verbindung: string } },
): Omit<EquipmentItem, 'id'> | null {
  const name = sauber(e.name)
  if (!name) return null
  const notes = erfassungsNotiz(e, meta.label)
  return mitKatalogTyp({
    name,
    category: ERFASST_KATEGORIE,
    inputs: [],
    outputs: [],
    x: lage.x,
    y: lage.y,
    width: 240,
    height: 120,
    portsUnknown: true,
    erfasst: { am: meta.am, quelle: meta.quelle },
    ...(notes ? { notes } : {}),
  })
}

/** Der Eintrag aus einer Handy-Meldung `new-device`, oder null. */
export function eintragAusMeldung(pc: Pick<PendingChange, 'kind' | 'patch' | 'summary'>): ErfassungsEintrag | null {
  if (pc.kind !== 'new-device') return null
  const p = pc.patch ?? {}
  const name = sauber(p.name)
  if (!name) return null
  return {
    name,
    ...(sauber(p.raum) ? { raum: sauber(p.raum) } : {}),
    ...(sauber(p.verbindung) ? { verbindung: sauber(p.verbindung) } : {}),
    ...(sauber(p.notiz) ? { notiz: sauber(p.notiz) } : {}),
  }
}

/** Was in der Arbeitsliste steht: erfasst und noch nicht abgehakt. */
export const offeneErfassungen = <T extends { erfasst?: unknown }>(geraete: readonly T[]): T[] =>
  geraete.filter((g) => !!g.erfasst)
