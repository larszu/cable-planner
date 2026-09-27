// ───────────────────────────────────────────────────────────────────────────
// #917 — die eigenen Stammdaten: Steckertypen, Signalstandards, Kabel-Ebenen.
//
// Eingebaute Eintraege stehen im Code (`ALL_CONNECTOR_TYPES`,
// `ALL_SIGNAL_STANDARDS`, `STANDARD_LAYERS`) und sind fuer jeden gleich.
// EIGENE Eintraege gehoeren dem Nutzer und lagen bisher verstreut: ein
// Steckertyp entstand im Port-Editor, ein Signalstandard im Kabeltyp-Dialog,
// eine Ebene an den Canvas-Chips — und nirgends sah man sie beieinander.
// Diese Datei ist die gemeinsame Rechnung; die Ansicht steht im Einstellungen-
// Tab „Stammdaten", der Transport in der geteilten Bibliothek.
//
// REIN: kein Store.
// ───────────────────────────────────────────────────────────────────────────

export interface EigeneStammdaten {
  connectorTypes: string[]
  signalStandards: string[]
  cableLayers: string[]
}

const schluessel = (s: string) => s.trim().toLowerCase()

/**
 * Was aus der geteilten Datei lokal FEHLT — je Liste, ohne Ruecksicht auf
 * Gross/Klein und ohne die eingebauten Eintraege (die hat jeder schon).
 * Nicht-destruktiv wie der Rest des Bibliotheks-Abgleichs: geteilt wird
 * ergaenzt, nie entfernt.
 */
export function fehlendeStammdaten(
  lokal: EigeneStammdaten,
  geteilt: Partial<Record<keyof EigeneStammdaten, unknown>>,
  eingebaut: EigeneStammdaten,
): EigeneStammdaten {
  const fehlt = (liste: string[], roh: unknown, eigen: string[]): string[] => {
    if (!Array.isArray(roh)) return []
    const vorhanden = new Set([...liste, ...eigen].map(schluessel))
    const aus: string[] = []
    for (const v of roh) {
      if (typeof v !== 'string' || !v.trim()) continue
      const k = schluessel(v)
      if (vorhanden.has(k)) continue
      vorhanden.add(k)
      aus.push(v.trim())
    }
    return aus
  }
  return {
    connectorTypes: fehlt(lokal.connectorTypes, geteilt.connectorTypes, eingebaut.connectorTypes),
    signalStandards: fehlt(lokal.signalStandards, geteilt.signalStandards, eingebaut.signalStandards),
    cableLayers: fehlt(lokal.cableLayers, geteilt.cableLayers, eingebaut.cableLayers),
  }
}

/** Die Vereinigung, die in die geteilte Datei zurueckgeht (lokal zuerst). */
export function vereinigteStammdaten(lokal: EigeneStammdaten, geteilt: Partial<Record<keyof EigeneStammdaten, unknown>>): EigeneStammdaten {
  const vereinigt = (a: string[], roh: unknown): string[] => {
    const aus: string[] = []
    const gesehen = new Set<string>()
    for (const v of [...a, ...(Array.isArray(roh) ? roh : [])]) {
      if (typeof v !== 'string' || !v.trim()) continue
      const k = schluessel(v)
      if (gesehen.has(k)) continue
      gesehen.add(k)
      aus.push(v.trim())
    }
    return aus
  }
  return {
    connectorTypes: vereinigt(lokal.connectorTypes, geteilt.connectorTypes),
    signalStandards: vereinigt(lokal.signalStandards, geteilt.signalStandards),
    cableLayers: vereinigt(lokal.cableLayers, geteilt.cableLayers),
  }
}

/** Schon vorhanden (eingebaut oder eigen)? — fuer die Eingabe im Tab. */
export const schonVorhanden = (name: string, ...listen: ReadonlyArray<readonly string[]>): boolean =>
  listen.some((l) => l.some((x) => schluessel(x) === schluessel(name)))

