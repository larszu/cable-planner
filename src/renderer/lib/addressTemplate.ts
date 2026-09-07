// ───────────────────────────────────────────────────────────────────────────
// BEDARF 20 — die zwei Ebenen aufloesen, den Widerspruch melden, den Umzug
// VORSCHLAGEN.
//
// Der Gegenstand und seine Vokabel stehen in `types/addressTemplate.ts`; hier
// steht, was damit gerechnet wird. Drei Dinge, in dieser Reihenfolge:
//
//   1. `resolveLayers`      — aus n Ebenen wird EIN Satz geltender Bereiche.
//   2. `addressTemplateFindings` — was daran widerspruechlich ist, als Tatsache.
//   3. `proposeReaddress`   — wie eine Adresse hiesse, wenn sie am richtigen
//                             Ort laege. Ein VORSCHLAG, nie eine Aenderung.
//
// ─── DIE BEFUNDE, UND WARUM ES GENAU DIESE SIND ────────────────────────────
//
// Die Hausregel dieser Codebasis steht in `addressPlan.ts`: „eine Warnung, die
// falsch anschlaegt, wird nach dem zweiten Mal ignoriert — dann auch die vier
// richtigen daneben." Drei naheliegende Befunde sind daran gescheitert und
// stehen deshalb NICHT hier:
//
//   * **„zwei Bereiche auf derselben VLAN"** — waere ein Fehlalarm gegen eine
//     dokumentiert richtige Konfiguration: „A VLAN may have multiple prefixes
//     assigned to it" (NetBox, `docs/models/ipam/prefix.md`). Sekundaeres
//     Adressieren ist ueblich. Gemeldet wird stattdessen der WIDERSPRUCH
//     (`vlan-mismatch`): die Schnittstelle sagt VLAN X, der Bereich, in dem
//     ihre Adresse liegt, plant VLAN Y. Das ist keine Geschmacksfrage,
//     sondern zwei Aussagen im selben Plan, die nicht beide stimmen koennen.
//
//   * **„ein Bereich des stehenden Plans, den die Haus-Ebene nicht ersetzt"** —
//     das ist der NORMALFALL. Die Haus-Ebene ersetzt zwei von acht Bereichen;
//     die anderen sechs gelten weiter. Ein Befund darauf meckerte bei jeder
//     richtigen Ueberlagerung.
//
//   * **„ein Geraet ausserhalb aller Bereiche"**, ohne weitere Bedingung —
//     meckerte bei jedem halbfertigen Plan. Gemeldet wird es nur, wenn es
//     einen Bereich fuer GENAU DIESE Rolle GIBT, den die Adresse verfehlt
//     (`device-outside`). Dann steht ein Plan da, gegen den sie verstoesst.
//     Gibt es fuer die Rolle gar keinen Bereich, ist die Adresse nicht
//     falsch, sondern der Plan unfertig — und das ist keine Meldung wert.
//
// Was uebrig bleibt, ist jedes Mal nachrechenbar:
//
//   `overlap`                — zwei geltende Bereiche teilen sich Adressen,
//                              ohne dass der eine die Klammer des anderen ist.
//   `key-twice`              — zwei Bereiche EINER Ebene tragen denselben
//                              Schluessel. Dann ist nicht mehr entscheidbar,
//                              welchen die Haus-Ebene ersetzt: die
//                              Ueberlagerung selbst wird mehrdeutig.
//   `venue-orphan`           — ein Haus-Bereich, dessen Schluessel im
//                              stehenden Plan nicht vorkommt UND der einen
//                              stehenden Bereich ueberlappt. Siehe unten.
//   `device-outside`         — s. o.
//   `container-holds-device` — eine Adresse liegt in einer Klammer, aber in
//                              keinem ihrer Unterbereiche.
//   `vlan-mismatch`          — s. o.
//
// ─── WARUM `venue-orphan` GENAU SO ZUGESCHNITTEN IST ───────────────────────
//
// Ein Haus-Bereich mit einem Schluessel, den der stehende Plan nicht kennt,
// ist fuer sich genommen harmlos: das Haus stellt einen Bereich, den der
// Wagen nicht vorgesehen hatte. Ihn zu melden waere der dritte Fehlalarm von
// oben.
//
// Ueberlappt er aber einen stehenden Bereich, dann ist genau eines von beiden
// wahr, und beide sind eine Meldung wert:
//
//   * Der Schluessel ist VERTIPPT — „contol" statt „control". Die Ersetzung,
//     die gemeint war, findet nicht statt; der stehende Bereich gilt weiter,
//     und die Crew adressiert nach dem Wagen, waehrend das Haus etwas anderes
//     zugesagt hat. Das ist wortwoertlich der Fehler aus der Bedarfs-
//     Datenbank: „pings from here but not from there".
//   * Oder er ist ECHT und kollidiert echt.
//
// Der Befund nennt beides, weil der Plan die beiden nicht auseinanderhalten
// kann — raten waere hier schlimmer als beschreiben.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem } from '../types/equipment'
import type { NetworkInterfaceRole } from '../types/network'
import {
  ADDRESS_LAYER_KINDS,
  ADDRESS_RANGE_KINDS,
  NO_GATEWAY_IN_RANGE,
  NO_RANGE_NAME,
  type AddressLayer,
  type AddressLayerKind,
  type AddressRange,
  type AddressRangeKind,
} from '../types/addressTemplate'
import {
  addressInRange,
  bitsToMask,
  cidrContains,
  cidrsOverlap,
  hostPart,
  ipToNumber,
  maskToBits,
  parseCidr,
  rangeToCidr,
  withHostPart,
  type CidrRange,
} from './subnet'
import { allDeviceInterfaces, interfaceLabel } from './networkInterfaces'
import { ROLE_TEXT } from './networkSegments'
import type { CsvTable } from './csv'

