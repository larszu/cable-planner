/**
 * Den Aufnahmezeitpunkt aus einem JPEG lesen — ohne Abhaengigkeit.
 *
 * BEDARF 97. Wer einen Kassenzettel abfotografiert, traegt das Datum danach
 * von Hand nach („Every receipt hand-typed: date, type, description,
 * amount"). Dabei steht es in der Datei: `DateTimeOriginal` ist der Moment,
 * in dem die Kamera ausgeloest hat. Das ist kein geratener Wert, sondern eine
 * Tatsache aus der Datei — und deshalb der einzige Zeitpunkt in dieser App,
 * der ohne Zutun eines Menschen in ein Datumsfeld darf.
 *
 * WARUM VON HAND UND NICHT MIT EINER BIBLIOTHEK: gebraucht werden genau zwei
 * Felder. Eine EXIF-Bibliothek brachte einen Parser fuer hundert weitere mit,
 * der auf jede Datei losgelassen wird, die ein Nutzer anhaengt — mehr
 * Angriffsflaeche fuer weniger Nutzen. Alles hier liest mit Grenzenpruefung
 * und gibt bei allem Unerwarteten `undefined` zurueck.
 *
 * WAS ES NICHT TUT: es rechnet die Zeit NICHT in eine Zone um. EXIF traegt
 * (in dieser Fassung) keine Zone, und eine anzunehmen verschoebe den
 * Zeitpunkt um bis zu einen halben Tag. Zurueck kommt die lokale Angabe, so
 * wie sie in der Datei steht — dieselbe Regel wie beim Kalender-Feed.
 */

const ASCII = 2

/** Ein IFD nach einem Tag durchsuchen. Gibt den ASCII-Wert zurueck. */
const asciiTag = (
  buf: Buffer,
  tiff: number,
  ifd: number,
  little: boolean,
  gesucht: number,
): string | undefined => {
  const u16 = (o: number) => (little ? buf.readUInt16LE(o) : buf.readUInt16BE(o))
  const u32 = (o: number) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o))
  if (ifd + 2 > buf.length) return undefined
  const anzahl = u16(ifd)
  for (let i = 0; i < anzahl; i += 1) {
    const e = ifd + 2 + i * 12
    if (e + 12 > buf.length) return undefined
    if (u16(e) !== gesucht) continue
    if (u16(e + 2) !== ASCII) return undefined
    const laenge = u32(e + 4)
    if (laenge === 0 || laenge > 64) return undefined
    const start = laenge <= 4 ? e + 8 : tiff + u32(e + 8)
    if (start < 0 || start + laenge > buf.length) return undefined
    return buf.subarray(start, start + laenge).toString('latin1').replace(/\0.*$/, '').trim()
  }
  return undefined
}

/** Den Zeiger auf das Exif-Unter-IFD (Tag 0x8769) holen. */
const exifIfdOffset = (buf: Buffer, tiff: number, ifd0: number, little: boolean): number | undefined => {
  const u16 = (o: number) => (little ? buf.readUInt16LE(o) : buf.readUInt16BE(o))
  const u32 = (o: number) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o))
  if (ifd0 + 2 > buf.length) return undefined
  const anzahl = u16(ifd0)
  for (let i = 0; i < anzahl; i += 1) {
    const e = ifd0 + 2 + i * 12
    if (e + 12 > buf.length) return undefined
    if (u16(e) === 0x8769) return tiff + u32(e + 8)
  }
  return undefined
}

/** `2026:02:03 14:22:10` → `2026-02-03T14:22:10`. Alles andere: nichts. */
const exifZeitZuIso = (roh: string): string | undefined => {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(roh.trim())
  if (!m) return undefined
  const [, j, mo, t, h, mi, s] = m
  if (Number(mo) < 1 || Number(mo) > 12 || Number(t) < 1 || Number(t) > 31) return undefined
  if (Number(h) > 23 || Number(mi) > 59 || Number(s) > 60) return undefined
  return `${j}-${mo}-${t}T${h}:${mi}:${s}`
}

/**
 * Aufnahmezeitpunkt eines JPEG als lokaler ISO-String, oder `undefined`.
 *
 * Bevorzugt `DateTimeOriginal` (0x9003, wann ausgeloest wurde) vor `DateTime`
 * (0x0132, wann die Datei zuletzt geschrieben wurde) — der Unterschied ist
 * genau der zwischen dem Tag des Einkaufs und dem Tag, an dem jemand das Bild
 * durch ein Programm geschoben hat.
 */
export const jpegTakenAt = (buf: Buffer): string | undefined => {
  if (buf.length < 12 || buf[0] !== 0xff || buf[1] !== 0xd8) return undefined
  let o = 2
  while (o + 4 <= buf.length) {
    if (buf[o] !== 0xff) return undefined
    const marker = buf[o + 1]
    // Start of Scan: ab hier kommen Bilddaten, kein EXIF mehr.
    if (marker === 0xda || marker === 0xd9) return undefined
    const groesse = buf.readUInt16BE(o + 2)
    if (groesse < 2 || o + 2 + groesse > buf.length) return undefined
    if (marker === 0xe1 && buf.subarray(o + 4, o + 10).toString('latin1') === 'Exif\0\0') {
      const tiff = o + 10
      if (tiff + 8 > buf.length) return undefined
      const ordnung = buf.subarray(tiff, tiff + 2).toString('latin1')
      if (ordnung !== 'II' && ordnung !== 'MM') return undefined
      const little = ordnung === 'II'
      const u32 = (x: number) => (little ? buf.readUInt32LE(x) : buf.readUInt32BE(x))
      const ifd0 = tiff + u32(tiff + 4)
      if (ifd0 < tiff || ifd0 > buf.length) return undefined
      const exifIfd = exifIfdOffset(buf, tiff, ifd0, little)
      const original =
        exifIfd !== undefined && exifIfd >= tiff && exifIfd < buf.length
          ? asciiTag(buf, tiff, exifIfd, little, 0x9003)
          : undefined
      const roh = original ?? asciiTag(buf, tiff, ifd0, little, 0x0132)
      return roh ? exifZeitZuIso(roh) : undefined
    }
    o += 2 + groesse
  }
  return undefined
}
