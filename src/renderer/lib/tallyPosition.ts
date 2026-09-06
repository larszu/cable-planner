// ───────────────────────────────────────────────────────────────────────────
// Das Tally je Position: Weg, Lampe, und was jemand gesehen hat
// (Bedarf 105, P3).
//
//   > Tally is trusted until it lies; software tally over NDI/TSL misreports,
//   > blinks, or needs port workarounds […]
//
// Die Antwort der Bedarfs-Datenbank ist wörtlich: „Record tally
// source/protocol/address per position, include it in the PRE-SHOW CHECKLIST,
// and generate the tally mapping from the same source-name table used for
// MV/UMD so a renumber cannot desync it."
//
// Der letzte Teil steht seit Initiative 2 (`lib/tallyMap.ts` leitet aus
// denselben Rollen ab, aus denen MV und UMD kommen). Hier kommen die beiden
// ersten dazu — und mit ihnen die Regel, die den Bedarf trägt:
//
//   EIN TALLY GILT ERST ALS GEPRÜFT, WENN JEMAND HINGESEHEN HAT.
//
// `tallyVerdict` ist die Engstelle dafür. Sie gibt nie „in Ordnung" zurück,
// weil eine Adresse eingetragen ist; sie liest die letzte Beobachtung. Ohne
// Beobachtung heisst die Antwort `unchecked`, und die steht so auf dem Blatt.
//
// ─── WAS ALS LÜGE ZÄHLT ────────────────────────────────────────────────────
//
// Beide Belege beschreiben nicht „Lampe aus", sondern „Lampe sagt etwas
// Falsches", und das ist der gefährlichere Fehler: aus ist sichtbar, falsch
// nicht. Deshalb ist `lying` ein eigenes Urteil neben `dark`:
//
//   * ROT auf VORSCHAU — der Fall aus `DistroAV#318`. Der Operator glaubt,
//     er sei auf Sendung.
//   * BLINKEN auf Programm — die BirdDog PF120. Die Lampe ist da und nicht
//     lesbar.
//   * Eine Lampe an der FALSCHEN POSITION — das Tally kommt an, nur woanders.
//
// REIN: keine Uhr, kein Store, kein IO. Der Zeitpunkt einer Prüfung kommt
// vom Aufrufer — dieselbe Regel wie bei `faultHistory` und `storageMoves`.
// ───────────────────────────────────────────────────────────────────────────

import type { SourceIdentity } from '../types/sourceIdentity'
import {
  NOT_CHECKED,
  NO_ENDPOINT,
  NO_LAMP,
  TALLY_OBSERVATION_LABEL,
  TALLY_TRANSPORT_LABEL,
  type TallyCheck,
  type TallyObservation,
  type TallyPosition,
  type TallyTransport,
} from '../types/tallyPosition'
import type { CsvTable } from './csv'

/** Das Urteil über EINE Position. */
export type TallyVerdict =
  /** Zuletzt gesehen: rot auf Programm, nicht-rot auf Vorschau. */
  | 'verified'
  /** Zuletzt gesehen: etwas Falsches. Der gefährliche Fall. */
  | 'lying'
  /** Zuletzt gesehen: nichts. Die Lampe blieb aus. */
  | 'dark'
  /** Nie hingesehen. KEIN Urteil — und das ist der Punkt. */
  | 'unchecked'

export const TALLY_VERDICT_LABEL: Readonly<Record<TallyVerdict, string>> = {
  verified: 'gesehen und richtig',
  lying: 'zeigt etwas Falsches',
  dark: 'bleibt dunkel',
  unchecked: NOT_CHECKED,
}

/** Prüfungen einer Position, jüngste zuerst. */
export const checksOf = (position: TallyPosition | undefined): TallyCheck[] =>
  [...(position?.checks ?? [])].sort((a, b) => b.at.localeCompare(a.at))

export const lastCheck = (position: TallyPosition | undefined): TallyCheck | undefined =>
  checksOf(position)[0]