/**
 * Ein Bereich, so wie er nach der Ueberlagerung GILT.
 *
 * `from` und `replaces` sind der Beleg — dieselbe Regel wie beim Adressplan:
 * wer eine Zeile fuer falsch haelt, soll sehen, woher sie kommt, statt der
 * Liste glauben zu muessen. Ohne `replaces` sieht ein ueberlagerter Bereich
 * aus wie ein Bereich, den nie jemand anders geplant hatte.
 */
export interface ResolvedRange extends AddressRange {
  from: AddressLayerKind
  /** Name der Ebene, aus der er stammt. */
  layerName: string
  /** Das Intervall — einmal gerechnet, damit jeder Vergleich dieselbe Zahl sieht. */
  span: CidrRange
  /** Der stehende Bereich, den dieser hier ersetzt. */
  replaces?: { cidr: string; name: string; layerName: string }
}

/**
 * Aus n Ebenen einen geltenden Satz machen.
 *
 * REIHENFOLGE: erst alle `standing`-Ebenen in ihrer Array-Reihenfolge, dann
 * alle `venue`-Ebenen. Ein spaeterer Bereich ersetzt einen frueheren mit
 * demselben Schluessel. Damit gilt die Haus-Ebene IMMER gegen den stehenden
 * Plan, egal wie die beiden im Projekt sortiert sind — die Reihenfolge im
 * Array ist eine Anzeige-Eigenschaft und darf nicht darueber entscheiden,
 * welche Adresse die Crew eintippt.
 *
 * Ein Bereich mit LEEREM Schluessel ersetzt nichts und wird von nichts
 * ersetzt: ohne Schluessel gibt es keine Zuordnung, und eine erfundene waere
 * eine Behauptung.
 */
export function resolveLayers(layers: readonly AddressLayer[]): ResolvedRange[] {
  const geordnet = [
    ...layers.filter((l) => l.kind === 'standing'),
    ...layers.filter((l) => l.kind === 'venue'),
  ]
  const nachSchluessel = new Map<string, ResolvedRange>()
  const ohneSchluessel: ResolvedRange[] = []

  for (const layer of geordnet) {
    for (const r of layer.ranges) {
      const span = parseCidr(r.cidr)
      // Ein Bereich ohne rechenbaren CIDR ist kein Bereich. Ihn mitzufuehren
      // hiesse, dass jede Pruefung ihn ueberspringen muss — und eine, die es
      // vergisst, rechnet auf `null`.
      if (!span) continue
      const aufgeloest: ResolvedRange = {
        ...r,
        from: layer.kind,
        layerName: layer.name,
        span,
      }
      const key = r.key.trim()
      if (!key) {
        ohneSchluessel.push(aufgeloest)
        continue
      }
      const vorher = nachSchluessel.get(key)
      if (vorher) {
        aufgeloest.replaces = {
          cidr: vorher.cidr,
          name: vorher.name,
          layerName: vorher.layerName,
        }
      }
      nachSchluessel.set(key, aufgeloest)
    }
  }
  return [...nachSchluessel.values(), ...ohneSchluessel]
}

