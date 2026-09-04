// ADR-001, Inkrement 1 — die reine Ableitungsschicht.
//
// Beantwortet aus Plan-Daten allein die Frage: WELCHEN Text bekommt WELCHES
// externe System fuer WELCHEN Anschluss? Kein React, kein Store, kein
// Electron, kein persistiertes Feld — Eingabe sind Geraete und Kabel, Ausgabe
// sind Kandidaten und die Liste dessen, was der Graph NICHT beantworten kann.
//
// TREUE-REGEL: Ein Label-Kandidat behauptet nur, was der zustaendige Exporter
// HEUTE wirklich sendet — ATEM ueber `portDisplayLabel` + `shortenForAtem`
// (AtemDialog), Videohub ueber `portDisplayLabel` (exportVideohub). Waere die
// Ableitung hier schon „besser" als die Exporter, meldete der Plan-Check
// Kollisionen auf Texten, die nie ein Geraet erreichen. Dass die Exporter
// diesen Resolver uebernehmen, ist Inkrement 2 — nicht dieser Schritt.
//
// Die Rueckwaertssuche im Kabelgraph traegt dafuer das, was noch KEIN Exporter
// abdeckt: `resolveSignalSource` laeuft vom Mischer-Eingang rueckwaerts durch
// Durchleiter (Konverter, Verteiler) bis zur echten Quelle. Daraus entstehen
// die Eingangsnummer je Quelle (die der ATEM auf dem Draht adressiert), der
// UMD-Displaytext und die Liste der offenen Anker. Jeder Kandidat sagt in
// `provenance`, woher sein Text stammt.
//
// Was die Ableitung NICHT kann, bleibt sichtbar statt geraten zu werden:
// `UnansweredAnchor` sammelt genau die Felder, die kein Graph liefern kann,
// weil sie Einsatz-Entscheidungen sind (welches UMD-Display zeigt diese
// Quelle?). Diese Liste ist die Eingabe fuer Inkrement 2.
//
// REGEL: kein Anker ohne Ziel-Spec. Es werden nur Felder als offen gemeldet,
// fuer die `labelTargets.ts` ein belegtes Ziel kennt — sonst entstuende eine
// Wunschliste statt eines Arbeitsvorrats.

import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import type { SourceIdentity } from '../types/sourceIdentity'
import type { CheckFinding } from './drawingChecks'
import { detectDeviceKind, type DeviceKind } from './deviceKind'
import {
  resolvePortLabel,
  shortenForAtem,
  type PortLabelProvenance,
} from './portLabel'
import { effectiveShortName } from './shortName'
import { suggestDanteName } from './danteNaming'
import { umdAddressClashes } from './sourceIdentity'
import {
  LABEL_TARGETS,
  collisionsForTarget,
  fitToTarget,
  type FittedLabel,
  type LabelTargetId,
} from './labelTargets'

/**
 * Woher der Wunschtext eines Kandidaten stammt.
 *
 * Die Port-Haelfte kommt aus `portLabel.ts` — eine Vokabel, nicht zwei. Bis
 * ADR-001 Inkrement 2 standen hier alle fuenf Werte ausgeschrieben, neben
 * einer privaten `portText`, die dieselbe Aufloesung ein zweites Mal fuehrte.
 */
export type LabelProvenance =
  | PortLabelProvenance
  | 'device-short-name'
  | 'device-name'
  | 'source-identity'

export interface LabelCandidate {
  targetId: LabelTargetId
  /** Stabiler Schluessel — als Befund-ID und React-key nutzbar. */
  key: string
  /** Geraet, das im Zielsystem konfiguriert wird. */
  equipmentId: string
  /** Port am Zielgeraet (nur bei portbezogenen Zielen gesetzt). */
  portId?: string
  /** Menschliche Verortung fuer Befunde, z. B. "ATEM 1 · In 3". */
  where: string
  /** Wunschtext VOR dem Zuschnitt auf das Zielbudget, aber NACH der
   *  Aufbereitung des Exporters (bei ATEM z. B. `shortenForAtem`). */
  raw: string
  /** Derselbe Eintrag, wie er im Plan steht — die Aufbereitung wirft
   *  Unterschiede weg, und genau die braucht die Kollisionspruefung. */
  sourceText: string
  provenance: LabelProvenance
}

