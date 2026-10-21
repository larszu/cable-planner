import { create } from 'zustand'

/** Fluechtiger Oberflaechen-Zustand fuer Hallenplan und Symbole. Nicht
 *  persistiert: eine halb angeklickte Kalibrierung ueberlebt keinen Neustart. */
interface GrundrissUiState {
  /** Laufende Kalibrierung: welche Art, mit welchen Massen. */
  kalibrierung:
    | { art: 'zweiPunkt'; meter: number }
    | { art: 'rechteck'; breiteM: number; tiefeM: number }
    | null
  grundrissPanel: boolean
  /** Welcher Plan im Panel bearbeitet wird: Etagenname, `null` = allgemein (#984). */
  planEtage: string | null
  setPlanEtage: (etage: string | null) => void
  symbolPanel: boolean
  ausgewaehltesSymbol: string | null
  starteKalibrierung: (k: GrundrissUiState['kalibrierung']) => void
  setGrundrissPanel: (offen: boolean) => void
  setSymbolPanel: (offen: boolean) => void
  waehleSymbol: (id: string | null) => void
}

export const useGrundrissUi = create<GrundrissUiState>((set) => ({
  kalibrierung: null,
  grundrissPanel: false,
  planEtage: null,
  setPlanEtage: (planEtage) => set({ planEtage, kalibrierung: null }),
  symbolPanel: false,
  ausgewaehltesSymbol: null,
  starteKalibrierung: (kalibrierung) => set({ kalibrierung }),
  setGrundrissPanel: (grundrissPanel) => set({ grundrissPanel }),
  setSymbolPanel: (symbolPanel) => set({ symbolPanel }),
  waehleSymbol: (ausgewaehltesSymbol) => set({ ausgewaehltesSymbol }),
}))