export type AddressTemplateFindingKind =
  | 'overlap'
  | 'key-twice'
  | 'venue-orphan'
  | 'device-outside'
  | 'container-holds-device'
  | 'vlan-mismatch'

export interface AddressTemplateFinding {
  kind: AddressTemplateFindingKind
  severity: 'error' | 'warning'
  /** Schluessel des betroffenen Bereichs — Sortier- und Klickschluessel. */
  key: string
  message: string
}

const rangeName = (r: AddressRange): string => r.name.trim() || r.key.trim() || NO_RANGE_NAME

/** Der engste geltende Bereich, in dem die Adresse liegt — oder null. */
const innermostFor = (ip: string, ranges: readonly ResolvedRange[]): ResolvedRange | null => {
  let treffer: ResolvedRange | null = null
  for (const r of ranges) {
    if (!addressInRange(ip, r.span)) continue
    if (!treffer || r.span.bits > treffer.span.bits) treffer = r
  }
  return treffer
}

/**
 * Die Pruefung, die der Bedarf „live conflict validation" nennt.
 *
 * `equipment` darf leer sein — dann werden nur die Bereiche gegeneinander
 * geprueft. Das ist der Zustand, in dem jemand die Vorlage baut, bevor ein
 * einziges Geraet im Plan steht, und genau dort ist die Ueberlappungs-
 * Pruefung am billigsten.
 */