/** Eine im Graph aufgeloeste Signalquelle an einem Router-/Mischer-Eingang. */
export interface SignalSourceLink {
  /** Router/Mischer, dessen Eingang betrachtet wird. */
  sinkEquipmentId: string
  sinkPortId: string
  /** 1-basierte Position des Eingangs im Array — das ist die Nummer, mit der
   *  ATEM und Videohub den Eingang auf dem Draht adressieren. */
  inputIndex: number
  /** Geraet, das dort tatsaechlich ankommt (nach Durchleitern). */
  sourceEquipmentId: string
  /** Anzahl durchlaufener Zwischengeraete (0 = direkt verkabelt). */
  hops: number
  /**
   * Was fuer eine Senke das ist. Steht MIT im Link und wird nicht vom
   * Verbraucher nachgeleitet, weil genau das schiefging: `sources` fuehrt
   * Router- und Mischer-Eingaenge gleichberechtigt, und zwei Verbraucher
   * (`tallyMap`, `sourceMap`) griffen sich mit `find()` den ersten Treffer,
   * ohne die Art zu pruefen. Bei der Standardkette Kamera -> Videohub -> ATEM
   * ist das immer der ROUTER-Eingang. Wer die Art nur nebenbei ableiten kann,
   * leitet sie irgendwann nicht ab.
   */
  sinkKind: DeviceKind
}

/**
 * Der Link, ueber den das Tally dieser Rolle laeuft — also der MISCHER-Eingang,
 * nicht der erstbeste Eingang irgendeiner Senke.
 *
 * WARUM DAS EINE FUNKTION IST UND KEINE ZEILE IN ZWEI DATEIEN. Genau diese
 * Auswahl stand bis 2026-09-04 zweimal als `sources.find(...)` da — in
 * `tallyMap.ts` und in `sourceMap.ts` — und beide Kopien pruefen die Senkenart
 * nicht. Bei der Standardkette Kamera -> Videohub -> ATEM greifen sie deshalb
 * den ROUTER-Eingang, und beide Ausgabewege tragen dieselbe falsche Zahl.
 * Nachgemessen: Kamera an Videohub In 7, Videohub Out 3 an ATEM In 1 ergab
 * `{"id":"r1","name":"Kamera 1","input":7}` — `tally-pi` haelt das Feld gegen
 * den ATEM-PGM-Eingang und schaltet damit die Lampe von Eingang 7.
 *
 * Zwei Regeln, beide notwendig:
 *
 * 1. NUR MISCHER-SENKEN. Das Tally kommt vom Mischer; ein Router-Eingang ist
 *    keine Tally-Adresse. Gibt es keinen Mischer-Link, gibt es KEINE Zahl —
 *    der Aufrufer meldet das, statt eine zu erfinden. `tallyMap.ts` schreibt
 *    sich diese Regel selbst vor: "eine erfundene Pin-Nummer waere schlimmer
 *    als ein fehlendes Feld — sie sieht aus wie eine Zusage und schaltet die
 *    falsche Lampe."
 *
 * 2. DETERMINISTISCH. `find()` nahm den ersten Treffer in `sources`, und
 *    `sources` folgt der Reihenfolge des `equipment`-Arrays. Nachgemessen:
 *    derselbe Plan mit umsortiertem Array lieferte einmal Eingang 7 und einmal
 *    Eingang 3, beide ohne Befund. Eine exportierte Datei darf keine Funktion
 *    des Bearbeitungsverlaufs sein — `tallyMap.ts` verspricht woertlich, dass
 *    ein spaeterer Lauf "dieselben Eintraege wieder trifft". Sortiert wird
 *    deshalb nach Eingangsnummer, dann nach Geraete- und Port-Id.
 */
