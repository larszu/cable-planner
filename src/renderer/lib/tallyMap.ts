// ───────────────────────────────────────────────────────────────────────────
// Roadmap-Initiative 2 — die Tally-Karte aus dem Plan.
//
// Der Befund des Tally-Dossiers ist knapp: „Nobody plans tally — they only
// run it." Adress-Zuordnung ist ueberall Handarbeit, und die woertliche
// Forderung aus dem Segment lautet: *one authoritative, validated, exportable
// camera-to-input-to-tally-address-to-lamp map*.
//
// Drei der vier Glieder dieser Kette hat der Plan seit ADR-001:
//   Kamera  → die Rolle (`SourceIdentity`)
//   Input   → abgeleitet aus dem Kabelgraph (`labelDerivation`)
//   Adresse → der persistierte Anker (`umdAddress`)
// Das vierte, die LAMPE, hat er nicht: welcher GPIO-Pin welcher Tally-Box
// diese Quelle anzeigt, ist eine Verdrahtungs-Entscheidung an der Hardware.
// Dieses Modul erfindet sie nicht, es nennt sie beim Namen.
//
// Deshalb liefert `toTallyPiDevices` genau die Felder, die der Plan besitzt
// (`id`, `name`, `input`) und laesst `out_gpio`, `out_trigger` und `me` weg,
// statt Vorgaben zu erfinden: `gpio_watcher.py` setzt fuer `me` selbst die 1
// ein, und eine erfundene Pin-Nummer waere schlimmer als ein fehlendes Feld —
// sie sieht aus wie eine Zusage und schaltet die falsche Lampe.
//
// Reine Funktionen ueber Plandaten: kein Store, kein React, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { SourceIdentity } from '../types/sourceIdentity'
import { deriveLabels } from './labelDerivation'
import { umdAddressClashes } from './sourceIdentity'
import { toCsv } from './csv'

export interface TallyMapDevice {
  id: string
  name: string
}

export interface TallyMapSwitcher {
  equipmentId: string
  name: string
  /** 1-basierte Eingangsnummer — darueber adressiert der Mischer das Tally. */
  input: number
}

export interface TallyMapRow {
  identityId: string
  name: string
  number?: number
  umdAddress?: number
  /** Geraete, die die Rolle realisieren (Haupt-/Backup-Paar sind zwei). */
  devices: TallyMapDevice[]
  /** Wo die Rolle am Mischer ankommt. Fehlt, wenn nichts verkabelt ist. */
  switcher?: TallyMapSwitcher
}

export type TallyIssueKind =
  | 'no-device'
  | 'no-switcher-input'
  | 'no-umd-address'
  | 'duplicate-address'
  | 'source-without-role'

export interface TallyIssue {
  kind: TallyIssueKind
  severity: 'error' | 'warning'
  /** Rolle oder Geraet, um das es geht — als Klick-/Sortierschluessel. */
  subject: string
  message: string
}

export interface TallyMap {
  rows: TallyMapRow[]
  issues: TallyIssue[]
}

type TallyProject = Pick<
  CablePlannerProject,
  'equipment' | 'cables' | 'sourceIdentities'
>

/**
 * Baut die Karte und prueft sie in einem Durchgang.
 *
 * Die Befunde bleiben BEWUSST hier und wandern nicht in `runDrawingChecks`:
 * „Rolle ohne UMD-Adresse" ist nur dann ein Mangel, wenn die Produktion
 * ueberhaupt Tally faehrt. Im globalen Plan-Check waere es Laerm fuer jeden,
 * der es nicht tut — und ein Check, der bei jedem Plan meckert, wird
 * weggeklickt statt gelesen.
 */
