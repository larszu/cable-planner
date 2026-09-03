/**
 * Register der ausgegebenen Dokumente — Roadmap-Initiative 5, letztes Stueck.
 *
 * DIE FRAGE, DIE ES BEANTWORTET. `changeImpact` konnte bisher nur zwei
 * *gegebene* Plan-Staende vergleichen. Die eigentlich gewuenschte Frage —
 * „welches der Blaetter, die ich ausgeteilt habe, ist jetzt hin?" — brauchte
 * etwas, das es nicht gab: ein Gedaechtnis dafuer, dass ein Dokument je
 * ausgegeben wurde. `documentStamp` baut den Stempel beim Export und die App
 * vergisst den Vorgang; der Rueckweg funktionierte nur, weil der Stand auf dem
 * *Papier* steht und der Nutzer den Zettel mitbringt.
 *
 * WARUM EINE EIGENE DATEI UND NICHT DAS PROJEKTFILE. Das war die tragende
 * Entscheidung, und sie gehoerte dem Eigentuemer (`INITIATIVE-5-SCOPING.md`
 * hat die vier Fragen daran gestellt). Gewaehlt wurde: getrennte Datei.
 *
 * Damit fallen drei der vier Fragen weg, statt beantwortet werden zu muessen:
 *   - Das Dateiformat bleibt unangetastet.
 *   - Der CRDT-Merge-Fall entsteht gar nicht. Zwei Leute, die dieselbe Liste
 *     an zwei Orten drucken, haetten in einem mitreisenden Protokoll leicht
 *     etwas behauptet, das so nie passiert ist.
 *   - Ein Arbeitsprotokoll ist ohnehin kein Plan-Inhalt.
 *
 * Der Preis, ausdruecklich: **das Register reist nicht mit.** Es haelt fest,
 * was DIESE Maschine ausgegeben hat. Wer den Plan weitergibt, gibt seine
 * Druck-Historie nicht mit — und das ist die richtige Seite des Tauschs, denn
 * die Frage lautet „was habe *ich* ausgeteilt", nicht „was hat irgendwer".
 *
 * VIERTE FRAGE, DIE BLEIBT: wie lange. Ein Protokoll ohne Verfall waechst mit
 * jedem Ausdruck. Hier: die juengsten `MAX_ENTRIES` bleiben, aeltere fallen
 * heraus — und die Oberflaeche sagt es, wenn gekuerzt wurde. Ein still
 * gekuerztes Protokoll waere seine eigene kleine Luege.
 */
import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteFile } from '../util/atomicWrite.js'

export interface DocumentLogEntry {
  /** Bezeichner wie in `documentRegistry` — derselbe, der im Dateinamen steht. */
  docId: string
  /** Lesbarer Name zum Zeitpunkt der Ausgabe. */
  label: string
  /** Der Stand, der auf dem Blatt steht. Acht Hex-Zeichen. */
  stand: string
  /** Wann ausgegeben (ISO). */
  emittedAt: string
  /** Projektname zum Zeitpunkt der Ausgabe — zum Wiederfinden in der Liste. */
  project: string
  /** Pfad des Projekts, falls bekannt. Ordnet den Eintrag eindeutig zu. */
  projectPath?: string
}

export interface DocumentLog {
  version: 1
  entries: DocumentLogEntry[]
  /** Wie viele Eintraege der Verfall bisher entfernt hat. Nie verschwiegen. */
  dropped: number
}

/**
 * Obergrenze. Bewusst grosszuegig: das Register soll eine Produktionsphase
 * ueberdauern, nicht eine Sitzung. Bei ~30 Ausdrucken je Projekttag sind das
 * gut zwei Wochen Dauerbetrieb.
 */
export const MAX_ENTRIES = 500

const EMPTY: DocumentLog = { version: 1, entries: [], dropped: 0 }

const logPath = (): string => path.join(app.getPath('userData'), 'document-log.json')

export const readDocumentLog = async (): Promise<DocumentLog> => {
  try {
    const parsed = JSON.parse(await readFile(logPath(), 'utf-8')) as Partial<DocumentLog>
    if (!parsed || !Array.isArray(parsed.entries)) return { ...EMPTY }
    return {
      version: 1,
      entries: parsed.entries.filter(
        (e): e is DocumentLogEntry =>
          !!e && typeof e.docId === 'string' && typeof e.stand === 'string',
      ),
      dropped: typeof parsed.dropped === 'number' ? parsed.dropped : 0,
    }
  } catch {
    // Kein Register, oder ein unlesbares. Beides heisst „nichts ausgegeben,
    // soweit ich weiss" — und genau so wird es in der Oberflaeche gelesen.
    return { ...EMPTY }
  }
}

/**
 * Einen Eintrag anhaengen. Gibt das gekuerzte Register zurueck, damit der
 * Aufrufer sieht, ob etwas herausgefallen ist.
 */
export const appendDocumentLog = async (
  entry: DocumentLogEntry,
): Promise<DocumentLog> => {
  const log = await readDocumentLog()
  const entries = [...log.entries, entry]
  const overflow = Math.max(0, entries.length - MAX_ENTRIES)
  const next: DocumentLog = {
    version: 1,
    entries: overflow > 0 ? entries.slice(overflow) : entries,
    dropped: log.dropped + overflow,
  }
  await atomicWriteFile(logPath(), JSON.stringify(next, null, 2))
  return next
}

/** Register leeren. `dropped` faellt mit weg: es zaehlt den Verfall, nicht das Loeschen. */
export const clearDocumentLog = async (): Promise<DocumentLog> => {
  await atomicWriteFile(logPath(), JSON.stringify(EMPTY, null, 2))
  return { ...EMPTY }
}
