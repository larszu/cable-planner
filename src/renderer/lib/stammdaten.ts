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
