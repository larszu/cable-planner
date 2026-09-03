import type { Port } from '../types/equipment'

/**
 * #286 — Display-Label fuer einen Port auf dem Canvas und in Exports.
 *
 * Trennt das *inhaltliche* Signal-Label (PGM, PVW, MV1, Cam1) vom
 * *Hauptnamen* des Ports. Wenn der User in den Properties einen
 * `contentLabel` gesetzt hat, gewinnt der gegen den oft technischer
 * formulierten `port.name` ("1 SDI 3G PGM (1080p50/60)" → "PGM").
 *
 * Reihenfolge:
 *   1. `port.contentLabel` wenn gesetzt
 *   2. `port.name` als Fallback
 *   3. Leerer String wenn beides leer (sollte nicht passieren; UI
 *      faellt dann auf port.id zurueck, der Caller entscheidet).
 *
 * Duenner Aufsatz auf `resolvePortLabel` unten — wer die Herkunft braucht,
 * nimmt die. Dass der Caller den letzten Ausweg entscheidet (Punkt 3), bleibt
 * ausdruecklich so: `installerLists` haengt `|| portId` an, weil ein leeres
 * Feld in einer Installateurs-Liste weniger sagt als eine Id.
 */
/**
 * Woher der Text eines Port-Labels stammt.
 *
 * ADR-001 hat als tragende Zusage aus dem `minimal`-Entwurf uebernommen:
 * „Keiner liefert zurueck, *woher* der Text stammt. Eine Engstelle mit
 * Provenienz im Rueckgabewert loest das." Genau das ist dieser Typ.
 *
 * `labelDerivation.ts` setzt seine `LabelProvenance` aus diesem hier plus den
 * Geraete-Quellen zusammen — eine Vokabel, nicht zwei. Der Typ wohnt HIER und
 * nicht dort, weil `labelDerivation` `portLabel` importiert; die andere
 * Richtung waere ein Zyklus.
 */
export type PortLabelProvenance = 'port-content-label' | 'port-name' | 'none'

export interface ResolvedPortLabel {
  /** Der Text, den ein Exporter fuer diesen Port abgibt. Leer heisst: nichts. */
  text: string
  provenance: PortLabelProvenance
}

/**
 * Die Engstelle. Ein Aufrufer, der wissen muss, WOHER der Text kommt, nimmt
 * diese Funktion; wer nur den Text braucht, nimmt `portDisplayLabel` darunter.
 *
 * Sie stand bis ADR-001 Inkrement 2 als private `portText` in
 * `labelDerivation.ts` — also genau dort, wo KEIN Exporter sie erreichen
 * konnte. Die Ableitungsschicht brauchte die Provenienz fuer ihre Kandidaten
 * und hat sie sich deshalb selbst gebaut; die Exporter, fuer die ADR-001 sie
 * vorgesehen hatte, blieben ohne. Hochgezogen, nicht neu geschrieben.
 *
 * `.trim()` auch auf dem Fallback: die private Fassung tat das, die oeffentliche
 * nicht. Ein Port-Name mit angehaengtem Leerzeichen ergab damit zwei
 * verschiedene Texte, je nachdem wer fragte.
 */
export const resolvePortLabel = (
  port: Pick<Port, 'name' | 'contentLabel'>,
): ResolvedPortLabel => {
  const content = port.contentLabel?.trim()
  if (content) return { text: content, provenance: 'port-content-label' }
  const name = port.name?.trim() ?? ''
  if (name) return { text: name, provenance: 'port-name' }
  return { text: '', provenance: 'none' }
}

export const portDisplayLabel = (port: Pick<Port, 'name' | 'contentLabel'>): string =>
  resolvePortLabel(port).text

/**
 * #410 — Kompaktes Symbol fuer das Steckverbinder-Geschlecht. Leerer
 * String wenn nicht gesetzt, damit Caller bedingungslos anhaengen koennen.
 */
export const genderSymbol = (gender?: Port['gender']): string => {
  if (gender === 'male') return '♂'
  if (gender === 'female') return '♀'
  return ''
}

/**
 * Zwei-Zeilen-Variante fuer Stellen die sowohl die Funktion als auch den
 * traditionellen Port-Namen zeigen wollen (Patchliste, Device-PDF).
 * Liefert beide Strings; falls `contentLabel` leer ist, ist `subline`
 * undefined und der Caller rendert nur `main`.
 */
export const portLabelPair = (
  port: Pick<Port, 'name' | 'contentLabel'>,
): { main: string; subline?: string } => {
  const content = port.contentLabel?.trim()
  const name = port.name?.trim() ?? ''
  if (content && name && content !== name) {
    return { main: content, subline: name }
  }
  return { main: content || name }
}

/**
 * #302 — Stripping fuer ATEM-Labels. ATEM Long-Name ist 20 Chars, Short
 * 4. Canvas-Port-Namen sind oft viel laenger und voller fuer ATEM
 * redundanter Infos: Stecker-Typ ("SDI"), Signal-Standard ("3G", "12G"),
 * Format ("(1080p50/60)"), fuehrende Port-Nummern ("1 ", "2 ").
 *
 * Macht aus "1 SDI 3G PGM (1080p50/60)" -> "PGM" was deutlich nuetzlicher
 * in der ATEM-UI angezeigt wird. War vorher private in AtemDialog.tsx;
 * jetzt zentralisiert weil die Pipeline-Konsumenten (AtemDialog,
 * VideohubExport) die gleiche Aufbereitung brauchen koennen.
 */
export const shortenForAtem = (raw: string): string => {
  let out = raw.trim()
  // Fuehrende Port-Nummer mit Leerzeichen ("1 ", "12 ").
  out = out.replace(/^\d+\s+/, '')
  // Format-Suffix in Klammern: (1080p50/60), (4Kp50) etc.
  out = out.replace(/\s*\(\d{2,4}[pi]\d{2,3}(?:\/\d{2,3})?\)/gi, '')
  // Stecker-Token (SDI/HDMI/BNC/XLR) wenn die Restzeichenkette laenger
  // als ein Wort ist — sonst wuerde "SDI 1" zu "1" verstuemmelt.
  const tokens = out.split(/\s+/)
  if (tokens.length > 1) {
    const stripKeywords = /^(SDI|HDMI|BNC|XLR|RJ45|Fiber|SFP\+?|DIN|USB|USB-C|3G|6G|12G)$/i
    const stripped = [...tokens]
    while (stripped.length > 1 && stripKeywords.test(stripped[0])) {
      stripped.shift()
    }
    // Das Ergebnis nur uebernehmen, wenn danach noch etwas BENENNENDES
    // uebrig ist. Vorher lief die Schleife bedingungslos und machte aus
    // "SDI 1" die nackte "1" — genau der Fall, den der Kommentar oben
    // ausschliesst. Bei "SDI 3G PGM" bleibt "PGM" und wird uebernommen.
    if (stripped.some((t) => !/^\d+$/.test(t))) out = stripped.join(' ').trim()
  }
  return out || raw.trim()
}
