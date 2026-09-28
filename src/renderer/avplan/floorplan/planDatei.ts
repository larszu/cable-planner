// @avplan/floorplan — Plan-Datei laden: per Auswahl ODER per Drag & Drop.
// Quelle: av-planner-suite/packages/floorplan (ADR-015). Nicht in der Kopie
// aendern — Aenderungen hier, dann `npm run pakete:verteilen`.
//
// WARUM ES DAS GIBT. Am 2026-09-28 gemessen: kein Planer nahm ein Bild an,
// das man auf den Grundriss zieht. Vier Planer hatten je einen eigenen
// Lader, jeder mit einer anderen Luecke — cable verkleinerte, konnte aber
// kein PDF; light las jede PDF-Seite, speicherte aber verlustbehaftet in
// 1600 px; multicam las nur die erste Seite und speicherte unverkleinert;
// der Gebaeude-Planer kannte nur einen getippten Pfad, den Browser und
// Electron beide nicht laden. Hier steht das Beste aus allen einmal.
//
// PDF OHNE PFLICHT-ABHAENGIGKEIT. pdf.js wiegt mit Worker ueber ein
// Megabyte. Wer PDFs lesen will, reicht einen `PdfSeitenRenderer` herein
// (`pdfjsRenderer(pdfjs)` baut ihn aus dem geladenen Modul); ohne ihn nimmt
// der Lader nur Bilder an und sagt das, statt still zu scheitern.
//
// Nur Browser-APIs (FileReader, Image, Canvas) — nichts davon laeuft ohne
// DOM. Die reinen Teile (`istPlanDatei`, `zielGroesse`, `planDateienAus`)
// sind ohne DOM testbar.

/** Laengste Bildkante, die in ein Dokument geht. Ein Hallenplan braucht
 *  nicht mehr; ein 12-Megapixel-Foto sprengte sonst die Projektdatei und die
 *  Wiederherstellungskopie im Browser-Speicher. */
export const PLAN_MAX_KANTE = 3000
/** Groesste PDF-Datei, die gelesen wird (multicam-Grenze). */
export const PLAN_PDF_MAX_BYTES = 50 * 1024 * 1024
/** Groesste Bilddatei vor dem Verkleinern. */
export const PLAN_BILD_MAX_BYTES = 40 * 1024 * 1024

export type PlanDateiFehlerCode = 'typ' | 'pdf-nicht-verfuegbar' | 'zu-gross' | 'lesen' | 'bild' | 'pdf'

export class PlanDateiFehler extends Error {
  readonly code: PlanDateiFehlerCode
  constructor(code: PlanDateiFehlerCode, nachricht?: string) {
    super(nachricht ?? code)
    this.code = code
  }
}

/** Rendert EINE Seite eines PDFs zu einem Bild. `seite` beginnt bei 0. */
export type PdfSeitenRenderer = (
  daten: Uint8Array,
  seite: number,
  zielKante: number,
) => Promise<{ dataUrl: string; breite: number; hoehe: number; seiten: number }>

export interface GeladenerPlan {
  /** data:-URL; reist im Dokument mit. */
  src: string
  name: string
  naturalWidth: number
  naturalHeight: number
  art: 'bild' | 'pdf'
  /** Seitenzahl des PDFs, bei Bildern 1. */
  seiten: number
  /** Gerenderte Seite, ab 0. */
  seite: number
}

export interface PlanLadeOptionen {
  maxKante?: number
  pdf?: PdfSeitenRenderer
  seite?: number
}

type DateiArt = Pick<File, 'name' | 'type'>

const BILD_ENDUNGEN = /\.(png|jpe?g|webp|gif|bmp|avif)$/i

export const istBildDatei = (f: DateiArt): boolean =>
  f.type.startsWith('image/') ? f.type !== 'image/svg+xml' : BILD_ENDUNGEN.test(f.name)

export const istPdfDatei = (f: DateiArt): boolean => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

/** Taugt die Datei als Plan? PDFs nur, wenn ein Renderer da ist. */
export const istPlanDatei = (f: DateiArt, o: { pdf?: boolean } = {}): boolean =>
  istBildDatei(f) || (!!o.pdf && istPdfDatei(f))

/** Das `accept`-Attribut fuer ein `<input type="file">`, passend zum Lader. */
export const planAccept = (o: { pdf?: boolean } = {}): string => (o.pdf ? 'image/*,application/pdf,.pdf' : 'image/*')

type DateiTraeger = { types?: readonly string[] | DOMStringList; files?: FileList | readonly File[] | null } | null | undefined

/** Traegt ein Drag-Ereignis Dateien? Waehrend `dragover` sind die Dateien
 *  selbst noch nicht lesbar, nur der Typ `Files`. */
export const ziehtDateien = (dt: DataTransfer | DateiTraeger): boolean => {
  const types = dt?.types
  if (!types) return false
  return Array.from(types as ArrayLike<string>).includes('Files')
}

/** Die brauchbaren Plan-Dateien eines Drops, in ihrer Reihenfolge. */
export const planDateienAus = (dt: DataTransfer | DateiTraeger, o: { pdf?: boolean } = {}): File[] =>
  Array.from((dt?.files ?? []) as ArrayLike<File>).filter((f) => istPlanDatei(f, o))

/** Zielgroesse nach dem Verkleinern; `faktor` 1 heisst: bleibt, wie es ist. */
export const zielGroesse = (breite: number, hoehe: number, maxKante = PLAN_MAX_KANTE) => {
  const faktor = Math.min(1, maxKante / Math.max(breite, hoehe, 1))
  return { breite: Math.max(1, Math.round(breite * faktor)), hoehe: Math.max(1, Math.round(hoehe * faktor)), faktor }
}