/**
 * Die Engstelle: was diese Position zuletzt WIRKLICH gezeigt hat.
 *
 * Bewusst nicht aus `transport`/`endpoint` ableitbar. Eine eingetragene
 * Adresse ist eine Absicht, keine Beobachtung — und genau die Verwechslung
 * beschreibt der Beleg: „tally is trusted until it lies".
 */
export function tallyVerdict(position: TallyPosition | undefined): TallyVerdict {
  const check = lastCheck(position)
  if (!check) return 'unchecked'

  // Zuerst die Lüge — sie schlägt alles andere. Eine Position, die auf
  // Vorschau rot zeigt, ist nicht „teilweise in Ordnung", weil das
  // Programm-Tally stimmt: der Operator sieht rot und glaubt, er sei on air.
  const luegt =
    check.onPreview === 'red' ||
    check.onProgram === 'green' ||
    check.onProgram === 'blinking' ||
    check.onPreview === 'blinking' ||
    check.onProgram === 'wrong-colour' ||
    check.onPreview === 'wrong-colour' ||
    check.onProgram === 'wrong-position' ||
    check.onPreview === 'wrong-position'
  if (luegt) return 'lying'

  if (check.onProgram === 'off') return 'dark'

  // `verified` verlangt BEIDE Hälften. Eine Prüfung, die nur das Programm
  // gesehen hat, findet den Fehler aus `DistroAV#318` nicht — der sitzt in
  // der VORSCHAU: dort leuchtet rot, obwohl die Kamera nie auf Sendung war.
  // Wer eine halbe Prüfung „in Ordnung" nennt, hat genau die Hälfte
  // weggelassen, um die es geht. (Die Gegenprobe hat das gefunden: bis
  // hierher genügte `onProgram === 'red'`.)
  if (check.onProgram === 'red' && check.onPreview !== 'not-checked') return 'verified'

  // Alles Übrige — gar nicht hingesehen, oder nur halb. Kein Urteil, und die
  // Unterscheidung zwischen beidem macht `tallyPositionFindings`: sie ist für
  // den Bedienenden eine andere Aufgabe („hinsehen" gegen „zu Ende sehen").
  return 'unchecked'
}

export type TallyPositionFindingKind =
  /** Nie geprüft. */
  | 'unchecked'
  /** Eine Hälfte gesehen, die andere nicht. */
  | 'half-checked'
  /** Zeigt etwas Falsches. */
  | 'lying'
  /** Bleibt dunkel. */
  | 'dark'
  /** Kein Transport festgelegt. */
  | 'no-transport'
  /** Transport festgelegt, aber keine Adresse. */
  | 'no-endpoint'
  /** NDI als Weg — der Beleg nennt ihn ausdrücklich als unzuverlässig. */
  | 'ndi-preview-warning'
  /** Rolle ohne jeden Tally-Datensatz. */
  | 'no-position'

export interface TallyPositionFinding {
  kind: TallyPositionFindingKind
  severity: 'error' | 'warning'
  /** Rolle, um die es geht — als Klick-/Sortierschlüssel. */
  subject: string
  message: string
}

const positionByIdentity = (
  positions: readonly TallyPosition[],
): Map<string, TallyPosition> => new Map(positions.map((p) => [p.identityId, p]))

/**
 * Befunde je Position.
 *
 * Wie in `tallyMap.ts` bleiben sie HIER und wandern nicht in
 * `runDrawingChecks`: „Tally nicht geprüft" ist nur dann ein Mangel, wenn die
 * Produktion überhaupt Tally fährt, und ein Check, der bei jedem Plan meckert,
 * wird weggeklickt statt gelesen.
 */
