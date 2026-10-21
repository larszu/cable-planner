// Dokumente, die in die KI-Plan-Generierung gezogen werden.
//
// PDFs und Bilder gehen unverändert ans Modell: alle drei Anbieter lesen PDFs
// selbst, und bei Blockschaltbildern oder Grundrissen steckt die Information
// in der Zeichnung, nicht im extrahierbaren Text. Tabellen werden dagegen
// hier zu CSV — so liest das Modell Zeile und Spalte, statt eine Tabelle aus
// einem Seitenbild zu raten.

import type { CablePlannerProject } from '../types/project'
import { looksLikeProject } from './looksLikeProject'
import { planKontext } from './planVervollstaendigung'

export type DokumentArt = 'pdf' | 'bild' | 'tabelle' | 'text' | 'plan'

export interface PlanDokument {
  name: string
  art: DokumentArt
  bytes: number
  /** PDF oder Bild als Data-URI. */
  dataUri?: string
  /** Tabelle als CSV, Textdatei oder Zusammenfassung eines Referenzplans. */
  text?: string
}

/** Was das Feld annimmt; dient auch dem `accept` des Datei-Dialogs. */
export const PLAN_DOKUMENT_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.ods,.csv,.tsv,.txt,.md,.json,.cableplan'

/** Gesamtgrenze der Anhänge — Claude nimmt 32 MB je Anfrage, Base64 bläht um ein Drittel. */
export const PLAN_DOKUMENTE_MAX_BYTES = 20 * 1024 * 1024

const endung = (name: string): string => name.toLowerCase().split('.').pop() ?? ''

export const dokumentArt = (name: string, mime = ''): DokumentArt | null => {
  const e = endung(name)
  if (e === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'webp'].includes(e) || mime.startsWith('image/')) return 'bild'
  if (['xlsx', 'xls', 'ods'].includes(e)) return 'tabelle'
  if (e === 'cableplan') return 'plan'
  if (['csv', 'tsv', 'txt', 'md', 'json'].includes(e) || mime.startsWith('text/')) return 'text'
  return null
}

const alsDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error ?? new Error(`Could not read ${file.name}`))
    r.readAsDataURL(file)
  })

/** Jede Tabelle eines Arbeitsblatts als CSV, leere Zeilen weg. */
export const tabelleAlsText = async (daten: ArrayBuffer): Promise<string> => {
  const XLSX = await import('xlsx-js-style')
  const wb = XLSX.read(daten, { type: 'array' })
  return wb.SheetNames.map(
    (n) => `## ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ';', blankrows: false })}`,
  ).join('\n\n')
}

export const leseDokument = async (file: File): Promise<PlanDokument> => {
  const art = dokumentArt(file.name, file.type)
  if (!art) throw new Error(`${file.name}: file type not supported`)
  const basis = { name: file.name, art, bytes: file.size }
  if (art === 'pdf' || art === 'bild') {
    const dataUri = await alsDataUri(file)
    // Manche Systeme liefern PDFs als application/octet-stream.
    return { ...basis, dataUri: art === 'pdf' ? dataUri.replace(/^data:[^;]*;/, 'data:application/pdf;') : dataUri }
  }
  if (art === 'tabelle') return { ...basis, text: await tabelleAlsText(await file.arrayBuffer()) }
  const roh = await file.text()
  if (art === 'plan' || endung(file.name) === 'json') {
    try {
      const json = JSON.parse(roh) as unknown
      if (looksLikeProject(json)) {
        return { ...basis, art: 'plan', text: planKontext(json as CablePlannerProject) }
      }
    } catch {
      /* kein Plan — als Text weiterreichen */
    }
  }
  return { ...basis, art: 'text', text: roh }
}