const leseAlsDataUrl = (f: Blob): Promise<string> =>
  new Promise((ok, fehler) => {
    const r = new FileReader()
    r.onerror = () => fehler(new PlanDateiFehler('lesen'))
    r.onload = () => ok(String(r.result))
    r.readAsDataURL(f)
  })

const ladeBild = (src: string): Promise<HTMLImageElement> =>
  new Promise((ok, fehler) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => fehler(new PlanDateiFehler('bild'))
    img.src = src
  })

/**
 * Eine Datei als Plan laden. Bilder ueber `maxKante` werden als JPEG (0,9)
 * verkleinert; kleinere bleiben unveraendert. PDFs rendert der uebergebene
 * Renderer auf weissem Grund, hoechstens `maxKante` lang.
 */
export async function ladePlanDatei(datei: File, o: PlanLadeOptionen = {}): Promise<GeladenerPlan> {
  const maxKante = o.maxKante ?? PLAN_MAX_KANTE
  if (istPdfDatei(datei)) {
    if (!o.pdf) throw new PlanDateiFehler('pdf-nicht-verfuegbar')
    if (datei.size > PLAN_PDF_MAX_BYTES) throw new PlanDateiFehler('zu-gross')
    const seite = Math.max(0, Math.floor(o.seite ?? 0))
    let r: Awaited<ReturnType<PdfSeitenRenderer>>
    try {
      r = await o.pdf(new Uint8Array(await datei.arrayBuffer()), seite, maxKante)
    } catch (e) {
      throw e instanceof PlanDateiFehler ? e : new PlanDateiFehler('pdf', e instanceof Error ? e.message : String(e))
    }
    return { src: r.dataUrl, name: datei.name, naturalWidth: r.breite, naturalHeight: r.hoehe, art: 'pdf', seiten: r.seiten, seite }
  }
  if (!istBildDatei(datei)) throw new PlanDateiFehler('typ')
  if (datei.size > PLAN_BILD_MAX_BYTES) throw new PlanDateiFehler('zu-gross')
  const original = await leseAlsDataUrl(datei)
  const img = await ladeBild(original)
  const z = zielGroesse(img.naturalWidth, img.naturalHeight, maxKante)
  if (z.faktor === 1) {
    return { src: original, name: datei.name, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, art: 'bild', seiten: 1, seite: 0 }
  }
  const c = document.createElement('canvas')
  c.width = z.breite
  c.height = z.hoehe
  const ctx = c.getContext('2d')
  if (!ctx) throw new PlanDateiFehler('bild')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, z.breite, z.hoehe)
  ctx.drawImage(img, 0, 0, z.breite, z.hoehe)
  return { src: c.toDataURL('image/jpeg', 0.9), name: datei.name, naturalWidth: z.breite, naturalHeight: z.hoehe, art: 'bild', seiten: 1, seite: 0 }
}

/** Der Teil von pdf.js, den der Renderer braucht — ohne den Typ zu importieren. */
export interface PdfjsModul {
  getDocument: (src: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number
      getPage: (n: number) => Promise<{
        getViewport: (o: { scale: number }) => { width: number; height: number }
        render: (o: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<unknown> }
      }>
      destroy?: () => unknown
    }>
  }
}

/**
 * Renderer aus einem geladenen pdf.js-Modul (Worker muss der Planer selbst
 * setzen, wie im light-planner: `GlobalWorkerOptions.workerSrc`). PNG auf
 * weissem Grund — Linien eines Plans bleiben so scharf.
 */
export const pdfjsRenderer =
  (pdfjs: PdfjsModul): PdfSeitenRenderer =>
  async (daten, seite, zielKante) => {
    const pdf = await pdfjs.getDocument({ data: daten }).promise
    try {
      const nr = Math.min(Math.max(0, seite), pdf.numPages - 1) + 1
      const page = await pdf.getPage(nr)
      const basis = page.getViewport({ scale: 1 })
      const scale = Math.min(zielKante, 2000) / Math.max(basis.width, basis.height, 1)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new PlanDateiFehler('pdf')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      return { dataUrl: canvas.toDataURL('image/png'), breite: canvas.width, hoehe: canvas.height, seiten: pdf.numPages }
    } finally {
      pdf.destroy?.()
    }
  }

/**
 * Die Handler fuer eine Ablageflaeche. Rahmenlos: gibt `onDragOver`,
 * `onDragLeave` und `onDrop` zurueck, die jeder Planer an sein Element
 * haengt (React, Konva-Container, blankes DOM). `onDragOver` MUSS
 * `preventDefault` rufen, sonst oeffnet der Browser die Datei selbst — im
 * Browser verlaesst er dabei die App, in Electron verschluckt der
 * Navigationsschutz sie still.
 */
export function planAblage(o: {
  onDatei: (datei: File) => void
  onUngeeignet?: (dateien: File[]) => void
  onAktiv?: (aktiv: boolean) => void
  pdf?: boolean
}) {
  type Ereignis = { preventDefault(): void; dataTransfer: DataTransfer | null }
  return {
    onDragOver(e: Ereignis) {
      if (!ziehtDateien(e.dataTransfer)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      o.onAktiv?.(true)
    },
    onDragLeave() {
      o.onAktiv?.(false)
    },
    onDrop(e: Ereignis) {
      if (!ziehtDateien(e.dataTransfer)) return
      e.preventDefault()
      o.onAktiv?.(false)
      const passend = planDateienAus(e.dataTransfer, { pdf: o.pdf })
      if (passend[0]) o.onDatei(passend[0])
      else o.onUngeeignet?.(Array.from((e.dataTransfer?.files ?? []) as ArrayLike<File>))
    },
  }
}
