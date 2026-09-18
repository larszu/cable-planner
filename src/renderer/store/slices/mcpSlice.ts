import { v4 as uuidv4 } from 'uuid'
import type { StateCreator } from 'zustand'
import { scheduleProjectAutosave } from '../projectAutosave'
import { isProjectLocked } from '../projectStoreHelpers'
import { fuehreSchreibwerkzeugAus, type Aktionen } from '../../lib/mcpSchreiben'
import { mitEintrag } from '../../types/mcpLog'
import type { ProjectState } from '../projectStore'

/**
 * #873 — der Schreibweg des MCP-Servers.
 *
 * ─── EIN AUFRUF, EIN UNDO-SCHRITT — GEKLAMMERT VOM AUFRUFER ────────────────
 *
 * Die Klammer (`projectHistory.transact`) setzt `App.tsx`, nicht dieser
 * Slice. Das ist die Hausform (`BulkConnectDialog`, `CanvasArea`,
 * `GraphmlImportDialog` machen es genauso) und hier zusaetzlich eine
 * Notwendigkeit: `projectHistory` liest beim Laden `useProjectStore`, und
 * ein Slice, den derselbe Store zusammensetzt, saehe dabei `undefined` —
 * ein Ringschluss, der 27 Test-Dateien reissen liess, bevor er hier
 * stand.
 *
 * Ohne die Klammer waeren Kabel und Nachweiszeile ZWEI Eintraege, und das
 * erste Strg-Z naehme nur den Nachweis zurueck. Genau das verlangt #873
 * („Jeder Tool-Aufruf = ein Undo-Schritt"), und es darf nicht an der
 * 200-ms-Koaleszenz haengen: die ist eine Uhr, und eine Uhr ist keine
 * Zusage.
 *
 * ─── DER NACHWEIS WIRD MITGESCHRIEBEN, NICHT NACHGETRAGEN ──────────────────
 *
 * Er entsteht hier, im selben Vorgang. Ein spaeterer Eintrag koennte fehlen,
 * wenn dazwischen etwas schiefgeht — und ein Nachweis mit Luecken ist
 * schlimmer als keiner, weil man ihm glaubt.
 */
export type McpSlice = Pick<ProjectState, 'mcpSchreiben'>

export const createMcpSlice: StateCreator<ProjectState, [], [], McpSlice> = (set, get) => ({
  mcpSchreiben: (werkzeug, args) => {
    const zustand = get()
    // Ein gesperrter Plan (finalized/viewer) bleibt gesperrt — auch fuer den
    // Assistenten. Dieselbe Verteidigung wie beim Handy-Weg.
    if (isProjectLocked(zustand)) {
      return {
        ok: false,
        text: 'This plan is finalized or opened as a viewer copy - it does not take changes.',
        daten: { ok: false },
      }
    }

    {
      const aktionen: Aktionen = {
        addCablesBulk: zustand.addCablesBulk,
        deleteCable: zustand.deleteCable,
        updateCable: zustand.updateCable,
        updateEquipment: zustand.updateEquipment,
      }
      const antwort = fuehreSchreibwerkzeugAus(zustand.project, aktionen, werkzeug, args)
      if (!antwort.ok) return antwort

      set((state) => {
        const updated = {
          ...state.project,
          mcpLog: mitEintrag(state.project.mcpLog, {
            id: uuidv4(),
            zeit: new Date().toISOString(),
            werkzeug,
            text: antwort.text,
          }),
        }
        scheduleProjectAutosave(updated)
        return { project: updated }
      })
      return antwort
    }
  },
})