export function tallyPositionFindings(
  identities: readonly SourceIdentity[],
  positions: readonly TallyPosition[],
): TallyPositionFinding[] {
  const byId = positionByIdentity(positions)
  const out: TallyPositionFinding[] = []

  for (const role of identities) {
    const pos = byId.get(role.id)
    if (!pos) {
      out.push({
        kind: 'no-position',
        severity: 'warning',
        subject: role.name,
        message: `Für "${role.name}" ist kein Tally-Weg hinterlegt.`,
      })
      continue
    }

    if (pos.transport === 'unknown') {
      out.push({
        kind: 'no-transport',
        severity: 'warning',
        subject: role.name,
        message: `"${role.name}": Tally-Weg nicht festgelegt.`,
      })
    } else if (!pos.endpoint?.trim()) {
      out.push({
        kind: 'no-endpoint',
        severity: 'warning',
        subject: role.name,
        message:
          `"${role.name}": ${TALLY_TRANSPORT_LABEL[pos.transport]} ohne Adresse — ` +
          'auf dem Blatt steht dann kein Wert, den jemand am Gerät nachsehen kann.',
      })
    }

    // Der belegte Sonderfall: NDI meldet ein Vorschau-Tally schon, weil die
    // Quelle in einem Multiview auftaucht (`DistroAV#318`). Das ist kein
    // Fehler DIESES Plans, aber es ist der Grund, hier hinzusehen — deshalb
    // Warnung mit Beleg statt stillschweigen.
    if (pos.transport === 'ndi') {
      out.push({
        kind: 'ndi-preview-warning',
        severity: 'warning',
        subject: role.name,
        message:
          `"${role.name}" hängt am NDI-Tally: dort kann schon ein Multiview ein ` +
          'Vorschau-Tally auslösen (DistroAV#318). Vorschau getrennt prüfen.',
      })
    }

    const verdict = tallyVerdict(pos)
    if (verdict === 'lying') {
      const c = lastCheck(pos)
      out.push({
        kind: 'lying',
        severity: 'error',
        subject: role.name,
        message:
          `"${role.name}" zeigte bei der letzten Prüfung etwas Falsches ` +
          `(Programm: ${TALLY_OBSERVATION_LABEL[c?.onProgram ?? 'not-checked']}, ` +
          `Vorschau: ${TALLY_OBSERVATION_LABEL[c?.onPreview ?? 'not-checked']}).`,
      })
    } else if (verdict === 'dark') {
      out.push({
        kind: 'dark',
        severity: 'error',
        subject: role.name,
        message: `"${role.name}" blieb bei der letzten Prüfung dunkel.`,
      })
    } else if (verdict === 'unchecked') {
      const c = lastCheck(pos)
      const halb =
        c && (c.onProgram !== 'not-checked' || c.onPreview !== 'not-checked')
          ? c.onPreview === 'not-checked'
            ? 'Vorschau'
            : 'Programm'
          : undefined
      out.push(
        halb
          ? {
              kind: 'half-checked',
              severity: 'warning',
              subject: role.name,
              message:
                `"${role.name}": nur halb geprüft — die ${halb} fehlt. ` +
                (halb === 'Vorschau'
                  ? 'Genau dort sitzt der Fehler aus DistroAV#318: rot, obwohl nie auf Sendung.'
                  : 'Ohne das Programm-Tally ist die Hauptrichtung ungeprüft.'),
            }
          : {
              kind: 'unchecked',
              severity: 'warning',
              subject: role.name,
              message: `"${role.name}": ${NOT_CHECKED}.`,
            },
      )
    }
  }
  return out
}

/**
 * Baut den Datensatz einer Prüfung.
 *
 * Leere Angaben fallen weg, statt als leerer String mitzufahren: ein
 * JSON-Roundtrip macht aus `undefined` nichts, aus `''` aber eine leere Zelle,
 * und die liest sich wie eine Antwort.
 */
export function buildTallyCheck(
  at: string,
  onProgram: TallyObservation,
  onPreview: TallyObservation,
  by?: string,
  note?: string,
): TallyCheck {
  return {
    at,
    onProgram,
    onPreview,
    ...(by?.trim() ? { by: by.trim() } : {}),
    ...(note?.trim() ? { note: note.trim() } : {}),
  }
}