export const switcherLinkFor = (
  sources: SignalSourceLink[],
  equipmentIds: Iterable<string>,
): SignalSourceLink | undefined => {
  const ids = new Set(equipmentIds)
  return sources
    .filter((s) => s.sinkKind === 'atem' && ids.has(s.sourceEquipmentId))
    .sort(
      (a, b) =>
        a.inputIndex - b.inputIndex ||
        a.sinkEquipmentId.localeCompare(b.sinkEquipmentId) ||
        a.sinkPortId.localeCompare(b.sinkPortId),
    )[0]
}

/**
 * Ein Link auf eine NICHT-Mischer-Senke fuer dieselben Geraete — die Erklaerung
 * dafuer, warum `switcherLinkFor` nichts liefert. Ohne diese Unterscheidung
 * lautet der Befund "erreicht keinen Mischer-Eingang", obwohl das Kabel steckt
 * und nur der Kreuzpunkt fehlt; der Nutzer sucht dann am falschen Ende.
 */
export const routerLinkFor = (
  sources: SignalSourceLink[],
  equipmentIds: Iterable<string>,
): SignalSourceLink | undefined => {
  const ids = new Set(equipmentIds)
  return sources
    .filter((s) => s.sinkKind !== 'atem' && ids.has(s.sourceEquipmentId))
    .sort(
      (a, b) =>
        a.inputIndex - b.inputIndex ||
        a.sinkEquipmentId.localeCompare(b.sinkEquipmentId) ||
        a.sinkPortId.localeCompare(b.sinkPortId),
    )[0]
}

export type AnchorField = 'umd-address'

export interface UnansweredAnchor {
  field: AnchorField
  /** Geraet, dem der Anker fehlt (die Quelle, nicht der Router). */
  equipmentId: string
  where: string
  /** Warum der Graph das nicht beantworten kann. */
  reason: string
  /** Rolle, die den Anker tragen wuerde — fehlt, solange keine gebunden ist. */
  sourceIdentityId?: string
}

export interface LabelDerivationInput {
  equipment: EquipmentItem[]
  cables: Cable[]
  /** ADR-001, Inkrement 2 — die persistierten Rollen. Fehlen sie, verhaelt
   *  sich die Ableitung wie in Inkrement 1: sie leitet ab, was sie kann, und
   *  meldet den Rest als offen. */
  sourceIdentities?: SourceIdentity[]
}

export interface LabelDerivation {
  candidates: LabelCandidate[]
  sources: SignalSourceLink[]
  unanswered: UnansweredAnchor[]
}

// ── Graph-Hilfen ─────────────────────────────────────────────────────────────

interface PortRef {
  equipmentId: string
  portId: string
}

export interface GraphContext {
  eqById: Map<string, EquipmentItem>
  portById: Map<string, Port>
  /** Je Port die Gegenenden seiner Kabel — ein Kabel kann in beide Richtungen
   *  gezeichnet sein, deshalb wird jedes zweimal eingetragen. */
  links: Map<string, PortRef[]>
}

export const buildGraphContext = (
  equipment: EquipmentItem[],
  cables: Cable[],
): GraphContext => {
  const eqById = new Map(equipment.map((e) => [e.id, e]))
  const portById = new Map<string, Port>()
  for (const e of equipment) {
    for (const p of [...e.inputs, ...e.outputs]) portById.set(p.id, p)
  }
  const links = new Map<string, PortRef[]>()
  const add = (portId: string, ref: PortRef) => {
    const list = links.get(portId)
    if (list) list.push(ref)
    else links.set(portId, [ref])
  }
  for (const c of cables) {
    add(c.fromPortId, { equipmentId: c.toEquipmentId, portId: c.toPortId })
    add(c.toPortId, { equipmentId: c.fromEquipmentId, portId: c.fromPortId })
  }
  return { eqById, portById, links }
}