export function addressTemplateFindings(
  layers: readonly AddressLayer[],
  equipment: readonly EquipmentItem[] = [],
): AddressTemplateFinding[] {
  const out: AddressTemplateFinding[] = []

  // 1. Doppelte Schluessel — JE EBENE. Ueber Ebenen hinweg ist derselbe
  //    Schluessel kein Fehler, sondern der ganze Zweck der Ueberlagerung.
  for (const layer of layers) {
    const gesehen = new Map<string, AddressRange>()
    for (const r of layer.ranges) {
      const key = r.key.trim()
      if (!key) continue
      const vorher = gesehen.get(key)
      if (vorher) {
        out.push({
          kind: 'key-twice',
          severity: 'error',
          key,
          message:
            `Ebene "${layer.name.trim() || NO_RANGE_NAME}" führt den Schlüssel "${key}" zweimal ` +
            `(${rangeName(vorher)} ${vorher.cidr} und ${rangeName(r)} ${r.cidr}). ` +
            'Dann ist nicht entscheidbar, welchen der beiden eine Haus-Ebene ersetzt.',
        })
      } else {
        gesehen.set(key, r)
      }
    }
  }

  const geltend = resolveLayers(layers)

  // 2. Ueberlappung.
  //
  //    ZWEI CIDR-BEREICHE SIND ENTWEDER DISJUNKT ODER GESCHACHTELT. Einen
  //    dritten Fall — halb ueberlappend, wie bei beliebigen Intervallen —
  //    gibt es nicht; das ist eine Eigenschaft der Schreibweise und keine
  //    Vereinfachung. Der Befund lautet deshalb im Klartext: DER AEUSSERE
  //    BEREICH IST KEINE KLAMMER. Eine Klammer DARF ihre Unterbereiche
  //    enthalten — das ist ihre Aufgabe.
  for (let i = 0; i < geltend.length; i++) {
    for (let j = i + 1; j < geltend.length; j++) {
      const a = geltend[i]
      const b = geltend[j]
      if (!cidrsOverlap(a.span, b.span)) continue
      if (a.kind === 'container' && cidrContains(a.span, b.span)) continue
      if (b.kind === 'container' && cidrContains(b.span, a.span)) continue
      out.push({
        kind: 'overlap',
        severity: 'error',
        key: a.key.trim() || b.key.trim(),
        message:
          `${rangeName(a)} (${a.cidr}, ${a.layerName.trim() || NO_RANGE_NAME}) und ` +
          `${rangeName(b)} (${b.cidr}, ${b.layerName.trim() || NO_RANGE_NAME}) ` +
          'liegen auf denselben Adressen, und der äußere der beiden ist keine ' +
          'Klammer. Zwei Zwecke auf denselben Adressen erzeugen die doppelte IP, ' +
          'die einen Teil des Netzes stehen lässt.',
      })
    }
  }

  // 3. Haus-Bereich, der nichts ersetzt, aber etwas ueberlappt.
  const stehendeSchluessel = new Set(
    layers
      .filter((l) => l.kind === 'standing')
      .flatMap((l) => l.ranges.map((r) => r.key.trim()))
      .filter(Boolean),
  )
  const stehendeBereiche = layers
    .filter((l) => l.kind === 'standing')
    .flatMap((l) => l.ranges.map((r) => ({ r, layer: l, span: parseCidr(r.cidr) })))
    .filter((x): x is { r: AddressRange; layer: AddressLayer; span: CidrRange } => !!x.span)
  for (const layer of layers) {
    if (layer.kind !== 'venue') continue
    for (const r of layer.ranges) {
      const key = r.key.trim()
      if (!key || stehendeSchluessel.has(key)) continue
      const span = parseCidr(r.cidr)
      if (!span) continue
      const kollision = stehendeBereiche.find((s) => cidrsOverlap(s.span, span))
      if (!kollision) continue
      out.push({
        kind: 'venue-orphan',
        severity: 'error',
        key,
        message:
          `${rangeName(r)} (${r.cidr}) trägt den Schlüssel "${key}", den der stehende Plan ` +
          `nicht kennt — ersetzt also nichts — und überschneidet sich mit ` +
          `${rangeName(kollision.r)} (${kollision.r.cidr}). Entweder ist der Schlüssel ` +
          'vertippt und die gemeinte Ersetzung findet nicht statt, oder beide Bereiche ' +
          'gelten nebeneinander auf denselben Adressen.',
      })
    }
  }

  // 4. Die Geraete gegen die geltenden Bereiche.
  const nachRolle = new Map<NetworkInterfaceRole, ResolvedRange[]>()
  for (const r of geltend) {
    if (r.kind !== 'assignable' || r.role === 'unspecified') continue
    nachRolle.set(r.role, [...(nachRolle.get(r.role) ?? []), r])
  }

  for (const { equipment: e, nic } of allDeviceInterfaces([...equipment])) {
    if (!nic.ipAddress) continue
    const wo = interfaceLabel(e, nic)
    const innerster = innermostFor(nic.ipAddress, geltend)

    if (innerster?.kind === 'container') {
      out.push({
        kind: 'container-holds-device',
        severity: 'warning',
        key: innerster.key,
        message:
          `${wo} steht auf ${nic.ipAddress} — das liegt in der Klammer ` +
          `${rangeName(innerster)} (${innerster.cidr}), aber in keinem ihrer ` +
          'Unterbereiche. Der Unterbereich, in den das Gerät gehört, fehlt im Plan.',
      })
    }

    // Rollen-Bereich vorhanden, Adresse aber nicht darin. Nur DANN — ohne
    // Bereich fuer die Rolle gibt es keinen Plan, gegen den verstossen wuerde.
    const fuerRolle = nachRolle.get(nic.role) ?? []
    if (fuerRolle.length > 0 && !fuerRolle.some((r) => addressInRange(nic.ipAddress, r.span))) {
      out.push({
        kind: 'device-outside',
        severity: 'error',
        key: fuerRolle[0].key,
        message:
          `${wo} ist "${ROLE_TEXT[nic.role]}" und steht auf ${nic.ipAddress}. Geplant ist ` +
          `dafür ${fuerRolle.map((r) => `${rangeName(r)} (${r.cidr})`).join(', ')}. ` +
          'Die Adresse liegt in keinem davon.',
      })
    }

    // Widerspruch zwischen der VLAN an der Schnittstelle und der des Bereichs.
    if (
      innerster &&
      typeof nic.vlanId === 'number' &&
      typeof innerster.vlanId === 'number' &&
      nic.vlanId !== innerster.vlanId
    ) {
      out.push({
        kind: 'vlan-mismatch',
        severity: 'error',
        key: innerster.key,
        message:
          `${wo} steht in VLAN ${nic.vlanId}, ihre Adresse ${nic.ipAddress} liegt aber in ` +
          `${rangeName(innerster)} (${innerster.cidr}), geplant für VLAN ` +
          `${innerster.vlanId}.`,
      })
    }
  }

  return out
}

