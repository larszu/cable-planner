/**
 * #346 — Kleine IPv4-Subnetz-Helfer für die Netzwerk-/IPAM-Übersicht.
 *
 * Reine Funktionen (kein State) — leicht testbar. Akzeptiert Masken sowohl
 * als Dotted-Decimal ("255.255.255.0") als auch als CIDR ("/24" oder "24").
 */

/** Parst "192.168.1.50" → [192,168,1,50] oder null bei ungültig. */
export const parseIpv4 = (ip: string | undefined): number[] | null => {
  if (!ip) return null
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return null
  const out: number[] = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const n = Number(p)
    if (n < 0 || n > 255) return null
    out.push(n)
  }
  return out
}

/** Maskenlänge (0..32) aus "255.255.255.0", "/24" oder "24". null bei ungültig. */
export const maskToBits = (mask: string | undefined): number | null => {
  if (!mask) return null
  const m = mask.trim().replace(/^\//, '')
  if (/^\d{1,2}$/.test(m)) {
    const bits = Number(m)
    return bits >= 0 && bits <= 32 ? bits : null
  }
  const octets = parseIpv4(m)
  if (!octets) return null
  // Bits zählen + auf zusammenhängende 1en prüfen.
  let bits = 0
  let seenZero = false
  for (const o of octets) {
    for (let i = 7; i >= 0; i--) {
      const bit = (o >> i) & 1
      if (bit === 1) {
        if (seenZero) return null // nicht-zusammenhängende Maske
        bits++
      } else {
        seenZero = true
      }
    }
  }
  return bits
}

/**
 * Praefixlaenge -> gepunktete Maske. Die Umkehrung von `maskToBits`.
 *
 * WOFUER. NetBox liefert die primaere Adresse als CIDR (`10.0.5.7/26`). Der
 * Import behielt davon nur die Adresse und warf die Praefixlaenge weg — und
 * Pruefung 17 rechnete danach auf einer ERFUNDENEN /24 weiter
 * (`e.subnetMask || '255.255.255.0'`). Auf einem /26- oder /22-Netz erzeugt
 * das beides: eine Gateway-Warnung, die nicht haette kommen duerfen, und eine
 * echte Fehlkonfiguration, die niemand meldet.
 *
 * Die Laenge stand die ganze Zeit in der Antwort. Sie wegzuwerfen und dann zu
 * raten ist derselbe Fehler wie ueberall sonst heute: ein unbestaetigter Wert,
 * der als Tatsache weiterrechnet.
 */
export const bitsToMask = (bits: number | null | undefined): string | null => {
  if (bits === null || bits === undefined || !Number.isInteger(bits)) return null
  if (bits < 0 || bits > 32) return null
  const octets = [0, 0, 0, 0]
  for (let i = 0; i < bits; i++) octets[Math.floor(i / 8)] |= 1 << (7 - (i % 8))
  return octets.join('.')
}

/** Netzwerk-Adresse (Dotted) aus IP + Maske, oder null. */
export const networkAddress = (ip: string | undefined, mask: string | undefined): string | null => {
  const ipv4 = parseIpv4(ip)
  const bits = maskToBits(mask)
  if (!ipv4 || bits == null) return null
  const out: number[] = []
  for (let i = 0; i < 4; i++) {
    const maskOctet = bits >= (i + 1) * 8 ? 255 : bits <= i * 8 ? 0 : (256 - (1 << (8 - (bits - i * 8)))) & 255
    out.push(ipv4[i] & maskOctet)
  }
  return out.join('.')
}

/** Subnetz als "network/bits" (z. B. "192.168.1.0/24"), oder null. */
export const subnetCidr = (ip: string | undefined, mask: string | undefined): string | null => {
  const net = networkAddress(ip, mask)
  const bits = maskToBits(mask)
  if (net == null || bits == null) return null
  return `${net}/${bits}`
}
