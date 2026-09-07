// ───────────────────────────────────────────────────────────────────────────
// „Keine Aussage" loescht nicht (ADR-005, Regel 2).
//
// Der Helfer stand bis zum Lager-Schnitt (ADR-006) in `inventoryMerge.ts`,
// weil er dort entstanden ist. Sein eigener Kommentar sagte aber bereits, was
// beim Schnitt zaehlt: „Die Regel ist nicht auf das Lager beschraenkt." Genau
// deshalb zieht er hierher — `saveEquipmentAsTemplate` benutzt ihn aus
// demselben Grund wie der Lager-Import, und ein Vertrag, der einen generischen
// Objekt-Mischer als Lager-Frage fuehrt, waere in dem Moment falsch, in dem
// das Lager ein eigenes Werkzeug wird: der Planer braeuchte den Helfer dann
// weiter und muesste ihn sich aus einem fremden Repo holen.
// ───────────────────────────────────────────────────────────────────────────

/**
 * `over` ueber `base` legen, aber nur dort, wo `over` einen Wert HAT.
 * `undefined` heisst „keine Aussage", nicht „loeschen".
 */
export const mergeDefined = <T extends object>(base: T, over: T): T => {
  const out = { ...base } as Record<string, unknown>
  for (const [key, value] of Object.entries(over)) {
    if (value !== undefined) out[key] = value
  }
  return out as T
}