/**
 * Warum ein Umzug NICHT vorgeschlagen werden kann.
 *
 * Ein benannter Grund statt eines fehlenden Vorschlags: eine leere Liste
 * saehe aus wie „alles in Ordnung", und genau das ist der Unterschied, um den
 * es hier geht. Dieselbe Regel wie bei `NOTHING_SHARED` und `NO_FAULTS`.
 */
export type ReaddressRefusal =
  /** Die Schnittstelle traegt gar keine Adresse — der Adressplan meldet das schon. */
  | 'no-address'
  /** Fuer diese Rolle ist kein Bereich geplant. Nichts zu tun, kein Fehler. */
  | 'no-range'
  /** Die Adresse liegt bereits richtig. */
  | 'already-inside'
  /** Der Host-Anteil passt nicht in den Zielbereich (.200 in ein /29). */
  | 'host-does-not-fit'
  /** Der Vorschlag waere die Netz- oder Broadcast-Adresse des Zielbereichs. */
  | 'network-or-broadcast'
  /** Die vorgeschlagene Adresse traegt bereits ein anderes Geraet. */
  | 'already-taken'

export interface ReaddressProposal {
  equipmentId: string
  nicId: string
  /** „Kamera 1 · Dante Sec" — die vorhandene Vokabel. */
  where: string
  from: string
  /** Die vorgeschlagene Adresse. Fehlt, wenn `refusal` gesetzt ist. */
  to?: string
  /** Die Maske des Zielbereichs, damit der Vorschlag vollstaendig ist. */
  mask?: string
  /** Der Bereich, in den umgezogen wuerde. */
  rangeKey?: string
  rangeName?: string
  refusal?: ReaddressRefusal
}

/**
 * Wie die Adressen hiessen, wenn sie am geplanten Ort laegen.
 *
 * DER HOST-ANTEIL BLEIBT. Wer 10.2.0.57 nach 172.20.5.0/24 umzieht, bekommt
 * 172.20.5.57 — nicht die naechste freie Adresse. Grund: die letzte Zahl
 * steht auf dem Klebeband am Geraet, in der Preset-Liste des Mischers und im
 * Kopf der Crew. Sie beizubehalten macht aus dem Umzug eine Rechnung, die
 * jeder nachvollziehen kann; eine Neuvergabe machte daraus eine Liste, die
 * jemand abtippen muss.
 *
 * WORAUF SICH „DER HOST-ANTEIL" BEZIEHT. Auf die ALTE Maske, wenn es eine
 * gibt: 10.2.1.5 in einem /16 hat den Host-Anteil 1.5 (= 261), und der passt
 * in kein /24. Genau dann wird ABGELEHNT (`host-does-not-fit`) statt gerundet.
 * Wuerde stattdessen immer gegen die ZIEL-Laenge gerechnet, fielen 10.2.0.5
 * und 10.2.1.5 beide auf .5 — zwei Geraete auf eine Adresse, erzeugt vom
 * Werkzeug, das die doppelte IP verhindern soll. Fehlt die alte Maske
 * (`missing-mask` im Adressplan), ist die Ziel-Laenge das einzig Bekannte;
 * dann wird gegen sie gerechnet, und die Kollisions-Pruefung unten faengt,
 * was dabei zusammenfaellt.
 *
 * ES WIRD NICHTS GESCHRIEBEN. Diese Funktion gibt Vorschlaege zurueck. Wer
 * sie uebernimmt, ist ein Mensch mit einem Knopf — und der Knopf zeigt
 * vorher, was er tut.
 */