/**
 * Eingaenge, die kein Programmsignal fuehren: Referenz, Rueckweg, Steuerung.
 *
 * Ohne diese Liste laeuft die Rueckwaertssuche durch den Genlock-Eingang einer
 * Kamera hindurch und beschriftet den ATEM-Eingang am Ende mit dem Namen des
 * Sync-Generators. Geprueft wird der PORT-Name, nicht der Geraetename — der
 * ist ungleich verlaesslicher, weil er aus dem Katalog-Datenblatt stammt.
 */
const REFERENCE_PORT =
  /genlock|\bref\b|reference|sync|return|tally|timecode|\bltc\b|talkback|intercom|comms|control|\bctrl\b|\brcp\b|\bgpi\b|prompter/i

const isReferencePort = (port: Port): boolean =>
  REFERENCE_PORT.test(`${port.name ?? ''} ${port.contentLabel ?? ''}`)

/**
 * Der eine Eingang, durch den das an `arrival` anliegende Signal plausibel
 * hereingekommen ist — oder null, wenn das Geraet keine eindeutige
 * Durchleitung ist.
 *
 * Bedingungen, bewusst eng gehalten: das Geraet hat keine eigene Rolle
 * (Router/Mischer fuehren Laufzeit-Routing, keine feste Quelle), und es gibt
 * GENAU EINEN Eingang mit demselben Steckverbinder, der kein Referenz-/
 * Rueckweg-Eingang ist. Alles andere ist mehrdeutig — dann haelt die Suche an
 * und nennt das Zwischengeraet. Das sagt weniger, stimmt aber.
 */
const feedingInput = (device: EquipmentItem, arrival: Port): Port | null => {
  const kind = detectDeviceKind(device)
  if (kind === 'videohub') return routedInput(device, arrival)
  if (kind !== null) return null
  const candidates = device.inputs.filter(
    (p) => p.connectorType === arrival.connectorType && !isReferencePort(p),
  )
  return candidates.length === 1 ? candidates[0] : null
}

/**
 * Der Router-Durchgang — der Grund, warum `videohubRouting` ueberhaupt im
 * Projekt liegt.
 *
 * ADR-001 Inkrement 0 hat den geplanten Kreuzpunkt persistiert (`cable#601`)
 * und ausdruecklich damit begruendet, dass die Kette Kamera -> Router ->
 * Mischer-Eingang sonst nicht ableitbar ist. Der Zustand lag dann da und
 * WURDE VON NIEMANDEM GELESEN: die Ableitung brach weiter an jedem Router ab,
 * und die Tally-Karte trug still die Router-Nummer. Formal beseitigt,
 * praktisch unveraendert — bis hierher.
 *
 * `planned` ist `routing[outputIndex] = inputIndex`, beide 0-basiert. Wir
 * kommen von einem AUSGANG des Routers (rueckwaerts betrachtet) und suchen
 * den Eingang, der darauf geschaltet ist.
 *
 * Ohne gesetzten Kreuzpunkt gibt es null — dann haelt die Suche am Router an
 * wie bisher. Das ist Absicht: geraten wird hier nichts. Ein Router mit 20
 * Eingaengen hat 20 gleich plausible Antworten, und die falsche schaltet die
 * falsche Lampe.
 */
const routedInput = (device: EquipmentItem, arrival: Port): Port | null => {
  const planned = device.videohubRouting?.planned
  if (!planned) return null
  const outIdx = device.outputs.findIndex((p) => p.id === arrival.id)
  if (outIdx < 0) return null
  const inIdx = planned[outIdx]
  if (typeof inIdx !== 'number' || !Number.isInteger(inIdx) || inIdx < 0) return null
  return device.inputs[inIdx] ?? null
}

const MAX_HOPS = 8

/**
 * Laeuft von einem Eingangsport rueckwaerts bis zur echten Quelle.
 *
 * Stoppt bei: keinem Kabel, einem Geraet ohne eindeutige Durchleitung (das IST
 * die Quelle — siehe `feedingInput`), einem unverkabelten Weiterweg und
 * spaetestens nach `MAX_HOPS` Zwischenstationen.
 */
