// Der Zugang zum EINGESTELLTEN Raster.
//
// `raster.ts` bleibt rein — es rechnet, es liest nichts. Diese Datei liest:
// sie holt die im Menue eingestellte Rastergroesse aus dem uiStore und gibt
// das daraus abgeleitete Raster zurueck.
//
// Warum zwei Dateien: `uiStore` importiert `layoutConstants` (fuer die
// Vorgabe und die Panel-Grenzen), und `layoutConstants` importiert `raster`.
// Wuerde `raster` seinerseits den uiStore lesen, waere der Kreis geschlossen
// und das Modul beim Start halb leer. Die Trennung ist keine Stilfrage.

import { useUiStore } from '../store/uiStore'
import { rasterAus, type Raster } from './raster'

/** Das aktuelle Raster ausserhalb von React (Router, Exporte, Slices). */
export const aktuellesRaster = (): Raster => rasterAus(useUiStore.getState().gridSize)

/**
 * Das aktuelle Raster in einer Komponente — mit Abonnement.
 *
 * Wichtig gegenueber `aktuellesRaster()`: nur so zeichnet sich die Flaeche neu,
 * wenn der Nutzer die Rastergroesse im Menue aendert. Wer in einer Komponente
 * `aktuellesRaster()` aufruft, bekommt beim naechsten Rendern den neuen Wert —
 * aber niemand loest dieses Rendern aus.
 */
export const useRaster = (): Raster => rasterAus(useUiStore((s) => s.gridSize))
