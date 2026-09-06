// ───────────────────────────────────────────────────────────────────────────
// Wer trägt heute welche Strecke (Bedarf 114, P3).
//
// Die Begründung für den Gegenstand steht in `types/micAssignment.ts`. Hier
// stehen die Ableitungen — und alle sind rein: keine Uhr, kein Store, kein IO.
// Der Stichtag kommt von aussen, wie bei `packList` und `documentStamp`.
//
// ─── DREI SACHEN, DIE DIESES MODUL NICHT TUT ───────────────────────────────
//
//   * Es rechnet KEINE Akku-Restlaufzeit. Der Plan weiss, wann ein Akku
//     eingelegt wurde; wie lange er noch hält, hängt an Typ, Alter,
//     Sendeleistung und Temperatur, und keine dieser Angaben steht hier. Eine
//     Restzeit auszurechnen hiesse, eine Zahl zu erfinden, auf die sich jemand
//     im Saal verlässt. Ausgegeben wird die verstrichene Zeit — die ist
//     nachprüfbar.
//   * Es holt KEIN Bild. `photoRef` ist ein Verweis; ob er auflösbar ist,
//     entscheidet die Oberfläche, und wo keiner steht, trägt die Karte eine
//     benannte Leerstelle.
//   * Es ändert NICHTS. `carryForward` liefert Vorschläge; sie zu übernehmen
//     ist ein Klick, kein Nebeneffekt des Öffnens.
// ───────────────────────────────────────────────────────────────────────────

import type { MicAssignment, MicPlot, MicSession, Performer } from '../types/micAssignment'
import { NO_BATTERY_TIME, NO_PERFORMER_NAME, NO_PHOTO, ORIGIN_LABEL } from '../types/micAssignment'
import type { WirelessChannel, WirelessRigPlan } from '../types/wirelessRig'
import type { CsvCell, CsvTable } from './csv'

/**
 * Wie eine Person auf einem Blatt heisst.
 *
 * Name, sonst Funktion, sonst `ohne Namen`. Die Reihenfolge ist Absicht: wer
 * nur die Funktion pflegt („Pfarrer"), hat keinen Personennamen im Projekt,
 * und das Blatt funktioniert trotzdem.
 */
export function performerLabel(p: Performer | undefined): string {
  const name = p?.name?.trim()
  if (name) return name
  const role = p?.role?.trim()
  if (role) return role
  return NO_PERFORMER_NAME
}

/** Die Zuordnungen einer Session. */
export function assignmentsOf(plot: MicPlot, sessionId: string): MicAssignment[] {
  return plot.assignments.filter((a) => a.sessionId === sessionId)
}

/**
 * Wie lange der Akku schon drin ist, in vollen Minuten.
 *
 * `null` heisst „nicht festgehalten" — und das ist eine Antwort, keine Null.
 * Ein Zeitstempel in der Zukunft (falsch getippt) ergibt ebenfalls `null`:
 * eine negative Laufzeit auszugeben wäre schlimmer als keine.
 */
export function batteryMinutes(a: MicAssignment, now: string): number | null {
  if (!a.batteryFittedAt) return null
  const t0 = Date.parse(a.batteryFittedAt)
  const t1 = Date.parse(now)
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null
  if (t1 < t0) return null
  return Math.floor((t1 - t0) / 60000)
}

export function batteryText(a: MicAssignment, now: string): string {
  const m = batteryMinutes(a, now)
  if (m === null) return NO_BATTERY_TIME
  if (m < 60) return `seit ${m} min`
  return `seit ${Math.floor(m / 60)} h ${m % 60} min`
}

// ── Die A2-Karte ───────────────────────────────────────────────────────────

export interface A2Card {
  performer: string
  role: string
  photo: string
  channelLabel: string
  frequency: string
  pack: string
  capsule: string
  battery: string
  origin: string
  notes: string
}

/**
 * Die Karte für eine Person in einer Session — die Sicht, die der Beleg
 * „the A2 card" nennt.
 *
 * Alles darauf kommt aus dem Plan; nichts wird geraten. Wo eine Angabe fehlt,
 * steht ein benanntes Ergebnis, keine leere Zelle: eine Karte mit Lücken ist
 * eine Auskunft, eine Karte mit leeren Feldern sieht aus wie ein Fehler.
 */
export function a2Card(
  plot: MicPlot,
  rig: WirelessRigPlan | undefined,
  sessionId: string,
  performerId: string,
  now: string,
  packLabelOf: (unitId: string) => string,
): A2Card | null {
  const p = plot.performers.find((x) => x.id === performerId)
  const a = plot.assignments.find((x) => x.sessionId === sessionId && x.performerId === performerId)
  if (!p || !a) return null
  const ch: WirelessChannel | undefined = rig?.channels.find((c) => c.id === a.channelId)
  return {
    performer: performerLabel(p),
    role: p.role?.trim() || '',
    photo: p.photoRef?.trim() || NO_PHOTO,
    channelLabel: ch?.label?.trim() || 'Kanal entfernt',
    frequency: ch?.frequencyMhz === undefined ? 'nicht belegt' : `${ch.frequencyMhz} MHz`,
    pack: a.packUnitId ? packLabelOf(a.packUnitId) : 'nicht benannt',
    capsule: a.capsuleNote?.trim() || 'wie im Kanalplan',
    battery: batteryText(a, now),
    origin: ORIGIN_LABEL[a.origin],
    notes: a.notes?.trim() || '',
  }
}