export const resolveSignalSource = (
  sinkPortId: string,
  ctx: GraphContext,
): { equipmentId: string; hops: number } | null => {
  const first = ctx.links.get(sinkPortId)?.[0]
  if (!first) return null

  let current = first
  let hops = 0
  const visited = new Set<string>([sinkPortId, first.portId])

  for (;;) {
    const device = ctx.eqById.get(current.equipmentId)
    if (!device) return null
    const here = { equipmentId: current.equipmentId, hops }

    const arrival = ctx.portById.get(current.portId)
    if (!arrival) return here
    if (hops >= MAX_HOPS) return here

    const next = feedingInput(device, arrival)
    if (!next || visited.has(next.id)) return here

    const upstream = ctx.links.get(next.id)?.find((r) => !visited.has(r.portId))
    if (!upstream) return here

    visited.add(next.id)
    visited.add(upstream.portId)
    current = upstream
    hops += 1
  }
}

// ── Wunschtexte ──────────────────────────────────────────────────────────────

/**
 * Der Text, den die Exporter fuer einen Port abgeben, plus die Herkunft.
 * Leerer Text heisst: der Exporter sendet fuer diesen Port nichts, also gibt
 * es auch nichts zu pruefen.
 *
 * Duenner Adapter auf `resolvePortLabel` — die Aufloesung selbst stand bis
 * ADR-001 Inkrement 2 hier als private Kopie und war damit fuer die Exporter
 * unerreichbar, obwohl ADR-001 sie genau fuer sie vorgesehen hatte.
 */
const portText = (port: Port): { raw: string; provenance: LabelProvenance } => {
  const { text, provenance } = resolvePortLabel(port)
  return { raw: text, provenance }
}

/**
 * Netzwerkadressierte Geraete — dieselbe Abgrenzung wie im AnalysisDialog,
 * damit Naming-Pruefung und Kollisionspruefung denselben Geraetekreis sehen.
 */
const isNetworkAddressed = (device: EquipmentItem): boolean =>
  Boolean(device.ipAddress) ||
  device.managementVlanId != null ||
  (device.vlans?.length ?? 0) > 0

/** ATEM-Kurzname: der Emitter entfernt Leerzeichen und schreibt gross. */
export const atemShortSource = (raw: string): string =>
  shortenForAtem(raw).replace(/\s+/g, '').toUpperCase()

// ── Ableitung ────────────────────────────────────────────────────────────────