export function proposeReaddress(
  layers: readonly AddressLayer[],
  equipment: readonly EquipmentItem[],
): ReaddressProposal[] {
  const geltend = resolveLayers(layers)
  const nachRolle = new Map<NetworkInterfaceRole, ResolvedRange>()
  for (const r of geltend) {
    if (r.kind !== 'assignable' || r.role === 'unspecified') continue
    // Der erste Bereich je Rolle. Bei mehreren waere die Wahl eine Vermutung;
    // `device-outside` nennt dann alle, und ein Mensch entscheidet.
    if (!nachRolle.has(r.role)) nachRolle.set(r.role, r)
  }

  const nics = allDeviceInterfaces([...equipment])
  // Alle heute vergebenen Adressen — damit ein Vorschlag keine Doppel-IP baut.
  // Das waere genau der Schaden, den dieser Bedarf verhindern soll.
  //
  // Die Liste WAECHST waehrend der Schleife: ein angenommener Vorschlag
  // belegt seine Zieladresse fuer alle folgenden. Ohne das kollidierten zwei
  // Vorschlaege miteinander statt mit dem Bestand — und das faellt niemandem
  // auf, weil beide einzeln richtig aussehen.
  const belegt = new Map<number, string>()
  for (const { equipment: e, nic } of nics) {
    const n = ipToNumber(nic.ipAddress)
    if (n != null) belegt.set(n, interfaceLabel(e, nic))
  }

  const out: ReaddressProposal[] = []
  for (const { equipment: e, nic } of nics) {
    const basis = { equipmentId: e.id, nicId: nic.id, where: interfaceLabel(e, nic) }
    if (!nic.ipAddress) {
      out.push({ ...basis, from: '', refusal: 'no-address' })
      continue
    }
    const ziel = nachRolle.get(nic.role)
    if (!ziel) {
      out.push({ ...basis, from: nic.ipAddress, refusal: 'no-range' })
      continue
    }
    const zielBasis = {
      ...basis,
      from: nic.ipAddress,
      rangeKey: ziel.key,
      rangeName: rangeName(ziel),
    }
    if (addressInRange(nic.ipAddress, ziel.span)) {
      out.push({ ...zielBasis, refusal: 'already-inside' })
      continue
    }
    const quellBits = maskToBits(nic.subnetMask)
    const host = hostPart(nic.ipAddress, quellBits ?? ziel.span.bits)
    const neu = host == null ? null : withHostPart(ziel.span, host)
    if (neu == null) {
      out.push({ ...zielBasis, refusal: 'host-does-not-fit' })
      continue
    }
    const neuZahl = ipToNumber(neu)
    if (
      !ziel.firstLastUsable &&
      ziel.span.bits <= 30 &&
      (neuZahl === ziel.span.first || neuZahl === ziel.span.last)
    ) {
      out.push({ ...zielBasis, refusal: 'network-or-broadcast' })
      continue
    }
    if (neuZahl != null && belegt.has(neuZahl) && belegt.get(neuZahl) !== basis.where) {
      out.push({ ...zielBasis, refusal: 'already-taken' })
      continue
    }
    if (neuZahl != null) belegt.set(neuZahl, basis.where)
    out.push({
      ...zielBasis,
      to: neu,
      ...(bitsToMask(ziel.span.bits) ? { mask: bitsToMask(ziel.span.bits) as string } : {}),
    })
  }
  return out
}

/**
 * Warum ein Vorschlag ausbleibt, im Klartext.
 *
 * Kanonisch deutsch wie `ROLE_TEXT` und aus demselben Grund: die Liste geht
 * auf ein Blatt, und ein Blatt, dessen Inhalt sich mit dem Sprachschalter
 * aendert, meldet jedes gedruckte Exemplar als veraltet.
 */
export const REFUSAL_TEXT: Readonly<Record<ReaddressRefusal, string>> = {
  'no-address': 'keine Adresse eingetragen',
  'no-range': 'für diese Rolle ist kein Bereich geplant',
  'already-inside': 'liegt bereits im geplanten Bereich',
  'host-does-not-fit': 'der Host-Anteil passt nicht in den Zielbereich',
  'network-or-broadcast': 'wäre die Netz- oder Broadcast-Adresse des Zielbereichs',
  'already-taken': 'die vorgeschlagene Adresse trägt bereits ein anderes Gerät',
}

export const RANGE_HEADERS = [
  'Ebene',
  'Schlüssel',
  'Bereich',
  'CIDR',
  'Art',
  'Zweck',
  'VLAN',
  'Gateway',
  'ersetzt',
] as const

const KIND_TEXT: Readonly<Record<AddressRangeKind, string>> = {
  container: 'Klammer',
  assignable: 'vergebbar',
}

const LAYER_TEXT: Readonly<Record<AddressLayerKind, string>> = {
  standing: 'stehend',
  venue: 'Haus',
}

