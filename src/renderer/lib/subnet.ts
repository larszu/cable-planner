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

// ───────────────────────────────────────────────────────────────────────────
// BEDARF 20 — die Rechenbasis fuer schichtbare Adressbereiche.
//
// Bis hierher konnte diese Datei nur eines: aus EINER Adresse und EINER Maske
// das Subnetz ausrechnen, in dem sie liegt. Was fehlte, ist die Frage, die
// Bedarf 20 stellt: liegen ZWEI Bereiche uebereinander, und liegt eine Adresse
// in einem Bereich drin.
//
// WARUM ZAHLEN UND NICHT OKTETT-ARRAYS. Enthaltensein und Ueberlappung sind
// Intervall-Vergleiche; auf vier Oktetten geschrieben werden daraus vier
// verschachtelte Sonderfaelle, und der Fehler steckt dann im letzten. Als
// Intervall [first, last] ist Ueberlappung eine Zeile, die man ansehen kann.
//
// WARUM KEINE BIT-OPERATOREN. `<<` und `&` rechnen in JavaScript
// VORZEICHENBEHAFTET auf 32 Bit: `192 << 24` ist negativ, und damit waere
// jede Adresse ab 128.x.x.x kleiner als jede darunter. Multiplikation und
// Modulo haben diese Falle nicht — 2^32 passt vollstaendig in eine
// JS-Gleitkommazahl (sicher bis 2^53).
// ───────────────────────────────────────────────────────────────────────────

/** Ein Adressbereich als halboffenes Intervall — beide Grenzen eingeschlossen. */
export interface CidrRange {
  /** Praefixlaenge (0..32). */
  bits: number
  /** Netz-Adresse als Zahl. */
  first: number
  /** Broadcast-Adresse als Zahl. */
  last: number
}

/** "192.168.1.50" -> 3232235826, oder null. */
export const ipToNumber = (ip: string | undefined): number | null => {
  const o = parseIpv4(ip)
  if (!o) return null
  return ((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3]
}

/** Die Umkehrung. null, wenn die Zahl kein IPv4-Wert ist. */
export const numberToIp = (n: number): string | null => {
  if (!Number.isInteger(n) || n < 0 || n > 4294967295) return null
  return [
    Math.floor(n / 16777216) % 256,
    Math.floor(n / 65536) % 256,
    Math.floor(n / 256) % 256,
    n % 256,
  ].join('.')
}

/**
 * "10.0.5.0/26" -> Intervall. Akzeptiert auch "10.0.5.0/255.255.255.192".
 *
 * NICHT-KANONISCHE EINGABEN WERDEN ABGERUNDET, nicht abgelehnt: "10.0.5.7/24"
 * ergibt das Intervall von 10.0.5.0. Das ist fuer die Rechnung richtig — die
 * Adresse liegt in genau diesem Netz. Ob eine solche Schreibweise als
 * BEREICHS-DEFINITION durchgehen darf, entscheidet nicht diese Funktion,
 * sondern die Normalisierung beim Laden (`normaliseAddressRange`), die den
 * Bereich auf seine Netz-Adresse zurueckschreibt — wie NetBox es beim
 * Speichern tut ("All bits in the address not covered by the mask must be
 * zero", `docs/models/ipam/prefix.md`).
 */
export const parseCidr = (cidr: string | undefined): CidrRange | null => {
  if (!cidr) return null
  const parts = cidr.trim().split('/')
  if (parts.length !== 2) return null
  const base = ipToNumber(parts[0])
  const bits = maskToBits(parts[1])
  if (base == null || bits == null) return null
  const size = Math.pow(2, 32 - bits)
  const first = base - (base % size)
  return { bits, first, last: first + size - 1 }
}

/** Das Intervall wieder als Zeichenkette — immer kanonisch. */
export const rangeToCidr = (r: CidrRange): string => `${numberToIp(r.first)}/${r.bits}`

/** Wie viele Adressen der Bereich umfasst (Netz und Broadcast eingerechnet). */
export const rangeSize = (r: CidrRange): number => r.last - r.first + 1

/** Liegt `inner` vollstaendig in `outer`? Ein Bereich enthaelt sich selbst. */
export const cidrContains = (outer: CidrRange, inner: CidrRange): boolean =>
  outer.first <= inner.first && inner.last <= outer.last

/** Haben die beiden Bereiche auch nur eine Adresse gemeinsam? */
export const cidrsOverlap = (a: CidrRange, b: CidrRange): boolean =>
  a.first <= b.last && b.first <= a.last

/** Liegt die Adresse im Bereich? */
export const addressInRange = (ip: string | undefined, r: CidrRange): boolean => {
  const n = ipToNumber(ip)
  return n != null && n >= r.first && n <= r.last
}

/**
 * Der Host-Anteil einer Adresse in Bezug auf eine Praefixlaenge.
 *
 * Bezugsgroesse ist die ZIEL-Laenge und nicht die alte Maske: wer 10.2.0.57
 * in ein /24 umzieht, behaelt die 57. Deshalb braucht ein Umzugs-Vorschlag
 * die alte Maske gar nicht zu kennen — und kann auch dann rechnen, wenn sie
 * fehlt (`missing-mask` im Adressplan).
 */
export const hostPart = (ip: string | undefined, bits: number): number | null => {
  const n = ipToNumber(ip)
  if (n == null || !Number.isInteger(bits) || bits < 0 || bits > 32) return null
  return n % Math.pow(2, 32 - bits)
}

/** Adresse im Bereich `r` mit dem Host-Anteil `host`, oder null wenn er nicht passt. */
export const withHostPart = (r: CidrRange, host: number): string | null => {
  if (!Number.isInteger(host) || host < 0 || host > r.last - r.first) return null
  return numberToIp(r.first + host)
}