export const deriveLabels = ({
  equipment,
  cables,
  sourceIdentities = [],
}: LabelDerivationInput): LabelDerivation => {
  const ctx = buildGraphContext(equipment, cables)
  const identityById = new Map(sourceIdentities.map((s) => [s.id, s]))
  const { eqById } = ctx
  const candidates: LabelCandidate[] = []
  const sources: SignalSourceLink[] = []
  const unanswered: UnansweredAnchor[] = []
  const umdSeen = new Set<string>()

  /**
   * Der Multiviewer und das UMD zeigen den Namen der QUELLE, nicht den des
   * Mischer-Eingangs. Welche Nummer der Eingang auf dem Draht hat, weiss der
   * Graph — welches physische Display darauf hoert, ist eine
   * Einsatz-Entscheidung und damit ein offener Anker.
   */
  const emitUmd = (
    source: EquipmentItem | undefined,
    sink: EquipmentItem,
    inputIdx: number,
  ) => {
    if (!source || umdSeen.has(source.id)) return
    if (detectDeviceKind(sink) !== 'atem') return
    umdSeen.add(source.id)

    // Die Rolle gewinnt gegen den Geraetenamen: „Kamera 1" bleibt „Kamera 1",
    // auch wenn die Havarie-Kamera einspringt. Genau dafuer gibt es sie.
    const identity = source.sourceIdentityId
      ? identityById.get(source.sourceIdentityId)
      : undefined
    candidates.push({
      targetId: 'tsl-umd-v31',
      key: `umd:${source.id}`,
      equipmentId: source.id,
      where: source.name,
      raw: identity ? identity.name : effectiveShortName(source),
      sourceText: identity ? identity.name : source.name,
      provenance: identity ? 'source-identity' : 'device-short-name',
    })

    if (identity?.umdAddress !== undefined) return
    unanswered.push({
      field: 'umd-address',
      equipmentId: source.id,
      where: source.name,
      sourceIdentityId: identity?.id,
      reason: identity
        ? `Rolle "${identity.name}" speist ${sink.name} auf Eingang ` +
          `${inputIdx + 1}, traegt aber keine UMD-Adresse`
        : `speist ${sink.name} auf Eingang ${inputIdx + 1} — ohne gebundene ` +
          'Rolle gibt es keinen Ort fuer die UMD-Adresse',
    })
  }

  for (const device of equipment) {
    const kind = detectDeviceKind(device)
    if (kind !== 'atem' && kind !== 'videohub') continue

    device.inputs.forEach((port, idx) => {
      const resolved = resolveSignalSource(port.id, ctx)
      const source = resolved ? eqById.get(resolved.equipmentId) : undefined
      if (resolved && source) {
        sources.push({
          sinkEquipmentId: device.id,
          sinkPortId: port.id,
          inputIndex: idx + 1,
          sourceEquipmentId: resolved.equipmentId,
          hops: resolved.hops,
          sinkKind: kind,
        })
      }
      const { raw, provenance } = portText(port)
      if (!raw) {
        // Kein Label heisst nicht: keine Quelle. Der UMD-Text haengt an der
        // Quelle, nicht am Portnamen — deshalb erst hier abbrechen.
        emitUmd(source, device, idx)
        return
      }
      const where = `${device.name} · ${port.name || `In ${idx + 1}`}`

      if (kind === 'atem') {
        const long = shortenForAtem(raw)
        candidates.push({
          targetId: 'atem-input-long',
          key: `atem-long:${port.id}`,
          equipmentId: device.id,
          portId: port.id,
          where,
          raw: long,
          sourceText: raw,
          provenance,
        })
        candidates.push({
          targetId: 'atem-input-short',
          key: `atem-short:${port.id}`,
          equipmentId: device.id,
          portId: port.id,
          where,
          raw: atemShortSource(raw),
          sourceText: raw,
          provenance,
        })
      } else {
        candidates.push({
          targetId: 'videohub-label',
          key: `videohub-in:${port.id}`,
          equipmentId: device.id,
          portId: port.id,
          where,
          raw,
          sourceText: raw,
          provenance,
        })
      }

      emitUmd(source, device, idx)
    })

    if (kind === 'videohub') {
      device.outputs.forEach((port, idx) => {
        const { raw, provenance } = portText(port)
        if (!raw) return
        candidates.push({
          targetId: 'videohub-label',
          key: `videohub-out:${port.id}`,
          equipmentId: device.id,
          portId: port.id,
          where: `${device.name} · ${port.name || `Out ${idx + 1}`}`,
          raw,
          sourceText: raw,
          provenance,
        })
      })
    }
  }

  // Dante/AES67 — netzwerkfaehige Geraete. Anders als bei ATEM und Videohub
  // gibt es hier keinen Exporter, sondern einen Vorschlag: `suggestDanteName`
  // ist der Name, den der Nutzer laut AnalysisDialog vergeben soll. Geprueft
  // wird also, was nach dem Befolgen des eigenen Rats im Netz steht — zwei
  // Geraete, deren Vorschlaege zusammenfallen, waeren dort derselbe Host.
  for (const device of equipment) {
    if (!isNetworkAddressed(device)) continue
    candidates.push({
      targetId: 'dante-device',
      key: `dante:${device.id}`,
      equipmentId: device.id,
      where: device.name,
      raw: suggestDanteName(device.name),
      sourceText: device.name,
      provenance: 'device-name',
    })
  }

  return { candidates, sources, unanswered }
}

