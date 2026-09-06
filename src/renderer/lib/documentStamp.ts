/**
 * Dokument-Stempel — was ein Ausdruck über sich selbst weiß.
 *
 * Roadmap-Initiative 4. Die Recherche ist an einer Stelle eindeutig: Papier ist
 * kein Altlast-Verhalten, das man wegautomatisiert. Kamera-Leute und Lageristen
 * halten daran fest, *weil* es ohne Akku funktioniert und sich nicht unter der
 * Hand ändert. Der eigentliche Fehler ist ein anderer: **ein Ausdruck veraltet
 * unsichtbar.**
 *
 * Der Stempel beantwortet deshalb genau eine Frage, und zwar entscheidbar:
 * *Ist dieses Blatt noch der aktuelle Stand?* Nicht „ungefähr", nicht „das
 * Projekt wurde seitdem angefasst" — sondern: enthält es dieselben Zeilen, die
 * es heute enthielte.
 *
 * Zwei Regeln, beide aus ADR-003 (bestätigter Zustand):
 *
 *  1. **Der Fingerabdruck läuft über den Inhalt des Dokuments, nicht über das
 *     Projekt.** Ein verschobener Knoten auf dem Canvas ändert keine Zeile der
 *     Pull-Liste. Würde er sie trotzdem als veraltet markieren, wäre der
 *     Hinweis nach einer Woche Rauschen — und ein Hinweis, den alle
 *     wegklicken, ist schlimmer als keiner.
 *  2. **Ohne festgeschriebene Revision behauptet der Stempel keine Abweichung.**
 *     `drifted` ist dann `false`, weil es nichts gibt, wovon abgewichen werden
 *     könnte. Eine erfundene Abweichung ist derselbe Schaden wie ein erfundener
 *     Zustand.
 */
import { toCsv, type CsvCell, type CsvTable } from './csv'
import { buildDocQrPayload } from './qrPayload'
import { dictionaryBlock } from './dataDictionary'
import type { CablePlannerProject, ProjectRevision, RevisionSnapshot } from '../types/project'

export interface DocumentStamp {
  /** Projektname, wie er im Plan steht. */
  project: string
  /** Label der zuletzt festgeschriebenen Revision, sonst nicht gesetzt. */
  revision?: string
  /**
   * Der Plan weicht von der festgeschriebenen Revision ab — der Ausdruck ist
   * also nicht „Rev 2", sondern „Rev 2 plus Änderungen". Ohne Revision immer
   * `false`: keine Behauptung ohne Bezugspunkt.
   */
  drifted: boolean
  /** Zeitpunkt der Erzeugung (ISO). */
  printedAt: string
  /** 8 Hex-Zeichen über den Inhalt — der eigentliche Vergleichswert. */
  fingerprint: string
}

/**
 * FNV-1a, 32 Bit, als 8 Hex-Zeichen.
 *
 * Bewusst kein Krypto-Hash: der Stempel schützt vor Verwechslung, nicht vor
 * Fälschung. Acht Zeichen kann ein Mensch am Telefon vorlesen und mit dem
 * Bildschirm vergleichen — das ist der Rückweg vom Papier, den die Recherche
 * verlangt, und er braucht kein Gerät.
 */
