import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'
import { EMPTY_CREW_PLAN, type CrewPlan } from '../../types/labour'

/**
 * Bedarfe 40/41/42/83 — die Crew-Seite des Projekts.
 *
 * EINE ENTSCHEIDUNG, DIE DIESER SLICE ANDERS TRIFFT ALS DIE ANDEREN: beim
 * Loeschen einer Person raeumt er MIT. Ein Satz ohne Person und eine Schicht
 * ohne Satz fallen aus jeder Summe heraus — sie stehen dann als Befund da, und
 * die Stunde ist trotzdem nicht abgerechnet. Genau deshalb sagt
 * `removeCrewPerson`, WIE VIEL mit weggeht, statt es still zu tun: die
 * Oberflaeche fragt damit nach, bevor eine Woche Stundenzettel verschwindet.
 *
 * Beim Laden gilt die andere Richtung: was in der Datei steht, BLEIBT, auch
 * wenn sein Satz fehlt (siehe `normaliseCrewPlan`). Der Unterschied ist
 * Absicht — ein Klick des Nutzers ist eine Entscheidung, eine kaputte Datei
 * ist keine.
 */
export type CrewSlice = Pick<
  ProjectState,
  | 'setCrewPlan'
  | 'addCrewPerson'
  | 'removeCrewPerson'
  | 'addCrewRate'
  | 'updateCrewRate'
  | 'removeCrewRate'
  | 'addRateBand'
  | 'removeRateBand'
  | 'addTimeEntry'
  | 'updateTimeEntry'
  | 'removeTimeEntry'
  | 'addCrewExpense'
  | 'updateCrewExpense'
  | 'removeCrewExpense'
  | 'addApproval'
  | 'removeApproval'
>

/** Der Plan, mit dem gearbeitet wird — ein fehlender ist ein leerer. */
const planOf = (state: ProjectState): CrewPlan => state.project.crewPlan ?? EMPTY_CREW_PLAN