// ── Befunde ──────────────────────────────────────────────────────────────────

/**
 * Uebersetzt die Abbildung auf die Zielsysteme in Befunde.
 *
 * Gemeldet wird, was ueberrascht: zwei verschiedene Namen, die im Zielsystem
 * gleich heissen (Fehler — auf dem Multiviewer nicht mehr unterscheidbar), und
 * Zeichen, die das Zielformat nicht transportiert (Warnung). Blosses
 * Abschneiden ist KEIN Befund: es ist der Normalfall und wuerde die Liste
 * zumuellen.
 */
export const labelTargetIssues = (input: LabelDerivationInput): CheckFinding[] => {
  const { candidates } = deriveLabels(input)
  const issues: CheckFinding[] = []

  // Zwei Rollen auf derselben UMD-Adresse: Beide Displays zeigen denselben
  // Text, und welches Paket zuletzt ankommt, entscheidet. Das ist kein
  // Schoenheitsfehler, sondern ein falsches Tally auf Sendung — deshalb
  // Fehler, nicht Warnung. Geprueft wird der Anker selbst, nicht sein
  // Zeichenbudget; er kommt aus dem Projekt, nicht aus dem Graph.
  for (const clash of umdAddressClashes(input.sourceIdentities ?? [])) {
    issues.push({
      id: `umd-address-clash:${clash.address}`,
      severity: 'error',
      category: 'UMD-Adresse doppelt',
      message:
        `${clash.identities.map((i) => `"${i.name}"`).join(' und ')} liegen ` +
        `beide auf UMD-Adresse ${clash.address} — die Displays zeigen ` +
        'denselben Text, welcher gewinnt entscheidet die Paketreihenfolge.',
    })
  }

  const byTarget = new Map<LabelTargetId, LabelCandidate[]>()
  for (const c of candidates) {
    const list = byTarget.get(c.targetId)
    if (list) list.push(c)
    else byTarget.set(c.targetId, [c])
  }

  for (const [targetId, group] of byTarget) {
    const spec = LABEL_TARGETS[targetId]
    const candidateOf = new Map<FittedLabel, LabelCandidate>()
    const fitted: FittedLabel[] = []
    for (const c of group) {
      const f = fitToTarget(c.raw, spec, c.sourceText)
      fitted.push(f)
      candidateOf.set(f, c)
    }

    for (const collision of collisionsForTarget(fitted, spec)) {
      const members = collision.members
        .map((f) => candidateOf.get(f))
        .filter((c): c is LabelCandidate => c != null)
      if (members.length < 2) continue
      const budget = spec.budget
      issues.push({
        id: `label-collision:${targetId}:${collision.value}`,
        severity: 'error',
        category: `${spec.system}-Namenskollision`,
        message:
          `${members.map((m) => `"${m.sourceText}"`).join(' und ')} werden im ` +
          `${spec.system}-${spec.field} beide zu "${collision.value}"` +
          (budget !== null ? ` (${budget} ${spec.budgetUnit === 'bytes' ? 'Byte' : 'Zeichen'})` : '') +
          ` — betroffen: ${members.map((m) => m.where).join(', ')}.`,
        equipmentId: members[0].equipmentId,
      })
    }

    for (const f of fitted) {
      if (f.invalidChars.length === 0) continue
      const c = candidateOf.get(f)
      if (!c) continue
      issues.push({
        id: `label-charset:${targetId}:${c.key}`,
        severity: 'warning',
        category: `${spec.system}-Zeichensatz`,
        message:
          `"${f.raw}" enthaelt ${f.invalidChars.map((ch) => `"${ch}"`).join(', ')} — ` +
          `im ${spec.system}-${spec.field} nicht darstellbar (${c.where}).`,
        equipmentId: c.equipmentId,
      })
    }
  }

  return issues
}