/**
 * Der geltende Adressbereichs-Plan als Blatt.
 *
 * Kanonisch deutsch und nicht uebersetzt — dieselbe Regel wie bei `ROLE_TEXT`:
 * ein Blatt, dessen Inhalt sich mit dem Sprachschalter aendert, meldet jedes
 * gedruckte Exemplar als veraltet.
 */
export function addressTemplateTable(layers: readonly AddressLayer[]): CsvTable {
  return {
    headers: [...RANGE_HEADERS],
    rows: resolveLayers(layers).map((r) => [
      `${LAYER_TEXT[r.from]} · ${r.layerName.trim() || NO_RANGE_NAME}`,
      r.key,
      rangeName(r),
      r.cidr,
      KIND_TEXT[r.kind],
      ROLE_TEXT[r.role],
      r.vlanId ?? '',
      r.gateway ?? NO_GATEWAY_IN_RANGE,
      r.replaces ? `${r.replaces.name} (${r.replaces.cidr})` : '',
    ]),
  }
}

/**
 * Normalisiert geladene Ebenen — die Schema-Migrationsschicht.
 *
 * WAS SIE WEGWIRFT und warum: einen Bereich ohne rechenbaren CIDR (er ist
 * kein Bereich), eine Ebene ohne Bereiche bleibt dagegen stehen (sie ist ein
 * leeres Formular, kein Rest).
 *
 * WAS SIE UMSCHREIBT: den CIDR auf seine Netz-Adresse. „10.0.5.7/24" wird zu
 * „10.0.5.0/24" — dieselbe Kanonisierung, die NetBox beim Speichern macht
 * („All bits in the address not covered by the mask must be zero"). Sichtbar
 * und nicht still: der Nutzer sieht danach im Feld, was wirklich gilt, statt
 * eine Schreibweise stehen zu haben, gegen die intern anders gerechnet wird.
 */
export function normaliseAddressLayers(raw: unknown): AddressLayer[] {
  if (!Array.isArray(raw)) return []
  const out: AddressLayer[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const l = entry as Record<string, unknown>
    const id = typeof l.id === 'string' && l.id.trim() ? l.id.trim() : null
    if (!id) continue
    const kind = ADDRESS_LAYER_KINDS.includes(l.kind as AddressLayerKind)
      ? (l.kind as AddressLayerKind)
      : 'standing'
    const ranges: AddressRange[] = []
    if (Array.isArray(l.ranges)) {
      for (const rEntry of l.ranges) {
        const r = normaliseAddressRange(rEntry)
        if (r) ranges.push(r)
      }
    }
    out.push({
      id,
      kind,
      name: typeof l.name === 'string' ? l.name.trim() : '',
      ranges,
    })
  }
  return out
}

/** Ein einzelner Bereich, oder null wenn er keiner ist. */
export function normaliseAddressRange(raw: unknown): AddressRange | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : null
  if (!id) return null
  const span = parseCidr(typeof r.cidr === 'string' ? r.cidr : undefined)
  if (!span) return null
  const rollen: readonly NetworkInterfaceRole[] = [
    'media-primary',
    'media-secondary',
    'control',
    'management',
    'unspecified',
  ]
  const out: AddressRange = {
    id,
    key: typeof r.key === 'string' ? r.key.trim() : '',
    name: typeof r.name === 'string' ? r.name.trim() : '',
    role: rollen.includes(r.role as NetworkInterfaceRole)
      ? (r.role as NetworkInterfaceRole)
      : 'unspecified',
    cidr: rangeToCidr(span),
    kind: ADDRESS_RANGE_KINDS.includes(r.kind as AddressRangeKind)
      ? (r.kind as AddressRangeKind)
      : 'assignable',
  }
  if (typeof r.vlanId === 'number' && Number.isInteger(r.vlanId) && r.vlanId >= 1 && r.vlanId <= 4094) {
    out.vlanId = r.vlanId
  }
  // Ein Gateway AUSSERHALB seines eigenen Bereichs ist keins. Es stehen zu
  // lassen saehe auf dem Merkblatt aus wie ein Weg hinaus.
  if (typeof r.gateway === 'string' && addressInRange(r.gateway.trim(), span)) {
    out.gateway = r.gateway.trim()
  }
  if (r.firstLastUsable === true) out.firstLastUsable = true
  if (typeof r.note === 'string' && r.note.trim()) out.note = r.note.trim()
  return out
}
