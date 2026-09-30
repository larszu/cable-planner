import { create } from 'zustand'

/**
 * larszu/lz-scopes#15 — welche Scopes gerade offen sind. NICHT PERSISTIERT,
 * wie `streamPreviewStore`: ein offenes Scope ist ein Vorgang, keine
 * Planangabe, und nach dem Neustart laeuft kein Strom.
 *
 * `freigegeben` gilt fuer die Plakette am Canvas (`showScope`). Die Plakette
 * ist eine Planangabe und reist mit der Datei; erst ein Klick in dieser Sitzung
 * startet ihren Strom — dieselbe Regel wie beim Standbild, aber eine eigene
 * Freigabe: wer das Standbild einschaltet, hat nicht auch den Dauerstrom
 * bestellt.
 */
interface ScopeState {
  /** Das grosse Panel: ein Strom = Waveform + Vectorscope, mehrere = Parade je Quelle. */
  dialog: { streamIds: string[] } | null
  oeffne: (streamIds: string[]) => void
  schliesse: () => void
  freigegeben: Record<string, true>
  freigeben: (streamId: string) => void
  sperren: (streamId: string) => void
}

export const useScopeStore = create<ScopeState>((set) => ({
  dialog: null,
  oeffne: (streamIds) => set({ dialog: streamIds.length > 0 ? { streamIds: [...new Set(streamIds)] } : null }),
  schliesse: () => set({ dialog: null }),
  freigegeben: {},
  freigeben: (id) => set((s) => ({ freigegeben: { ...s.freigegeben, [id]: true } })),
  sperren: (id) =>
    set((s) => {
      const freigegeben = { ...s.freigegeben }
      delete freigegeben[id]
      return { freigegeben }
    }),
}))
