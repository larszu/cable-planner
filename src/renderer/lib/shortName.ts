import type { EquipmentItem } from '../types/equipment'

/**
 * Short-form device-name generator. Used for space-constrained
 * contexts like cable endpoint labels, where the full device name
 * ("ATEM Constellation 8K HD") is too long.
 *
 * Algorithm (researched against common AV/broadcast labelling
 * conventions — D-Tools System Integrator, Stardraw Design,
 * patchbay-labelling standards in Visio AV-ECAV):
 *
 * 1. Normalize input — trim, collapse whitespace, split CamelCase.
 * 2. Tokenize by non-alphanumeric separators.
 * 3. Drop common filler words ("the", "of", "model", "series" …).
 * 4. For each remaining token:
 *    - Contains digits ("8K", "40x40", "A170", "v2") -> keep entire token
 *    - Short uppercase acronym ("ATEM", "SDI", "USB", "NDI") -> keep
 *    - Single letter -> keep uppercase
 *    - Regular word -> first letter uppercase
 * 5. Join with no separator. If > 6 chars total, fall back to
 *    "first-token + first-numeric-token" (so "ATEM Constellation 8K"
 *    -> "ATEM8K" instead of the noisier "ATEMC8K").
 *
 * Examples:
 *   "ATEM Constellation 8K"             -> "ATEM8K"
 *   "Blackmagic Smart Videohub 40x40"   -> "B40x40"
 *   "Sony PVM-A170"                     -> "SA170"
 *   "Pixelhue P20"                      -> "PP20"
 *   "Brompton Tessera SX40"             -> "BTSX40"
 *   "Sennheiser EW G4"                  -> "SEWG4"
 *   "Camera 1"                          -> "C1"
 *   "Mac Mini"                          -> "MM"
 */
export const generateShortName = (fullName: string | undefined | null): string => {
  if (!fullName) return ''
  const trimmed = fullName.trim()
  if (!trimmed) return ''

  const FILLER_WORDS = new Set([
    // Articles, conjunctions, prepositions
    'the', 'and', 'or', 'of', 'a', 'an', 'with', 'for', 'to', 'in', 'on', 'by',
    // Generic descriptors
    'model', 'series', 'edition', 'version', 'mark',
  ])

  // Split CamelCase ("VideoHub" -> "Video Hub", "AVMixer" -> "AV Mixer")
  const decased = trimmed
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')

  // Tokenize on non-alphanumeric boundaries
  const rawTokens = decased
    .split(/[\s\-_/\\()[\]{}.,;:|"'`~!@#$%^&*+=?<>]+/)
    .filter((t) => t.length > 0)
  if (rawTokens.length === 0) return ''

  // Drop fillers — but keep at least one token so we don't produce empty output
  let tokens = rawTokens.filter((t) => !FILLER_WORDS.has(t.toLowerCase()))
  if (tokens.length === 0) tokens = [rawTokens[0]]

  // Transform each token
  const parts = tokens.map((tok) => {
    if (/\d/.test(tok)) return tok                              // model-number-ish
    if (/^[A-Z]{2,5}$/.test(tok)) return tok                    // short acronym
    if (tok.length === 1) return tok.toUpperCase()
    return tok[0].toUpperCase()
  })

  const naive = parts.join('')
  if (naive.length <= 6) return naive

  // Too long -> fall back to "first significant token + first numeric token".
  // Produces "ATEM8K" instead of "ATEMC8K", "B40x40" instead of "BSVH40x40".
  const first = parts[0]
  const firstNumeric = parts.slice(1).find((p) => /\d/.test(p))
  if (firstNumeric) {
    const combined = first + firstNumeric
    if (combined.length <= 8) return combined
    return combined.slice(0, 8)
  }
  return first.slice(0, 6)
}

/**
 * Effective short-form for a device: user-defined override
 * (eq.shortName) wins; falls back to auto-generated value from
 * eq.name. Empty/whitespace-only override is treated as undefined.
 */
export const effectiveShortName = (
  eq: Pick<EquipmentItem, 'name' | 'shortName'> | undefined | null,
): string => {
  if (!eq) return ''
  const override = eq.shortName?.trim()
  if (override) return override
  return generateShortName(eq.name)
}