/** Das Blatt für eine ganze Session — die Liste, die am Case hängt. */
export function sessionTable(
  plot: MicPlot,
  rig: WirelessRigPlan | undefined,
  sessionId: string,
  now: string,
  packLabelOf: (unitId: string) => string,
): CsvTable {
  const rows = assignmentsOf(plot, sessionId)
    .map((a) => a2Card(plot, rig, sessionId, a.performerId, now, packLabelOf))
    .filter((c): c is A2Card => c !== null)
    .sort((a, b) => a.channelLabel.localeCompare(b.channelLabel, 'de', { numeric: true }))
  return {
    // „Sender" allein ist im Spaltenlexikon schon vergeben — dort ist es das
    // sendende Dante-Gerät. Zwei Bedeutungen unter einer Überschrift machen die
    // Erklärung wertlos.
    headers: ['Kanal', 'Frequenz', 'Person', 'Funktion', 'Sender (Einheit)', 'Kapsel', 'Akku', 'Herkunft'],
    rows: rows.map((c): CsvCell[] => [
      c.channelLabel,
      c.frequency,
      c.performer,
      c.role,
      c.pack,
      c.capsule,
      c.battery,
      c.origin,
    ]),
  }
}

// ── Befunde ────────────────────────────────────────────────────────────────

export type MicFindingKind =
  | 'channel-double-booked'
  | 'pack-double-booked'
  | 'performer-twice'
  | 'channel-missing'
  | 'battery-unrecorded'
  | 'carried-unconfirmed'

export const MIC_FINDING_LABEL: Readonly<Record<MicFindingKind, string>> = {
  'channel-double-booked': 'Zwei Personen auf demselben Kanal',
  'pack-double-booked': 'Ein Sender an zwei Personen',
  'performer-twice': 'Eine Person auf zwei Kanälen',
  'channel-missing': 'Kanal steht nicht mehr im Rig-Plan',
  'battery-unrecorded': 'Akku-Wechsel nicht festgehalten',
  'carried-unconfirmed': 'Übernommen und nicht bestätigt',
}

export interface MicFinding {
  kind: MicFindingKind
  text: string
  performerIds: string[]
}

/**
 * Was an den Zuordnungen einer Session nicht stimmt.
 *
 * `channel-double-booked` und `pack-double-booked` sind physisch unmöglich und
 * deshalb aussagekräftig: zwei Sender auf derselben Frequenz löschen einander
 * aus, und ein Sender kann nicht an zwei Körpern hängen. Beides fällt sonst
 * erst auf, wenn jemand spricht.
 */
export function micFindings(
  plot: MicPlot,
  rig: WirelessRigPlan | undefined,
  sessionId: string,
): MicFinding[] {
  const rows = assignmentsOf(plot, sessionId)
  const name = (id: string) => performerLabel(plot.performers.find((p) => p.id === id))
  const out: MicFinding[] = []

  const gruppiere = <K extends string>(schluessel: (a: MicAssignment) => K | undefined) => {
    const m = new Map<K, MicAssignment[]>()
    for (const a of rows) {
      const k = schluessel(a)
      if (!k) continue
      m.set(k, [...(m.get(k) ?? []), a])
    }
    return m
  }

  for (const [ch, gruppe] of gruppiere((a) => a.channelId)) {
    if (gruppe.length < 2) continue
    const kanal = rig?.channels.find((c) => c.id === ch)
    out.push({
      kind: 'channel-double-booked',
      performerIds: gruppe.map((a) => a.performerId),
      text: `${gruppe.map((a) => name(a.performerId)).join(', ')} stehen auf „${kanal?.label ?? ch}". Zwei Sender auf derselben Frequenz löschen einander aus — das fällt auf, wenn jemand spricht.`,
    })
  }

  for (const [pack, gruppe] of gruppiere((a) => a.packUnitId)) {
    if (gruppe.length < 2) continue
    out.push({
      kind: 'pack-double-booked',
      performerIds: gruppe.map((a) => a.performerId),
      text: `Sender ${pack} ist ${gruppe.length} Personen zugeordnet. Ein Sender hängt an einem Körper; einer der beiden steht ohne da.`,
    })
  }

  for (const [pid, gruppe] of gruppiere((a) => a.performerId)) {
    if (gruppe.length < 2) continue
    out.push({
      kind: 'performer-twice',
      performerIds: [pid],
      text: `${name(pid)} trägt ${gruppe.length} Strecken. Das kann stimmen (Headset und Handsender), ist aber öfter ein Rest aus der vorigen Session.`,
    })
  }

  const fehlend = rows.filter((a) => rig && !rig.channels.some((c) => c.id === a.channelId))
  if (fehlend.length > 0) {
    out.push({
      kind: 'channel-missing',
      performerIds: fehlend.map((a) => a.performerId),
      text: `${fehlend.length} Zuordnung(en) zeigen auf einen Kanal, den der Rig-Plan nicht mehr führt. Auf der Karte steht dann „Kanal entfernt" statt einer Frequenz.`,
    })
  }

  const ohneAkku = rows.filter((a) => !a.batteryFittedAt)
  if (ohneAkku.length > 0) {
    out.push({
      kind: 'battery-unrecorded',
      performerIds: ohneAkku.map((a) => a.performerId),
      text: `Bei ${ohneAkku.length} Strecke(n) steht nicht, wann der Akku eingelegt wurde. Die Karte sagt „${NO_BATTERY_TIME}" — sie behauptet keine Restlaufzeit, die niemand kennt.`,
    })
  }

  const uebernommen = rows.filter((a) => a.origin === 'carried')
  if (uebernommen.length > 0) {
    out.push({
      kind: 'carried-unconfirmed',
      performerIds: uebernommen.map((a) => a.performerId),
      text: `${uebernommen.length} Zuordnung(en) stammen aus der vorigen Session und sind für heute nicht bestätigt. Sie sparen das Neuschreiben; eine Vermutung über heute bleiben sie trotzdem.`,
    })
  }

  return out
}