export const fingerprint = (input: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    // FNV-Prime 16777619, in 32-Bit-Arithmetik ohne BigInt.
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Zellen zu einem stabilen String.
 *
 * Der Trenner ist ein Unit-Separator (U+001F) und kein Semikolon: Zellen
 * enthalten Semikolons, Kommas und Zeilenumbrüche. Ein Trenner, der im Inhalt
 * vorkommen kann, macht zwei verschiedene Dokumente gleich — genau das, was ein
 * Fingerabdruck nicht darf.
 */
const SEP = '\u001F'
const ROW_SEP = '\u001E'
/**
 * Trenner zwischen den Bloecken eines Plan-Fingerabdrucks (Geraete, Kabel,
 * Orte, Haken). Stand bisher als rohes Steuerzeichen im Aufruf; als Konstante
 * ist im Quelltext sichtbar, dass es drei verschiedene Ebenen von Trennern
 * gibt. Der Wert ist unveraendert — bestehende Fingerabdruecke bleiben gueltig.
 */
const BLOCK_SEP = '\u001D'

const joinRows = (headers: string[], rows: CsvCell[][]): string =>
  [headers, ...rows]
    .map((row) => row.map((c) => (c === null || c === undefined ? '' : String(c))).join(SEP))
    .join(ROW_SEP)

/** Fingerabdruck über den Inhalt eines Zeilen-Dokuments (CSV-Listen). */
export const documentFingerprint = (headers: string[], rows: CsvCell[][]): string =>
  fingerprint(joinRows(headers, rows))

/**
 * Die Haken, die wirklich auf dem Blatt stehen.
 *
 * Der Mobile-Viewer schickt gesteckte Ports zurueck (`checkState.ports`,
 * Schluessel `geraet|port`), und `EquipmentNode` zeichnet dafuer ein gruenes
 * Haekchen an den Port. Beide Plan-Export-Wege nehmen das mit: der Raster-Weg
 * fotografiert das Viewport-DOM, der Vektor-Weg klont es. Ein gesetzter Haken
 * ist damit eine sichtbar andere Zeichnung — und stand bisher trotzdem nicht im
 * Fingerabdruck. Ein Blatt, das den Aufbaustand von gestern zeigt, meldete sich
 * im Dokument-Register als aktueller Stand.
 *
 * Gefiltert wird auf das, was wirklich gezeichnet wird:
 *
 *  - **Nur `ports`.** Kabel-Haken (`checkState.cables`) stehen ausschliesslich
 *    im Kontextmenue, nicht auf der Zeichnung. Sie mitzuzaehlen hiesse, eine
 *    Abweichung zu behaupten, die auf dem Papier niemand sehen kann — derselbe
 *    Fehler wie eine verschwiegene, nur andersherum.
 *  - **Nur Haken, zu denen es Geraet UND Port gibt.** `EquipmentNode` laeuft
 *    ueber die Port-Listen und schlaegt den Haken nach; ein Schluessel ohne
 *    Port zeichnet nichts. Solche Leichen bleiben liegen (beim Loeschen eines
 *    Geraets raeumt niemand `checkState` auf) und duerfen den Stand nicht
 *    bewegen.
 */
const visiblePortChecks = (project: CablePlannerProject | RevisionSnapshot): string[] => {
  const checks = project.checkState?.ports
  if (!checks) return []
  const out: string[] = []
  for (const item of project.equipment ?? []) {
    for (const port of [...(item.inputs ?? []), ...(item.outputs ?? [])]) {
      if (checks[`${item.id}|${port.id}`]) out.push([item.id, port.id].join(SEP))
    }
  }
  return out.sort()
}

/**
 * Fingerabdruck über den *Zeichnungs*-Inhalt eines Plans — für Ausdrucke, die
 * das Bild zeigen (PDF/PNG). Hier zählen Positionen mit: ein verschobenes Gerät
 * ist auf dem Blatt sichtbar anders. Viewport/Zoom zählen nicht, die stehen
 * nicht auf dem Papier.
 *
 * Ebenfalls auf dem Papier: die Häkchen der bereits gesteckten Ports — siehe
 * `visiblePortChecks` für die Abgrenzung, welche davon wirklich gezeichnet
 * werden.
 */
export const planFingerprint = (project: CablePlannerProject | RevisionSnapshot): string => {
  const equipment = (project.equipment ?? [])
    .map((e) => [e.id, e.name, e.x, e.y, e.width, e.height].join(SEP))
    .sort()
  const cables = (project.cables ?? [])
    .map((c) =>
      [
        c.id,
        c.fromEquipmentId,
        c.fromPortId,
        c.toEquipmentId,
        c.toPortId,
        c.type ?? '',
        c.length ?? '',
        c.name ?? '',
      ].join(SEP),
    )
    .sort()
  const locations = (project.locations ?? [])
    .map((l) => [l.id, l.name, l.x, l.y, l.width, l.height].join(SEP))
    .sort()
  const checks = visiblePortChecks(project)
  // Der Haken-Block wird nur angehaengt, wenn es Haken gibt. Sonst waere der
  // Fingerabdruck JEDES bestehenden Ausdrucks ein anderer (ein Trenner mehr)
  // — und jedes Blatt an jeder Wand meldete sich schlagartig als veraltet,
  // obwohl sich an der Zeichnung nichts geaendert hat. Neu ist der Wert genau
  // dort, wo der alte falsch war: in Plaenen mit Aufbaustand.
  return fingerprint(
    [
      equipment.join(ROW_SEP),
      cables.join(ROW_SEP),
      locations.join(ROW_SEP),
      ...(checks.length > 0 ? [checks.join(ROW_SEP)] : []),
    ].join(BLOCK_SEP),
  )
}

/** Die zuletzt festgeschriebene Revision, sonst undefined. */
export const latestRevision = (project: CablePlannerProject): ProjectRevision | undefined => {
  const list = project.revisions ?? []
  return list.length > 0 ? list[list.length - 1] : undefined
}

/**
 * Baut den Stempel. `current` ist der Fingerabdruck des Dokuments, wie es jetzt
 * aussieht; `atRevision` derselbe Fingerabdruck, berechnet auf dem Snapshot der
 * letzten Revision. Fehlt einer von beiden, gilt `drifted: false` — siehe
 * Regel 2 im Datei-Kopf.
 */
export const buildDocumentStamp = (
  project: CablePlannerProject,
  current: string,
  atRevision: string | undefined,
  now: Date,
): DocumentStamp => {
  const rev = latestRevision(project)
  return {
    project: project.metadata.name || '—',
    ...(rev ? { revision: project.metadata.revision || rev.label } : {}),
    drifted: !!rev && !!atRevision && atRevision !== current,
    printedAt: now.toISOString(),
    fingerprint: current,
  }
}

/**
 * Stempel für ein Zeilen-Dokument: berechnet beide Fingerabdrücke selbst, indem
 * es dieselbe Ableitung einmal auf den Plan und einmal auf den Revisions-
 * Snapshot anwendet. Das ist der Grund, warum die Builder in `installerLists`
 * pur sind und ein Projekt entgegennehmen.
 */
export const stampForRows = (
  project: CablePlannerProject,
  derive: (source: CablePlannerProject) => CsvTable,
  now: Date,
): DocumentStamp => {
  const current = derive(project)
  const rev = latestRevision(project)
  const atRevision = rev
    ? (() => {
        const snapshot = { ...rev.snapshot, revisions: [] } as CablePlannerProject
        const past = derive(snapshot)
        return documentFingerprint(past.headers, past.rows)
      })()
    : undefined
  return buildDocumentStamp(
    project,
    documentFingerprint(current.headers, current.rows),
    atRevision,
    now,
  )
}

/**
 * Stempel für einen Plan-Ausdruck (PDF/PNG). Vergleicht den Zeichnungs-Inhalt
 * gegen den Snapshot der letzten Revision — hier zählen Positionen mit, denn sie
 * sind auf dem Blatt sichtbar.
 */
export const stampForPlan = (project: CablePlannerProject, now: Date): DocumentStamp => {
  const rev = latestRevision(project)
  return buildDocumentStamp(
    project,
    planFingerprint(project),
    rev ? planFingerprint(rev.snapshot) : undefined,
    now,
  )
}

/** Datum/Uhrzeit kurz und lesbar (lokal), für die Fußzeile. */
const fmtStampDate = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Eine Zeile für Fußzeilen und Titelblöcke.
 *
 * Der Revisions-Teil ist der Punkt: steht nur „Rev 2" auf dem Blatt, liest sich
 * das als *dieser Ausdruck ist Rev 2*. Weicht der Plan ab, sagt der Stempel das
 * hin — sonst behauptet das Papier einen Stand, den es nicht hat.
 */
export const stampLine = (stamp: DocumentStamp): string => {
  const parts = [stamp.project]
  if (stamp.revision) parts.push(stamp.drifted ? `${stamp.revision} + Änderungen` : stamp.revision)
  parts.push(fmtStampDate(stamp.printedAt))
  parts.push(`#${stamp.fingerprint}`)
  return parts.join('  ·  ')
}

/**
 * Fußzeile für ein CSV: eine Zeile *nach* den Daten, mit `#` beginnend.
 *
 * Bewusst nicht davor: eine Zeile vor der Kopfzeile verschiebt jede Auswertung,
 * die die erste Zeile als Header liest. Hinten steht sie da, wo eine Fußzeile
 * hingehört — auf dem Ausdruck unten, und in Excel in der letzten Zeile.
 */
export const csvStampRow = (
  stamp: DocumentStamp,
  columns: number,
  docId?: string,
): CsvCell[] => {
  // ADR-004 Inkrement 3 — der Dokument-Code auf dem Listen-Ausdruck selbst.
  //
  // WARUM ALS TEXT UND NICHT ALS QR. Ein CSV kann kein Bild tragen, und ein
  // Listen-Ausdruck entsteht aus Excel — jeder QR, den wir hier erzeugten,
  // ueberlebte den Weg nicht. Der Code als Text ueberlebt ihn, ist abtippbar
  // und wird, wenn jemand das Blatt fotografiert, von derselben Suche
  // gefunden wie ein gescannter.
  //
  // WAS ER GEGENUEBER DEN ACHT ZEICHEN KANN. Die acht Zeichen allein sagen im
  // Mobile-Viewer entweder "aktueller Stand" oder "gehoert zu keinem aktuellen
  // Blatt". Der Code nennt zusaetzlich das DOKUMENT — und damit wird aus
  // "unbekannt" die brauchbare Antwort: "Pull-Liste: VERALTET, aktueller
  // Stand #xyz". Auf der Baustelle ist das der Unterschied zwischen "irgendwas
  // stimmt nicht" und "hol dir die neue Pull-Liste".
  //
  // `stampLine` bleibt unangetastet: sie ist das Format, das alle drei Planer
  // teilen, und `stamp:parity` in der Suite haelt sie Zeichen fuer Zeichen
  // gegeneinander. Der Code haengt hinten dran, wo er nur den cable-planner
  // betrifft -- die anderen beiden haben kein Dokument-Register.
  const zeile = docId
    ? `# ${stampLine(stamp)}  ·  ${buildDocQrPayload(docId, stamp.fingerprint, stamp.revision)}`
    : `# ${stampLine(stamp)}`
  const row: CsvCell[] = [zeile]
  while (row.length < Math.max(1, columns)) row.push('')
  return row
}

/**
 * Serialisiert eine Tabelle als CSV, haengt den Stempel als letzte Datenzeile
 * an und darunter das Spaltenlexikon (Bedarf 81).
 *
 * ─── WARUM DAS LEXIKON HIER HAENGT UND NICHT AN JEDEM AUFRUFER ─────────────
 *
 * Weil es sonst genau dort fehlte, wo es gebraucht wird. Diese Funktion ist
 * die Engstelle, durch die JEDER CSV-Export dieser Anwendung geht; ein
 * Lexikon, das der Aufrufer anhaengen MUSS, waere an dem einen Blatt vergessen
 * worden, das der Kunde bekommt. Der Bedarf sagt „alongside EVERY export", und
 * das ist hier woertlich zu nehmen.
 *
 * `dictionary: false` gibt es fuer den Fall, dass eine Ausgabe maschinell
 * weiterverarbeitet wird und ein Anhang sie zerlegen wuerde. Heute nutzt das
 * niemand — der Schalter steht hier, damit ein solcher Fall ihn nennen muss,
 * statt die Engstelle zu umgehen.
 *
 * DER STAND AENDERT SICH DADURCH NICHT: `documentFingerprint` rechnet ueber
 * `headers`/`rows`, nicht ueber die exportierten Bytes. Ein Lexikon, das den
 * Fingerabdruck veraenderte, meldete jedes gedruckte Exemplar als veraltet.
 */
export const csvFromTable = (
  table: CsvTable,
  stamp?: DocumentStamp,
  docId?: string,
  opts: { dictionary?: boolean } = {},
): string => {
  const lexikon =
    opts.dictionary === false ? [] : dictionaryBlock(table.headers, table.headers.length)
  // Das Lexikon steht ZWISCHEN Daten und Stempel, nicht dahinter. Der Stempel
  // bleibt damit die letzte Zeile der Datei — eine Zusicherung, die es seit
  // ADR-004 gibt und an der der Mobile-Viewer und die Fussnoten-Pruefung
  // haengen. Ein Anhang gehoert vor die Fussnote, nicht hinter sie.
  const rows: CsvCell[][] = [...table.rows, ...lexikon]
  if (stamp) rows.push(csvStampRow(stamp, table.headers.length, docId))
  return toCsv(table.headers, rows)
}
