import { create } from 'zustand'

/**
 * Nachtrag #946 — welche Stream-Vorschauen in DIESER Sitzung laufen duerfen.
 *
 * `showPreview` am Stream ist eine Planangabe und reist mit der Datei. Haengte
 * der Abruf allein daran, verbaende das blosse OEFFNEN einer fremden Datei
 * diesen Rechner mit den Adressen, die darin stehen. Deshalb braucht jeder
 * Abruf zusaetzlich eine Freigabe aus dieser Sitzung: den Klick auf die
 * Kachel oder das Einschalten in den Eigenschaften.
 *
 * NICHT PERSISTIERT, wie `patternStore`: nach dem Neustart ist nichts
 * freigegeben.
 */
interface StreamPreviewState {
  freigegeben: Record<string, true>
  freigeben: (streamId: string) => void
  sperren: (streamId: string) => void
}

export const useStreamPreviewStore = create<StreamPreviewState>((set) => ({
  freigegeben: {},
  freigeben: (id) => set((s) => ({ freigegeben: { ...s.freigegeben, [id]: true } })),
  sperren: (id) =>
    set((s) => {
      const freigegeben = { ...s.freigegeben }
      delete freigegeben[id]
      return { freigegeben }
    }),
}))
