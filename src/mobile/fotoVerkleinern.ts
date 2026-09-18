// ───────────────────────────────────────────────────────────────────────────
// Das Foto wird AUF DEM TELEFON kleingerechnet (#884).
//
// ─── WARUM HIER UND NICHT AM DESKTOP ───────────────────────────────────────
//
// Weil dazwischen das Hallen-WLAN liegt. Ein 12-Megapixel-Bild sind 4 MB, als
// base64 gut 5,5 MB — ueber ein ueberfuelltes 2,4-GHz-Netz sind das Sekunden
// bis Minuten, und der Server weist es mit 413 ab (4-MB-Deckel in
// `mobileShareServer.ts`). Heruntergerechnet sind es 200-400 KB.
//
// Der Deckel am Server bleibt trotzdem, und zwar nicht doppelt gemoppelt:
// dieses Modul laeuft in EINEM Browser, der Server nimmt von jedem entgegen,
// der das Token hat.
//
// ─── DIE ZAHLEN STEHEN NICHT HIER ──────────────────────────────────────────
//
// `FOTO_KANTE_MAX` und `FOTO_QUALITAET` kommen aus `renderer/lib/fotoMasse`.
// Sie hier abzuschreiben hiesse, dass ein Foto vom Telefon anders aussieht
// als eines vom Planer, sobald jemand eine der beiden Stellen aendert — und
// zwar unsichtbar (ADR-001). Das Modul ist rein und zieht nichts mit.
// ───────────────────────────────────────────────────────────────────────────
import { FOTO_KANTE_MAX, FOTO_QUALITAET } from '../renderer/lib/fotoMasse'

export interface VerkleinertesFoto {
  dataUri: string
  breite: number
  hoehe: number
}

/**
 * Eine Bilddatei auf `FOTO_KANTE_MAX` lange Kante herunterrechnen.
 *
 * `null`, wenn der Browser die Datei nicht als Bild lesen kann. Kleinere
 * Bilder werden nicht vergroessert. Gedreht wird nichts — `from-image`
 * beruecksichtigt die EXIF-Ausrichtung, mehr nicht.
 */
export async function verkleinere(datei: File): Promise<VerkleinertesFoto | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(datei, { imageOrientation: 'from-image' })
  } catch {
    return null
  }
  const lang = Math.max(bitmap.width, bitmap.height)
  const faktor = lang > FOTO_KANTE_MAX && lang > 0 ? FOTO_KANTE_MAX / lang : 1
  const breite = Math.max(1, Math.round(bitmap.width * faktor))
  const hoehe = Math.max(1, Math.round(bitmap.height * faktor))

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
  return { dataUri: flaeche.toDataURL('image/jpeg', FOTO_QUALITAET), breite, hoehe }
}
