/**
 * OSC 1.0, nur so viel, wie Green-GO braucht: Adresse, int32 und float32.
 * Rein und ohne Electron, damit es ohne Geraet pruefbar ist
 * (tests/greengoOsc.test.ts).
 */

function pad4(buf: Buffer): Buffer {
  const rest = buf.length % 4
  return rest === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - rest)])
}
function oscString(s: string): Buffer {
  return pad4(Buffer.concat([Buffer.from(s, 'ascii'), Buffer.from([0])]))
}

export function encodeOsc(address: string, ints: number[]): Buffer {
  const types = oscString(`,${'i'.repeat(ints.length)}`)
  const args = Buffer.alloc(4 * ints.length)
  ints.forEach((v, i) => args.writeInt32BE(Math.round(v) | 0, i * 4))
  return Buffer.concat([oscString(address), types, args])
}

export function decodeOsc(buf: Buffer): { address: string; args: number[] } | null {
  const readString = (at: number): [string, number] | null => {
    const end = buf.indexOf(0, at)
    if (end < 0) return null
    const s = buf.subarray(at, end).toString('ascii')
    return [s, at + Math.ceil((end - at + 1) / 4) * 4]
  }
  const a = readString(0)
  if (!a || !a[0].startsWith('/')) return null
  const t = readString(a[1])
  if (!t || !t[0].startsWith(',')) return null
  const args: number[] = []
  let at = t[1]
  for (const c of t[0].slice(1)) {
    if (c === 'i') { if (at + 4 > buf.length) return null; args.push(buf.readInt32BE(at)); at += 4 }
    else if (c === 'f') { if (at + 4 > buf.length) return null; args.push(buf.readFloatBE(at)); at += 4 }
    else return { address: a[0], args }
  }
  return { address: a[0], args }
}