export const buildTallyMap = (project: TallyProject): TallyMap => {
  const identities: SourceIdentity[] = project.sourceIdentities ?? []
  const { sources } = deriveLabels({
    equipment: project.equipment,
    cables: project.cables,
    sourceIdentities: identities,
  })
  const eqById = new Map(project.equipment.map((e) => [e.id, e]))
  const rows: TallyMapRow[] = []
  const issues: TallyIssue[] = []

  for (const identity of identities) {
    const devices = project.equipment.filter((e) => e.sourceIdentityId === identity.id)
    // Der erste Treffer gewinnt: bei einem Haupt-/Backup-Paar haengen beide
    // Geraete an derselben Rolle, und das Tally folgt dem, was am Mischer
    // ankommt — nicht dem Blech.
    const link = sources.find((s) => devices.some((d) => d.id === s.sourceEquipmentId))
    const sink = link ? eqById.get(link.sinkEquipmentId) : undefined

    const row: TallyMapRow = {
      identityId: identity.id,
      name: identity.name,
      devices: devices.map((d) => ({ id: d.id, name: d.name })),
    }
    if (identity.number !== undefined) row.number = identity.number
    if (identity.umdAddress !== undefined) row.umdAddress = identity.umdAddress
    if (link && sink) {
      row.switcher = { equipmentId: sink.id, name: sink.name, input: link.inputIndex }
    }
    rows.push(row)

    if (devices.length === 0) {
      issues.push({
        kind: 'no-device',
        severity: 'warning',
        subject: identity.id,
        message: `Rolle "${identity.name}" ist an kein Geraet gebunden — es gibt nichts, dessen Tally geschaltet wuerde.`,
      })
    } else if (!row.switcher) {
      issues.push({
        kind: 'no-switcher-input',
        severity: 'warning',
        subject: identity.id,
        message: `Rolle "${identity.name}" erreicht keinen Mischer-Eingang — ohne Eingang gibt es kein Tally-Signal.`,
      })
    }
    if (identity.umdAddress === undefined) {
      issues.push({
        kind: 'no-umd-address',
        severity: 'warning',
        subject: identity.id,
        message: `Rolle "${identity.name}" hat keine UMD-Adresse — das Display bleibt leer.`,
      })
    }
  }

  for (const clash of umdAddressClashes(identities)) {
    issues.push({
      kind: 'duplicate-address',
      severity: 'error',
      subject: String(clash.address),
      message: `UMD-Adresse ${clash.address} ist doppelt vergeben: ${clash.identities
        .map((i) => `"${i.name}"`)
        .join(', ')}. Beide Displays zeigen denselben Text.`,
    })
  }

  // Quellen, die am Mischer ankommen, aber keine Rolle tragen: fuer die kann
  // die Karte nichts sagen, und das ist der eigentliche Arbeitsvorrat.
  const boundEquipment = new Set(
    project.equipment.filter((e) => e.sourceIdentityId).map((e) => e.id),
  )
  const reported = new Set<string>()
  for (const link of sources) {
    if (boundEquipment.has(link.sourceEquipmentId) || reported.has(link.sourceEquipmentId)) continue
    reported.add(link.sourceEquipmentId)
    const source = eqById.get(link.sourceEquipmentId)
    const sink = eqById.get(link.sinkEquipmentId)
    if (!source || !sink) continue
    issues.push({
      kind: 'source-without-role',
      severity: 'warning',
      subject: source.id,
      message: `"${source.name}" speist ${sink.name} auf Eingang ${link.inputIndex}, traegt aber keine Rolle — ohne Rolle kein Tally-Eintrag.`,
    })
  }

  rows.sort((a, b) => {
    const an = a.number ?? Number.MAX_SAFE_INTEGER
    const bn = b.number ?? Number.MAX_SAFE_INTEGER
    return an - bn || a.name.localeCompare(b.name, 'de')
  })
  return { rows, issues }
}

/** Die Karte als reviewbare Tabelle — was auf Papier oder in Excel landet. */
export const tallyMapCsv = (map: TallyMap): string =>
  toCsv(
    ['Nr.', 'Rolle', 'Geraet(e)', 'Mischer', 'Eingang', 'UMD-Adresse'],
    map.rows.map((r) => [
      r.number ?? '',
      r.name,
      r.devices.map((d) => d.name).join(' + '),
      r.switcher?.name ?? '',
      r.switcher?.input ?? '',
      r.umdAddress ?? '',
    ]),
  )

export interface TallyPiDevice {
  id: string
  name: string
  input: number
}

/**
 * Der Teil der `tally.json` von `tally-pi`, den der Plan besitzt.
 *
 * Zeilen ohne Mischer-Eingang fallen raus — ein Tally-Eintrag ohne Eingang
 * hat nichts, worauf er hoeren koennte. `id` ist die Rollen-Id und damit
 * stabil ueber Geraetetausch hinweg: Wer die Datei spaeter neu erzeugt,
 * trifft dieselben Eintraege wieder und verliert die Hardware-Verdrahtung
 * nicht, die an dieser Id haengt.
 */
export const toTallyPiDevices = (map: TallyMap): TallyPiDevice[] =>
  map.rows
    .filter((r) => r.switcher !== undefined)
    .map((r) => ({ id: r.identityId, name: r.name, input: r.switcher!.input }))
