import { describe, expect, it } from 'vitest'
import { jpegTakenAt } from '../src/main/util/exifDate'

/**
 * Ein JPEG mit genau einem EXIF-Feld bauen.
 *
 * Von Hand und nicht aus einer Beispieldatei: so steht im Test, WELCHES Byte
 * die Aussage traegt. Eine mitgelieferte Fotodatei waere eine Blackbox — faellt
 * der Test, wuesste niemand, ob der Parser oder das Bild schuld ist.
 */
const jpegMitExif = (tag: number, wert: string, ordnung: 'II' | 'MM' = 'II'): Buffer => {
  const little = ordnung === 'II'
  const daten = Buffer.from(`${wert}\0`, 'latin1')
  const imIfd0 = tag === 0x0132
  // IFD0 (8..26) — entweder direkt das Datumsfeld oder der Zeiger aufs Exif-IFD.
  const kopf = Buffer.alloc(8)
  kopf.write(ordnung, 0, 'latin1')
  const u16 = (b: Buffer, o: number, v: number) =>
    little ? b.writeUInt16LE(v, o) : b.writeUInt16BE(v, o)
  const u32 = (b: Buffer, o: number, v: number) =>
    little ? b.writeUInt32LE(v, o) : b.writeUInt32BE(v, o)
  u16(kopf, 2, 42)
  u32(kopf, 4, 8)

  const eintrag = (t: number, typ: number, anzahl: number, wertOderOffset: number) => {
    const e = Buffer.alloc(12)
    u16(e, 0, t)
    u16(e, 2, typ)
    u32(e, 4, anzahl)
    u32(e, 8, wertOderOffset)
    return e
  }

  const ifd = (eintraege: Buffer[]) => {
    const b = Buffer.alloc(2 + eintraege.length * 12 + 4)
    u16(b, 0, eintraege.length)
    eintraege.forEach((e, i) => e.copy(b, 2 + i * 12))
    return b
  }

  if (imIfd0) {
    const datenOffset = 8 + 18
    const ifd0 = ifd([eintrag(0x0132, 2, daten.length, datenOffset)])
    return Buffer.concat([Buffer.from([0xff, 0xd8]), app1(Buffer.concat([kopf, ifd0, daten]))])
  }
  const exifIfdOffset = 8 + 18
  const ifd0 = ifd([eintrag(0x8769, 4, 1, exifIfdOffset)])
  const datenOffset = exifIfdOffset + 18
  const exifIfd = ifd([eintrag(tag, 2, daten.length, datenOffset)])
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1(Buffer.concat([kopf, ifd0, exifIfd, daten]))])
}

const app1 = (tiff: Buffer): Buffer => {
  const kopf = Buffer.alloc(4)
  kopf.writeUInt16BE(0xffe1, 0)
  kopf.writeUInt16BE(2 + 6 + tiff.length, 2)
  return Buffer.concat([kopf, Buffer.from('Exif\0\0', 'latin1'), tiff])
}

describe('der Aufnahmezeitpunkt kommt aus der Datei, nicht aus der Uhr', () => {
  it('liest DateTimeOriginal in Intel-Byte-Reihenfolge', () => {
    expect(jpegTakenAt(jpegMitExif(0x9003, '2026:02:03 14:22:10'))).toBe('2026-02-03T14:22:10')
  })

  it('liest ihn genauso in Motorola-Byte-Reihenfolge', () => {
    expect(jpegTakenAt(jpegMitExif(0x9003, '2026:02:03 14:22:10', 'MM'))).toBe('2026-02-03T14:22:10')
  })

  it('nimmt DateTime nur, wenn DateTimeOriginal fehlt', () => {
    expect(jpegTakenAt(jpegMitExif(0x0132, '2026:02:05 09:00:00'))).toBe('2026-02-05T09:00:00')
  })

  it('rechnet nichts in eine Zeitzone um — kein Z am Ende', () => {
    expect(jpegTakenAt(jpegMitExif(0x9003, '2026:02:03 14:22:10'))?.endsWith('Z')).toBe(false)
  })
})

describe('alles Unerwartete ergibt nichts statt eines Datums', () => {
  it('gibt bei einer Datei ohne JPEG-Kopf nichts zurück', () => {
    expect(jpegTakenAt(Buffer.from('%PDF-1.7\n'))).toBeUndefined()
  })

  it('gibt bei einem JPEG ohne EXIF nichts zurück', () => {
    expect(jpegTakenAt(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02]))).toBeUndefined()
  })

  it('läuft bei einer abgeschnittenen Datei nicht über den Puffer hinaus', () => {
    const voll = jpegMitExif(0x9003, '2026:02:03 14:22:10')
    for (let n = 2; n < voll.length; n += 3) {
      expect(() => jpegTakenAt(voll.subarray(0, n))).not.toThrow()
    }
  })

  it('nimmt einen unsinnigen Zeitstempel nicht an', () => {
    expect(jpegTakenAt(jpegMitExif(0x9003, '2026:13:45 99:99:99'))).toBeUndefined()
    expect(jpegTakenAt(jpegMitExif(0x9003, 'kein Datum'))).toBeUndefined()
  })
})
