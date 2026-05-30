// #346 — Dante-/AES67-Naming-Helfer.
//
// Audinate Dante-Gerätenamen folgen festen Regeln (DNS-SD/mDNS-konform):
//   • 1–31 Zeichen
//   • nur a–z, A–Z, 0–9 und Bindestrich „-"
//   • kein führender/abschließender Bindestrich
//   • Kanalnamen werden als `channel@device` referenziert
// Diese Regeln gelten analog für AES67-Session-Namen. Der Helfer prüft einen
// Namen und schlägt eine konforme Variante vor.

export const DANTE_MAX_LENGTH = 31

export interface DanteNameCheck {
  valid: boolean
  /** Verstoß-Gründe (leer wenn valid). */
  issues: string[]
  /** Konformer Vorschlag (kann == input sein wenn schon gültig). */
  suggestion: string
}

/** Prüft einen Dante-Gerätenamen gegen die Namensregeln. */
export const checkDanteName = (raw: string): DanteNameCheck => {
  const name = raw ?? ''
  const issues: string[] = []
  if (name.length === 0) issues.push('leer')
  if (name.length > DANTE_MAX_LENGTH) issues.push(`> ${DANTE_MAX_LENGTH} Zeichen`)
  if (/[^a-zA-Z0-9-]/.test(name)) issues.push('ungültige Zeichen (nur a–z, 0–9, -)')
  if (/^-/.test(name)) issues.push('führender Bindestrich')
  if (/-$/.test(name)) issues.push('abschließender Bindestrich')
  return { valid: issues.length === 0, issues, suggestion: suggestDanteName(name) }
}

/** Wandelt einen beliebigen Namen in einen Dante-konformen Vorschlag um. */
export const suggestDanteName = (raw: string): string => {
  let out = (raw ?? '')
    // Umlaute/Sonderzeichen vereinfachen.
    .replace(/ä/gi, 'ae')
    .replace(/ö/gi, 'oe')
    .replace(/ü/gi, 'ue')
    .replace(/ß/g, 'ss')
    // Whitespace + ungültige Zeichen → Bindestrich.
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    // Mehrfach-Bindestriche zusammenfassen.
    .replace(/-+/g, '-')
    // Führende/abschließende Bindestriche entfernen.
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  if (out.length > DANTE_MAX_LENGTH) out = out.slice(0, DANTE_MAX_LENGTH).replace(/-+$/, '')
  return out || 'device'
}
