// Symbole auf dem Canvas: Zeichen fuer Elektro, EMA/BMA, SAA/ELA, IT und
// Automation, dazu eigene (importiert oder per KI erzeugt).
//
// Ein Symbol ist KEIN Geraet. Es hat keine Ports, keine Signale und steht in
// keiner Pruefung; es beschriftet den Plan. Wer ein verkabeltes Teil braucht,
// legt ein Geraet an und kann ihm dasselbe Symbol geben.

export type SymbolKategorie = 'elektro' | 'ema' | 'bma' | 'saa' | 'it' | 'automation' | 'av' | 'eigen'

export interface SymbolDef {
  id: string
  name: string
  kategorie: SymbolKategorie
  /** SVG-Quelltext (eingebaut, importiert oder erzeugt) ODER eine
   *  data:-URL eines Rasterbilds. Gezeichnet wird immer ueber <img>: dort
   *  laeuft kein Skript, auch wenn die Datei eines enthaelt. */
  svg?: string
  bild?: string
  herkunft: 'eingebaut' | 'import' | 'ki'
  /** Bei `ki`: die Beschreibung, aus der es entstand. */
  beschreibung?: string
}

export interface PlatziertesSymbol {
  id: string
  defId: string
  x: number
  y: number
  /** Kantenlaenge in Canvas-Pixeln. */
  groesse: number
  /** Grad, im Uhrzeigersinn. */
  drehung?: number
  beschriftung?: string
  gesperrt?: boolean
}