// ─── Umbenennen ────────────────────────────────────────────────────────────
//
// Ein eigener Eintrag ist ein NAME, der an Ports, Kabeln und Kabeltypen
// steht — es gibt keine Kennung dahinter. Umbenennen nur in der Liste liesse
// jede Verwendung auf dem alten Namen stehen: der Port zeigte einen Stecker,
// den es in keiner Auswahl mehr gibt. Also werden die Verwendungen im offenen
// Projekt, in der Bibliothek und in den eigenen Kabeltypen mitgezogen.
// Gespeicherte, gerade nicht geoeffnete Projekte behalten den alten Namen;
// er bleibt dort ein freier Text, wie jeder unbekannte Eintrag.

export type StammdatenArt = 'stecker' | 'standard' | 'ebene'

interface MitPorts {
  inputs: Array<{ type: string; connectorType: string; standard?: string }>
  outputs: Array<{ type: string; connectorType: string; standard?: string }>
}

const portsUmbenannt = <T extends MitPorts>(item: T, art: StammdatenArt, alt: string, neu: string): T | null => {
  if (art === 'ebene') return null
  let geaendert = false
  const je = <P extends MitPorts['inputs'][number]>(p: P): P => {
    if (art === 'stecker' && (p.connectorType === alt || p.type === alt)) {
      geaendert = true
      return { ...p, connectorType: p.connectorType === alt ? neu : p.connectorType, type: p.type === alt ? neu : p.type }
    }
    if (art === 'standard' && p.standard === alt) {
      geaendert = true
      return { ...p, standard: neu }
    }
    return p
  }
  const inputs = item.inputs.map(je)
  const outputs = item.outputs.map(je)
  return geaendert ? { ...item, inputs, outputs } : null
}

/** Geraete oder Vorlagen mit umbenannten Ports; `n` zaehlt die geaenderten. */
export function geraeteUmbenannt<T extends MitPorts>(liste: readonly T[], art: StammdatenArt, alt: string, neu: string): { liste: T[]; n: number } {
  let n = 0
  const aus = liste.map((e) => {
    const r = portsUmbenannt(e, art, alt, neu)
    if (!r) return e
    n++
    return r
  })
  return { liste: aus, n }
}

interface KabelFelder {
  type: string
  standard?: string
  layer?: string
}

/** Kabel mit umbenanntem Stecker (`type`), Standard oder Ebene. */
export function kabelUmbenannt<T extends KabelFelder>(liste: readonly T[], art: StammdatenArt, alt: string, neu: string): { liste: T[]; n: number } {
  let n = 0
  const aus = liste.map((c) => {
    if (art === 'stecker' && c.type === alt) { n++; return { ...c, type: neu } }
    if (art === 'standard' && c.standard === alt) { n++; return { ...c, standard: neu } }
    if (art === 'ebene' && c.layer === alt) { n++; return { ...c, layer: neu } }
    return c
  })
  return { liste: aus, n }
}

interface KabeltypFelder {
  connectorType: string
  compatibleConnectors?: string[]
  standards: string[]
}

/** Eigene Kabeltypen mit umbenanntem Stecker oder Standard. */
export function kabeltypenUmbenannt<T extends KabeltypFelder>(liste: readonly T[], art: StammdatenArt, alt: string, neu: string): T[] {
  if (art === 'ebene') return [...liste]
  return liste.map((s) => {
    if (art === 'stecker') {
      const passt = s.connectorType === alt || s.compatibleConnectors?.includes(alt)
      if (!passt) return s
      return {
        ...s,
        connectorType: s.connectorType === alt ? neu : s.connectorType,
        ...(s.compatibleConnectors ? { compatibleConnectors: s.compatibleConnectors.map((c) => (c === alt ? neu : c)) } : {}),
      }
    }
    if (!s.standards.includes(alt)) return s
    return { ...s, standards: s.standards.map((x) => (x === alt ? neu : x)) }
  })
}
