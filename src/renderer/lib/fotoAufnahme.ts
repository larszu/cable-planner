// ───────────────────────────────────────────────────────────────────────────
// Ein Foto hereinnehmen — und dabei kleinrechnen (#884).
//
// ─── WARUM ÜBERHAUPT KLEINRECHNEN ──────────────────────────────────────────
//
// Ein Telefonfoto hat 12 Megapixel und 3–5 MB. In einem Plan beantwortet es
// dieselbe Frage wie eines mit 1600 px langer Kante — „wie war es verkabelt",
// „wo war der Schaden" —, kostet aber das Zwanzigfache. Die Datei wird
// weitergegeben, gedruckt, in den Viewer geladen; jedes Megabyte ist eines,
// das jemand überträgt.
//
// ─── UND WARUM HIER UND NICHT IM REINEN MODUL ──────────────────────────────
//
// Weil Kleinrechnen eine Zeichenfläche braucht. `lib/fotoMasse.ts` rechnet
// und weiss nichts vom Browser; diese Datei ist die Stelle, an der es einen
// `<canvas>` gibt. Dieselbe Trennung wie bei der Pixelmap der LED-Wand.
//
// ─── WAS NICHT PASSIERT ────────────────────────────────────────────────────
//
// Es wird nichts gedreht und nichts korrigiert. Die EXIF-Ausrichtung eines
// Telefonfotos liest `createImageBitmap` mit `imageOrientation: 'from-image'`
// — das ist der Browser und nicht diese Datei. Sie selbst dreht nichts: eine
// geratene Drehung stünde später kopfüber im Bericht, und niemand wüsste, wer
// sie gedreht hat.
//
// Und es wird kein Aufnahmezeitpunkt erfunden. Gibt die Datei einen her
// (`lastModified`), steht er drin; sonst steht dort nichts. „Jetzt" wäre die
// Importzeit, und die steht ohnehin in `hinzugefuegtAm`.
// ───────────────────────────────────────────────────────────────────────────
import { v4 as uuidv4 } from 'uuid'
import { FOTO_KANTE_MAX, FOTO_QUALITAET } from './fotoMasse'
import type { Foto, FotoQuelle, FotoZiel } from '../types/foto'

/** Das Ergebnis — samt dem, was das Kleinrechnen gespart hat. */
export interface Aufnahme {
  foto: Foto
  /** Grösse der Datei, wie sie hereinkam. */
  originalBytes: number
}

/**
 * Die Zielmasse für ein Bild: die lange Kante auf `FOTO_KANTE_MAX`, das
 * Seitenverhältnis bleibt. Kleinere Bilder werden NICHT vergrössert — ein
 * hochgerechnetes Bild hat mehr Pixel und nicht mehr Inhalt.
 */
export const zielMasse = (
  breite: number,
  hoehe: number,
  kante = FOTO_KANTE_MAX,
): { breite: number; hoehe: number } => {
  const lang = Math.max(breite, hoehe)
  if (lang <= kante || lang === 0) return { breite, hoehe }
  const faktor = kante / lang
  return { breite: Math.round(breite * faktor), hoehe: Math.round(hoehe * faktor) }
}

/**
 * Eine Bilddatei hereinnehmen.
 *
 * `null`, wenn der Browser sie nicht als Bild lesen kann — eine kaputte
 * Datei wird nicht als leeres Foto angelegt.
 */
export async function nimmFoto(
  datei: File,
  jetzt: string,
  quelle: FotoQuelle = 'planer',
  zeigtAuf?: FotoZiel,
): Promise<Aufnahme | null> {
  let bitmap: ImageBitmap
  try {
    // `from-image`: der Browser dreht nach EXIF. Diese Datei dreht nicht
    // selbst — siehe Kopf.
    bitmap = await createImageBitmap(datei, { imageOrientation: 'from-image' })
  } catch {
    return null
  }

  const { breite, hoehe } = zielMasse(bitmap.width, bitmap.height)
  const flaeche = document.createElement('canvas')
  flaeche.width = breite
  flaeche.height = hoehe
  const ctx = flaeche.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return null
  }
  ctx.drawImage(bitmap, 0, 0, breite, hoehe)
  bitmap.close()

  const dataUri = flaeche.toDataURL('image/jpeg', FOTO_QUALITAET)
  return {
    originalBytes: datei.size,
    foto: {
      id: uuidv4(),
      dataUri,
      breite,
      hoehe,
      bytes: dataUri.length,
      zeigtAuf,
      quelle,
      // Nur, wenn die Datei einen Zeitpunkt hergab. Siehe Kopf.
      aufgenommenAm: datei.lastModified ? new Date(datei.lastModified).toISOString() : undefined,
      hinzugefuegtAm: jetzt,
    },
  }
}

/**
 * #1240 — die lange Kante eines Standbilds im Media-Pool. 1920 ist das Format
 * eines HD-Stills am Mischer; mehr braucht weder die Simulation noch die
 * Vorschau.
 */
export const STANDBILD_KANTE_MAX = 1920

/**
 * #1240 — ein Standbild fuer den Media-Pool eines Mischers.
 *
 * Anders als ein Foto bleibt ein PNG ein PNG: eine Bauchbinde traegt ihre
 * Transparenz, und genau die braucht der Keyer als Key. Alles andere wird
 * wie ein Foto zu JPEG. Das Bild liegt im Projekt (`project.fotos`), also
 * auch im Browser und in einem Projekt, das noch keinen Ordner hat.
 */
export async function nimmStandbild(datei: File, jetzt: string, zeigtAuf?: FotoZiel): Promise<Aufnahme | null> {
  if (!/^image\//.test(datei.type) && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(datei.name)) return null
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(datei)
  } catch {
    return null
  }
  const { breite, hoehe } = zielMasse(bitmap.width, bitmap.height, STANDBILD_KANTE_MAX)
  const flaeche = document.createElement('canvas')
  flaeche.width = breite
  flaeche.height = hoehe
  const ctx = flaeche.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return null
  }
  ctx.drawImage(bitmap, 0, 0, breite, hoehe)
  bitmap.close()
  const png = datei.type === 'image/png' || /\.png$/i.test(datei.name)
  const dataUri = png ? flaeche.toDataURL('image/png') : flaeche.toDataURL('image/jpeg', 0.85)
  return {
    originalBytes: datei.size,
    foto: {
      id: uuidv4(),
      dataUri,
      breite,
      hoehe,
      bytes: dataUri.length,
      zeigtAuf,
      quelle: 'planer',
      hinzugefuegtAm: jetzt,
      notiz: datei.name,
    },
  }
}
