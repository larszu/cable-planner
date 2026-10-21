import { satz, satzKanonisch, type Satz } from './satz'
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
  /** Dieselben Gruende als Saetze — fuer den Bildschirm in der App-Sprache. */
  issueSaetze: Satz[]
  /** Konformer Vorschlag (kann == input sein wenn schon gültig). */
  suggestion: string
}

/** Prüft einen Dante-Gerätenamen gegen die Namensregeln. */
export const checkDanteName = (raw: string): DanteNameCheck => {
  const name = raw ?? ''
  const saetze: Satz[] = []
  if (name.length === 0) saetze.push(satz('dante.issue.empty', 'empty'))
  if (name.length > DANTE_MAX_LENGTH)
    saetze.push(satz('dante.issue.tooLong', '> {n} characters', { n: DANTE_MAX_LENGTH }))
  if (/[^a-zA-Z0-9-]/.test(name)) saetze.push(satz('dante.issue.chars', 'invalid characters (only a–z, 0–9, -)'))
  if (/^-/.test(name)) saetze.push(satz('dante.issue.leadingDash', 'leading hyphen'))
  if (/-$/.test(name)) saetze.push(satz('dante.issue.trailingDash', 'trailing hyphen'))
  const issues = saetze.map(satzKanonisch)
  return {
    valid: issues.length === 0,
    issues,
    issueSaetze: saetze,
    suggestion: suggestDanteName(name),
  }
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
