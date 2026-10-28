/**
 * Inhalt des Schriftfelds — EINE Quelle fuer Raster- und Vektor-PDF.
 * Vorher hatte jeder Weg seine eigene Zeilenliste; Revision, Stand und QR
 * kamen nur in die Raster-Kopie, und das Vektor-PDF lief stumm hinterher.
 * Die Wege unterscheiden sich nur noch darin, WIE sie zeichnen.
 */
import QRCode from 'qrcode'
import type { ProjectMetadata } from '../types/project'
import type { DocumentStamp } from './documentStamp'
import { buildDocQrPayload } from './qrPayload'
import { satz, satzKanonisch } from './satz'
import { titleBlockRowVisible, type TitleBlockRow } from './titleBlockScale'

const fmtDate = (iso?: string): string => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export const titleBlockRows = (
  meta: ProjectMetadata,
  stamp?: DocumentStamp,
): [string, string][] => {
  const all: [TitleBlockRow, string, string | undefined][] = [
    ['name', 'Projekt', meta.name],
    ['projectNumber', 'Projekt-Nr.', meta.projectNumber],
    ['client', 'Kunde', meta.client],
    ['contractor', 'Auftragnehmer', meta.contractor],
    ['author', 'Planer', meta.author],
    ['createdAt', 'Erstellt', fmtDate(meta.createdAt)],
    ['updatedAt', 'Geändert', fmtDate(meta.updatedAt)],
    // #412 — nur wenn eine Revision festgeschrieben ist. Initiative 4 — mit
    // Stempel sagt die Zeile dazu, ob der Plan seitdem weitergelaufen ist:
    // „Rev 2" allein liest sich auf Papier als *dieser Ausdruck ist Rev 2*.
    [
      'revision',
      'Revision',
      meta.revision &&
        (stamp?.drifted
          ? satzKanonisch(satz('rest.stamp.drifted', '{rev} + changes', { rev: meta.revision }))
          : meta.revision),
    ],
    ['stand', 'Stand', stamp && `#${stamp.fingerprint}`],
  ]
  return all
    .filter(([row, , v]) => {
      if (!titleBlockRowVisible(meta.titleBlock, row)) return false
      // Revision und Stand gibt es nur, wenn sie existieren; die Stammdaten
      // bleiben als Zeile stehen und zeigen „—", damit das Feld vollstaendig wirkt.
      return row === 'revision' || row === 'stand' ? !!v : true
    })
    .map(([, k, v]) => [k, v || '—'])
}

/** ADR-004 — Stand-Code fuer den Rueckweg vom Blatt. Der Stand steht im Code
 *  selbst, nicht in einer Datenbank: das Blatt muss ohne Netz aussagefaehig
 *  sein. Kein QR ist besser als kein PDF; die Stand-Zeile traegt ihn als Text. */
export const titleBlockQr = async (
  meta: ProjectMetadata,
  stamp?: DocumentStamp,
): Promise<string | undefined> => {
  if (!stamp || meta.titleBlock?.qr === false) return undefined
  try {
    return await QRCode.toDataURL(buildDocQrPayload('plan', stamp.fingerprint, stamp.revision), {
      margin: 0,
      width: 128,
    })
  } catch {
    return undefined
  }
}