export const PRE_SHOW_HEADERS = [
  'Position',
  'Weg',
  'Adresse',
  'Lampe',
  'Programm',
  'Vorschau',
  'Geprüft am',
  'Urteil',
] as const

const datum = (at: string | undefined): string => (at ? at.slice(0, 10) : NOT_CHECKED)

/**
 * Die Vor-Show-Liste — das Blatt, das der Bedarf wörtlich verlangt.
 *
 * Sie führt JEDE Rolle, auch die ohne Datensatz. Eine Checkliste, die nur
 * zeigt, was schon eingetragen ist, hakt genau die Positionen nicht ab, an
 * denen niemand war.
 */
export function preShowTallyTable(
  identities: readonly SourceIdentity[],
  positions: readonly TallyPosition[],
): CsvTable {
  const byId = positionByIdentity(positions)
  return {
    headers: [...PRE_SHOW_HEADERS],
    rows: identities.map((role) => {
      const pos = byId.get(role.id)
      const check = lastCheck(pos)
      return [
        role.name,
        TALLY_TRANSPORT_LABEL[pos?.transport ?? 'unknown'],
        pos?.endpoint?.trim() || NO_ENDPOINT,
        pos?.lamp?.trim() || NO_LAMP,
        TALLY_OBSERVATION_LABEL[check?.onProgram ?? 'not-checked'],
        TALLY_OBSERVATION_LABEL[check?.onPreview ?? 'not-checked'],
        datum(check?.at),
        TALLY_VERDICT_LABEL[tallyVerdict(pos)],
      ]
    }),
  }
}

/** Normalisiert einen geladenen Datensatz — die Schema-Migrationsschicht. */
export function normaliseTallyPositions(raw: unknown): TallyPosition[] {
  if (!Array.isArray(raw)) return []
  const gueltigeWege: readonly TallyTransport[] = [
    'tsl-umd-v31',
    'gpio',
    'ndi',
    'switcher-native',
    'unknown',
  ]
  const gueltigeBeobachtungen: readonly TallyObservation[] = [
    'red',
    'green',
    'off',
    'blinking',
    'wrong-colour',
    'wrong-position',
    'not-checked',
  ]
  const out: TallyPosition[] = []
  const gesehen = new Set<string>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const r = entry as Record<string, unknown>
    const identityId = typeof r.identityId === 'string' ? r.identityId.trim() : ''
    // Ein Datensatz ohne Rolle zeigt ins Leere. Zwei fuer dieselbe Rolle sind
    // zwei Wahrheiten — die erste gewinnt, wie bei `normaliseSourceIdentities`.
    if (!identityId || gesehen.has(identityId)) continue
    gesehen.add(identityId)
    const transport = gueltigeWege.includes(r.transport as TallyTransport)
      ? (r.transport as TallyTransport)
      : 'unknown'
    const checks = Array.isArray(r.checks)
      ? r.checks
          .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
          .filter((c) => typeof c.at === 'string' && c.at.trim() !== '')
          .map((c) =>
            buildTallyCheck(
              String(c.at),
              gueltigeBeobachtungen.includes(c.onProgram as TallyObservation)
                ? (c.onProgram as TallyObservation)
                : 'not-checked',
              gueltigeBeobachtungen.includes(c.onPreview as TallyObservation)
                ? (c.onPreview as TallyObservation)
                : 'not-checked',
              typeof c.by === 'string' ? c.by : undefined,
              typeof c.note === 'string' ? c.note : undefined,
            ),
          )
      : []
    const pos: TallyPosition = { identityId, transport }
    if (typeof r.endpoint === 'string' && r.endpoint.trim()) pos.endpoint = r.endpoint.trim()
    if (typeof r.lamp === 'string' && r.lamp.trim()) pos.lamp = r.lamp.trim()
    if (checks.length) pos.checks = checks
    out.push(pos)
  }
  return out
}