export const createCrewSlice: StateCreator<ProjectState, [], [], CrewSlice> = (set) => {
  /** Jede Aenderung geht durch diese eine Stelle — inklusive Autosave. */
  const schreibe = (fn: (plan: CrewPlan) => CrewPlan) =>
    set((state) => {
      const updated = { ...state.project, crewPlan: fn(planOf(state)) }
      scheduleProjectAutosave(updated)
      return { project: updated }
    })

  return {
    setCrewPlan: (plan) => schreibe(() => plan),

    addCrewPerson: (person) => {
      const name = person.name?.trim()
      if (!name) return undefined
      const id = person.id?.trim() || uuidv4()
      schreibe((p) =>
        p.people.some((x) => x.id === id)
          ? p
          : { ...p, people: [...p.people, { ...person, id, name }] },
      )
      return id
    },

    removeCrewPerson: (id) => {
      let entfernt = { rates: 0, entries: 0, expenses: 0 }
      schreibe((p) => {
        const rateIds = new Set(p.rates.filter((r) => r.personId === id).map((r) => r.id))
        entfernt = {
          rates: rateIds.size,
          entries: p.entries.filter((e) => e.personId === id).length,
          expenses: p.expenses.filter((e) => e.personId === id).length,
        }
        return {
          ...p,
          people: p.people.filter((x) => x.id !== id),
          rates: p.rates.filter((r) => r.personId !== id),
          entries: p.entries.filter((e) => e.personId !== id),
          // Auslagen bleiben, sie verlieren nur ihre Person: sie sind ECHTES
          // Geld, das jemand ausgelegt hat, und ein geloeschter Name macht die
          // Quittung nicht ungueltig.
          expenses: p.expenses.map((e) => (e.personId === id ? { ...e, personId: undefined } : e)),
        }
      })
      return entfernt
    },

    addCrewRate: (rate) => {
      const activity = rate.activity?.trim()
      if (!activity || !rate.personId) return undefined
      const id = rate.id?.trim() || uuidv4()
      schreibe((p) =>
        p.rates.some((x) => x.id === id)
          ? p
          : {
              ...p,
              rates: [
                ...p.rates,
                { ...rate, id, activity, bandIds: rate.bandIds ?? [], hourlyAmount: rate.hourlyAmount ?? 0 },
              ],
            },
      )
      return id
    },

    updateCrewRate: (id, patch) =>
      schreibe((p) => ({
        ...p,
        rates: p.rates.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r)),
      })),

    removeCrewRate: (id) => {
      let entfernteSchichten = 0
      schreibe((p) => {
        entfernteSchichten = p.entries.filter((e) => e.rateId === id).length
        return {
          ...p,
          rates: p.rates.filter((r) => r.id !== id),
          // Eine Schicht ohne Satz kann nicht bewertet werden. Sie stehen zu
          // lassen hiesse, eine Zeile zu fuehren, die in keiner Summe
          // auftaucht — der Nutzer sieht die Zahl im Ruecklauf und entscheidet.
          entries: p.entries.filter((e) => e.rateId !== id),
        }
      })
      return entfernteSchichten
    },

    addRateBand: (band) => {
      const label = band.label?.trim()
      if (!label) return undefined
      const id = band.id?.trim() || uuidv4()
      schreibe((p) =>
        p.bands.some((x) => x.id === id)
          ? p
          : {
              ...p,
              bands: [
                ...p.bands,
                {
                  ...band,
                  id,
                  label,
                  days: band.days ?? [],
                  fromMinute: band.fromMinute ?? 0,
                  toMinute: band.toMinute ?? 1440,
                  surchargePercent: band.surchargePercent ?? 0,
                },
              ],
            },
      )
      return id
    },

    removeRateBand: (id) =>
      schreibe((p) => ({
        ...p,
        bands: p.bands.filter((b) => b.id !== id),
        // Der Zeiger stirbt mit dem Band — ein Satz, der ein geloeschtes Band
        // nennt, saehe aus, als haette er einen Zuschlag.
        rates: p.rates.map((r) =>
          r.bandIds.includes(id) ? { ...r, bandIds: r.bandIds.filter((b) => b !== id) } : r,
        ),
      })),

    addTimeEntry: (entry) => {
      if (!entry.personId || !entry.rateId || !entry.date) return undefined
      const id = entry.id?.trim() || uuidv4()
      schreibe((p) =>
        p.entries.some((x) => x.id === id)
          ? p
          : {
              ...p,
              entries: [
                ...p.entries,
                {
                  ...entry,
                  id,
                  startMinute: entry.startMinute ?? 0,
                  endMinute: entry.endMinute ?? 0,
                },
              ],
            },
      )
      return id
    },

    updateTimeEntry: (id, patch) =>
      schreibe((p) => ({
        ...p,
        entries: p.entries.map((e) => (e.id === id ? { ...e, ...patch, id: e.id } : e)),
      })),

    removeTimeEntry: (id) =>
      schreibe((p) => ({ ...p, entries: p.entries.filter((e) => e.id !== id) })),

    addCrewExpense: (expense) => {
      if (!expense.date || expense.amount === undefined) return undefined
      const id = expense.id?.trim() || uuidv4()
      schreibe((p) =>
        p.expenses.some((x) => x.id === id)
          ? p
          : {
              ...p,
              expenses: [
                ...p.expenses,
                { ...expense, id, kind: expense.kind ?? 'other', billable: expense.billable === true },
              ],
            },
      )
      return id
    },

    /**
     * Eine Auslagenzeile aendern (Bedarf 97).
     *
     * `id` ist ausdruecklich nicht ueberschreibbar: an ihr haengt der Beleg,
     * und eine getauschte Id machte aus einer korrigierten Zeile eine
     * fremde — mit einer Quittung, die dann etwas anderes belegt.
     */
    updateCrewExpense: (id, patch) =>
      schreibe((p) => ({
        ...p,
        expenses: p.expenses.map((e) => (e.id === id ? { ...e, ...patch, id: e.id } : e)),
      })),

    removeCrewExpense: (id) =>
      schreibe((p) => ({
        ...p,
        expenses: p.expenses.filter((e) => e.id !== id),
        // Eine Zusage, die nur diese Auslage deckte, verliert ihren Bezug —
        // aber nicht ihren Text. Sie wird zur freien Zusage, statt zu
        // verschwinden: sie ist der Beleg fuer ein Gespraech, das
        // stattgefunden hat.
        approvals: p.approvals.map((a) =>
          a.covers.kind === 'expense' && a.covers.expenseId === id
            ? { ...a, covers: { kind: 'free' as const } }
            : a,
        ),
      })),

    addApproval: (approval) => {
      const by = approval.by?.trim()
      const text = approval.text
      if (!by || !text) return undefined
      const id = approval.id?.trim() || uuidv4()
      schreibe((p) =>
        p.approvals.some((x) => x.id === id)
          ? p
          : {
              ...p,
              approvals: [
                ...p.approvals,
                {
                  ...approval,
                  id,
                  by,
                  text,
                  channel: approval.channel ?? 'unstated',
                  covers: approval.covers ?? { kind: 'free' },
                },
              ],
            },
      )
      return id
    },

    removeApproval: (id) =>
      schreibe((p) => ({ ...p, approvals: p.approvals.filter((a) => a.id !== id) })),
  }
}
