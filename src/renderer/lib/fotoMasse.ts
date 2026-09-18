// ───────────────────────────────────────────────────────────────────────────
// Warum die Fotos nicht in der Sicherungskopie stehen (#884).
//
// ─── DIE RECHNUNG, DIE DIESE DATEI TRÄGT ───────────────────────────────────
//
// Der Plan wird alle paar hundert Millisekunden nach `localStorage`
// gesichert, und `localStorage` fasst je nach Browser 5–10 MB. Ein Foto vom
// Telefon hat 3–5 MB. Selbst heruntergerechnet auf 1600 px lange Kante und
// JPEG-Qualität 0,72 bleiben 150–350 KB, als Data-URI ×1,37:
//
//     150 KB → 206 KB je Bild → 24 Bilder bis 5 MB
//     250 KB → 343 KB je Bild → 14 Bilder
//     350 KB → 480 KB je Bild → 10 Bilder
//
// Zehn Fotos sind für eine Dokumentation nichts. Die Sicherungskopie wäre
// also nach dem ersten Rundgang tot — und sie stirbt leise (der `catch` war
// bis 2026-09-18 leer; seither sagt es die Fussleiste).
//
// ─── DER WEG, DER DARAUS FOLGT ─────────────────────────────────────────────
//
// Die Fotos gehören zum Plan und reisen mit ihm: wer eine `.cableplan`-Datei
// weitergibt, gibt die Bilder mit. Nur die SICHERUNGSKOPIE im Browser
// bekommt sie nicht. Sie liegen dort in der eigenen Ablage (IndexedDB,
// `store/fotoSpeicher.ts`), deren Platz nach Festplatte bemessen ist und
// nicht nach fünf Megabyte.
//
// Damit gilt: EIN Plan, EINE Datei, und trotzdem eine Sicherungskopie, die
// nicht an der dritten Aufnahme zerbricht.
//
// ─── UND WARUM NICHT EINFACH GAR NICHT SICHERN ─────────────────────────────
//
// Weil die Sicherungskopie der einzige Schutz gegen einen Absturz vor dem
// ersten Speichern ist. Sie wegzulassen, sobald Fotos im Spiel sind, hiesse
// den Schutz genau dort abzuschalten, wo am meisten Arbeit drinsteckt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Foto } from '../types/foto'

/**
 * Was ein Foto beim Aufnehmen höchstens werden darf.
 *
 * 1600 px lange Kante: das ist mehr, als ein Ausdruck auf A4 auflöst, und
 * genug, um eine Beschriftung auf einem Patchfeld zu lesen. Wer mehr braucht,
 * braucht kein Planungswerkzeug, sondern das Originalfoto.
 */
export const FOTO_KANTE_MAX = 1600
/** JPEG-Qualität beim Herunterrechnen. */
export const FOTO_QUALITAET = 0.72

/**
 * Ab wann gewarnt wird.
 *
 * Nicht die Grenze von `localStorage` — die gilt für die Sicherungskopie, und
 * in der stehen die Bilder gar nicht. Das hier ist die Grenze der DATEI: ab
 * etwa 40 MB wird eine `.cableplan` unhandlich zum Verschicken, und das ist
 * der Moment, in dem jemand es wissen will, statt es am Mailserver zu
 * erfahren.
 */
export const FOTO_BUDGET_BYTES = 40_000_000

export interface FotoMasse {
  anzahl: number
  bytes: number
  /** Über dem Budget — dann steht es in der Fussleiste. */
  ueberBudget: boolean
}

export const fotoMasse = (fotos: readonly Foto[] | undefined): FotoMasse => {
  const bytes = (fotos ?? []).reduce((s, f) => s + (f.bytes || 0), 0)
  return { anzahl: fotos?.length ?? 0, bytes, ueberBudget: bytes > FOTO_BUDGET_BYTES }
}

/**
 * Die Fotos OHNE ihre Bilddaten — für die Sicherungskopie.
 *
 * Die Datensätze bleiben: wer nach einem Absturz wiederherstellt, soll sehen,
 * dass an dieser Kiste ein Foto hängt, auch wenn das Bild erst aus der
 * Ablage nachkommt. Ein stillschweigend verschwundenes Foto wäre schlimmer
 * als ein leerer Rahmen — es sagt niemandem, dass es je eines gab.
 */
export const ohneBilddaten = (fotos: readonly Foto[] | undefined): Foto[] =>
  (fotos ?? []).map((f) => ({ ...f, dataUri: '' }))

/** Hat dieser Datensatz sein Bild? */
export const hatBild = (f: Foto): boolean => f.dataUri.length > 0

/**
 * Die Bilddaten wieder einsetzen.
 *
 * Was die Ablage nicht hergibt, bleibt leer — und ausdrücklich nicht
 * weggeworfen: der Datensatz sagt dann „hier war ein Foto, sein Bild fehlt".
 * Das ist eine Auskunft; ein stiller Wegfall wäre keine.
 */
export const mitBilddaten = (
  fotos: readonly Foto[] | undefined,
  bilder: ReadonlyMap<string, string>,
): Foto[] =>
  (fotos ?? []).map((f) => (hatBild(f) ? f : { ...f, dataUri: bilder.get(f.id) ?? '' }))

/** Die Fotos zu einem Gerät oder Kabel. */
export const fotosZu = (
  fotos: readonly Foto[] | undefined,
  ziel: { equipmentId?: string; cableId?: string },
): Foto[] =>
  (fotos ?? []).filter((f) =>
    ziel.equipmentId
      ? f.zeigtAuf?.equipmentId === ziel.equipmentId
      : ziel.cableId
        ? f.zeigtAuf?.cableId === ziel.cableId
        : false,
  )

/** Die Fotos, die auf nichts zeigen — sie gehören dem Projekt. */
export const fotosOhneZiel = (fotos: readonly Foto[] | undefined): Foto[] =>
  (fotos ?? []).filter((f) => !f.zeigtAuf?.equipmentId && !f.zeigtAuf?.cableId)