// ── Die Arbeit, die der Beleg beschreibt ───────────────────────────────────

/**
 * Die Zuordnungen der vorigen Session als Vorschlag für die nächste.
 *
 * Das ist der eigentliche Punkt des Bedarfs — „has to be redone for every
 * session of a run". Übernommen wird, was übernehmbar ist; jede Zeile trägt
 * `origin: 'carried'` und damit die Aussage, dass sie eine Vermutung über
 * heute ist.
 *
 * NICHT übernommen wird der Akku-Zeitpunkt: der Akku von gestern ist der
 * einzige Wert auf der Karte, der mit Sicherheit falsch ist.
 *
 * Ändert nichts — der Aufrufer entscheidet, ob er die Vorschläge übernimmt.
 */
export function carryForward(
  plot: MicPlot,
  fromSessionId: string,
  toSessionId: string,
): MicAssignment[] {
  const schonDa = new Set(
    assignmentsOf(plot, toSessionId).map((a) => `${a.performerId}|${a.channelId}`),
  )
  return assignmentsOf(plot, fromSessionId)
    .filter((a) => !schonDa.has(`${a.performerId}|${a.channelId}`))
    .map((a) => {
      const neu: MicAssignment = {
        sessionId: toSessionId,
        performerId: a.performerId,
        channelId: a.channelId,
        origin: 'carried',
      }
      if (a.packUnitId) neu.packUnitId = a.packUnitId
      if (a.capsuleNote) neu.capsuleNote = a.capsuleNote
      if (a.notes) neu.notes = a.notes
      return neu
    })
}

/** Sessions in Datums-Reihenfolge; solche ohne Datum ans Ende. */
export function sessionsInOrder(plot: MicPlot): MicSession[] {
  return plot.sessions.slice().sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date)
    if (a.date) return -1
    if (b.date) return 1
    return (a.label ?? '').localeCompare(b.label ?? '', 'de')
  })
}

/** Die Session vor dieser — die Quelle für `carryForward`. */
export function previousSession(plot: MicPlot, sessionId: string): MicSession | undefined {
  const reihe = sessionsInOrder(plot)
  const i = reihe.findIndex((s) => s.id === sessionId)
  return i > 0 ? reihe[i - 1] : undefined
}

/** Normalisiert einen geladenen Plan (Schema-Migration für alte Projekte). */
export function normaliseMicPlot(raw: unknown): MicPlot {
  if (!raw || typeof raw !== 'object') return { performers: [], sessions: [], assignments: [] }
  const r = raw as Partial<MicPlot>
  const performers = Array.isArray(r.performers)
    ? r.performers.filter((p): p is Performer => !!p && typeof p.id === 'string')
    : []
  const sessions = Array.isArray(r.sessions)
    ? r.sessions.filter((s): s is MicSession => !!s && typeof s.id === 'string')
    : []
  const assignments = Array.isArray(r.assignments)
    ? r.assignments
        .filter(
          (a): a is MicAssignment =>
            !!a &&
            typeof a.sessionId === 'string' &&
            typeof a.performerId === 'string' &&
            typeof a.channelId === 'string',
        )
        // Eine Zuordnung ohne Herkunft ist aelter als das Feld. Sie gilt als
        // von Hand gesetzt: „uebernommen" waere eine Behauptung ueber eine
        // Session, die niemand mehr kennt.
        .map((a): MicAssignment => ({ ...a, origin: a.origin === 'carried' ? 'carried' : 'manual' }))
    : []
  return { performers, sessions, assignments }
}
