// ───────────────────────────────────────────────────────────────────────────
// Der Dante-Patch als Dokument (Bedarf 94, P2).
//
// Warum die Matrix gelesen wird und nicht das Preset-XML, steht im Kopf von
// `types/dantePatch.ts`. Hier steht, was aus der gelesenen Liste wird.
//
// ─── DREI FRAGEN, DIE DER BELEG STELLT ─────────────────────────────────────
//
// 1. „welcher Empfangskanal haengt an nichts" — die freien Eingaenge.
// 2. „was hat sich seit dem letzten Stand geaendert" — der Vergleich.
// 3. „stimmt das ueberhaupt mit dem Plan ueberein" — die Geraetenamen.
//
// Die dritte ist die, die dieser Planer als einziger beantworten kann: er
// kennt die Geraete, die im Plan eine Dante-Schnittstelle fuehren. Ein
// Sendegeraet im Patch, das im Plan nicht existiert, ist entweder ein Tippfehler
// im Namen oder ein Geraet, das niemand eingeplant hat — beides faellt sonst
// erst im Saal auf.
//
// ─── DIE UMBENENNUNGS-FALLE ────────────────────────────────────────────────
//
//   > renaming machines or channels LOSES THE EXISTING PATCH
//
// Dieser Planer benennt nichts um (das tut Bedarf 74, und auch dort nur mit
// einer Warnung). Was er hier tut, ist den Schaden SICHTBAR machen: nach einer
// Umbenennung steht der alte Name im Patch und der neue im Plan, und genau das
// meldet `device-not-in-plan`.
//
// REIN: keine Uhr, kein Store, kein IO, kein Netz.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { DantePatch, DanteSubscription } from '../types/dantePatch'
import { hasDanteInterface } from './namingScheme'
import type { CsvTable } from './csv'

/** Spalten-Ueberschriften, die als die vier Felder gelten. Kleingeschrieben
 *  verglichen; Umlaute und Leerzeichen egal. */
const HEADER_ALIASES: Readonly<Record<keyof DanteSubscription, readonly string[]>> = {
  rxDevice: ['rxdevice', 'rxgerät', 'rxgeraet', 'empfänger', 'empfaenger', 'receiver', 'receivedevice'],
  rxChannel: ['rxchannel', 'rxkanal', 'empfangskanal', 'receivechannel', 'destination'],
  txDevice: ['txdevice', 'txgerät', 'txgeraet', 'sender', 'transmitter', 'transmitdevice'],
  txChannel: ['txchannel', 'txkanal', 'sendekanal', 'transmitchannel', 'source'],
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/[\s_\-.]/g, '')

/** Trennt eine CSV-Zeile an `;` oder `,` — je nachdem, was haeufiger vorkommt.
 *  Deutsches Excel schreibt Semikolon, angelsaechsisches Komma. */
const splitLine = (line: string, delim: string): string[] =>
  line.split(delim).map((c) => c.trim().replace(/^"(.*)"$/s, '$1'))

const detectDelimiter = (text: string): string => {
  const kopf = text.split(/\r?\n/, 1)[0] ?? ''
  return (kopf.match(/;/g)?.length ?? 0) >= (kopf.match(/,/g)?.length ?? 0) ? ';' : ','
}

/**
 * Liest eine Subscription-Matrix als flache Liste.
 *
 * Die Spalten werden ueber ihre UEBERSCHRIFT gefunden, nicht ueber ihre
 * Position: eine Datei, deren Spalten jemand umsortiert hat, ist dieselbe
 * Datei, und eine positionsfeste Lesung machte daraus stillschweigend einen
 * anderen Patch — Sender und Empfaenger vertauscht.
 *
 * Fehlt eine der beiden Rx-Spalten, kommt NICHTS heraus und jede Datenzeile
 * wird als unlesbar gezaehlt: ohne Empfaenger ist eine Subscription keine.
 * Die Tx-Spalten duerfen fehlen — dann ist jede Zeile ein freier Eingang, und
 * auch das ist eine Auskunft.
 */
export function parseDanteMatrix(text: string): DantePatch {
  const delim = detectDelimiter(text)
  const zeilen = text.split(/\r?\n/).filter((z) => z.trim() !== '')
  if (zeilen.length === 0) return { subscriptions: [], unreadable: 0 }

  const kopf = splitLine(zeilen[0], delim).map(norm)
  const spalte = (feld: keyof DanteSubscription): number =>
    kopf.findIndex((h) => HEADER_ALIASES[feld].includes(h))

  const iRxD = spalte('rxDevice')
  const iRxC = spalte('rxChannel')
  const iTxD = spalte('txDevice')
  const iTxC = spalte('txChannel')
  // Fehlt eine der Rx-Spalten, faellt jede Zeile ohnehin durch die
  // Empfaenger-Pruefung in der Schleife und wird dort als unlesbar gezaehlt.
  // Eine Sonderbehandlung davor waere dieselbe Aussage ein zweites Mal — und
  // eine zweite Stelle, an der sich die Zaehlung aendern koennte.

  const subs: DanteSubscription[] = []
  let unreadable = 0
  const gesehen = new Set<string>()
  for (const z of zeilen.slice(1)) {
    const c = splitLine(z, delim)
    const rxDevice = (c[iRxD] ?? '').trim()
    const rxChannel = (c[iRxC] ?? '').trim()
    if (!rxDevice || !rxChannel) {
      unreadable += 1
      continue
    }
    // Ein Empfangskanal kommt genau einmal vor — er kann nur EIN Abo haben.
    // Die zweite Zeile ist deshalb nicht „auch noch", sondern ein Widerspruch;
    // sie wird als Befund gemeldet, nicht hier still zusammengefasst.
    const key = `${norm(rxDevice)}|${norm(rxChannel)}`
    gesehen.add(key)
    const eintrag: DanteSubscription = { rxDevice, rxChannel }
    const txDevice = iTxD >= 0 ? (c[iTxD] ?? '').trim() : ''
    const txChannel = iTxC >= 0 ? (c[iTxC] ?? '').trim() : ''
    if (txDevice) eintrag.txDevice = txDevice
    if (txChannel) eintrag.txChannel = txChannel
    subs.push(eintrag)
  }
  return { subscriptions: subs, unreadable }
}

// ─── Befunde ───────────────────────────────────────────────────────────────

export type DanteFindingKind =
  | 'rx-duplicate'
  | 'half-subscription'
  | 'device-not-in-plan'
  | 'plan-device-unpatched'
  | 'nothing-subscribed'

export const DANTE_FINDING_LABEL: Readonly<Record<DanteFindingKind, string>> = {
  'rx-duplicate': 'Ein Empfangskanal steht zweimal',
  'half-subscription': 'Halbes Abo — Gerät ohne Kanal oder Kanal ohne Gerät',
  'device-not-in-plan': 'Gerät im Patch, das der Plan nicht kennt',
  'plan-device-unpatched': 'Dante-Gerät im Plan, das im Patch nicht vorkommt',
  'nothing-subscribed': 'Kein einziger Empfangskanal ist abonniert',
}

export interface DanteFinding {
  kind: DanteFindingKind
  text: string
}

/**
 * Was an diesem Patch auffällt — auch im Vergleich mit dem Plan.
 *
 * `plan` ist optional: ein Patch laesst sich auch ohne Projekt lesen, dann
 * fallen die beiden Abgleich-Befunde weg. Sie zu erfinden, weil kein Plan da
 * ist, waere schlimmer als sie wegzulassen.
 */
export function assessDantePatch(
  patch: DantePatch,
  plan?: CablePlannerProject,
): DanteFinding[] {
  const out: DanteFinding[] = []

  const zaehler = new Map<string, number>()
  for (const s of patch.subscriptions) {
    const k = `${norm(s.rxDevice)}|${norm(s.rxChannel)}`
    zaehler.set(k, (zaehler.get(k) ?? 0) + 1)
  }
  for (const [k, n] of zaehler) {
    if (n < 2) continue
    out.push({
      kind: 'rx-duplicate',
      text: `„${k.replace('|', ' / ')}" steht ${n}× in der Liste. Ein Empfangskanal kann nur ein Abo haben — eine der Zeilen ist falsch, und welche, weiss nur der Controller.`,
    })
  }

  for (const s of patch.subscriptions) {
    const hatGeraet = !!s.txDevice
    const hatKanal = !!s.txChannel
    if (hatGeraet !== hatKanal) {
      out.push({
        kind: 'half-subscription',
        text: `„${s.rxDevice} / ${s.rxChannel}" trägt ${
          hatGeraet ? 'ein Sendegerät ohne Kanal' : 'einen Sendekanal ohne Gerät'
        }. Als Abo ist das unvollständig; als freier Eingang gelesen wäre die halbe Angabe verloren.`,
      })
    }
  }

  const abonniert = patch.subscriptions.filter((s) => s.txDevice && s.txChannel)
  if (patch.subscriptions.length > 0 && abonniert.length === 0) {
    out.push({
      kind: 'nothing-subscribed',
      text: `Keiner der ${patch.subscriptions.length} Empfangskanäle ist abonniert. Entweder ist der Patch leer, oder die Sendespalten der Datei wurden nicht gefunden.`,
    })
  }

  // Ohne Plan gibt es die beiden Abgleich-Befunde nicht. Das ist KEINE
  // Sonderbehandlung, sondern derselbe Fall wie ein Plan ohne Dante-Geraete:
  // beide sagen „es gibt nichts zu vergleichen", und beide muessen dasselbe
  // Ergebnis liefern. Der frueh zurueckkehrende Zweig spart nur die Arbeit.
  if (!plan) return out

  const planGeraete = new Map(
    plan.equipment.filter(hasDanteInterface).map((e) => [norm(e.name), e.name]),
  )
  const imPatch = new Set<string>()
  for (const s of patch.subscriptions) {
    imPatch.add(norm(s.rxDevice))
    if (s.txDevice) imPatch.add(norm(s.txDevice))
  }

  // Nur melden, wenn der Plan ueberhaupt Dante-Geraete fuehrt. Ein Projekt, in
  // dem niemand eine Dante-Schnittstelle gepflegt hat, wuerde sonst jeden
  // Geraetenamen des Patches als unbekannt melden — und ein Befund, der bei
  // jedem Namen anschlaegt, wird nach der dritten Zeile weggeklickt.
  if (planGeraete.size > 0) {
    const fremd = [...imPatch].filter((n) => !planGeraete.has(n))
    if (fremd.length > 0) {
      out.push({
        kind: 'device-not-in-plan',
        text: `${fremd.length} Gerät(e) im Patch führt der Plan nicht als Dante-Gerät: ${fremd.slice(0, 6).join(', ')}${fremd.length > 6 ? ' …' : ''}. Nach einer Umbenennung steht genau so der alte Name im Patch und der neue im Plan.`,
      })
    }
    const fehlend = [...planGeraete].filter(([n]) => !imPatch.has(n)).map(([, name]) => name)
    if (fehlend.length > 0) {
      out.push({
        kind: 'plan-device-unpatched',
        text: `${fehlend.length} Dante-Gerät(e) aus dem Plan kommen im Patch nicht vor: ${fehlend.slice(0, 6).join(', ')}${fehlend.length > 6 ? ' …' : ''}.`,
      })
    }
  }

  return out
}

// ─── Der Vergleich ─────────────────────────────────────────────────────────

export type DanteDiffKind = 'subscribed' | 'unsubscribed' | 'changed' | 'rx-added' | 'rx-removed'

export const DANTE_DIFF_LABEL: Readonly<Record<DanteDiffKind, string>> = {
  subscribed: 'neu abonniert',
  unsubscribed: 'Abo entfernt',
  changed: 'auf andere Quelle gelegt',
  'rx-added': 'Empfangskanal neu',
  'rx-removed': 'Empfangskanal weg',
}

export interface DanteDiffRow {
  rx: string
  kind: DanteDiffKind
  before: string
  after: string
}

const NO_SOURCE = 'nichts'
const quelle = (s: DanteSubscription | undefined): string =>
  s?.txDevice && s.txChannel ? `${s.txDevice} / ${s.txChannel}` : NO_SOURCE

/**
 * Was sich zwischen zwei Ständen geändert hat.
 *
 * Beidseitig unabonnierte Kanaele stehen NICHT drin: in einem 64-Kanal-Patch
 * waeren das die meisten Zeilen, und eine Aenderungsliste, in der fast nichts
 * eine Aenderung ist, wird nicht gelesen. Dieselbe Regel wie beim
 * Szenen-Vergleich (Bedarf 92).
 */
export function diffDantePatches(vorher: DantePatch, nachher: DantePatch): DanteDiffRow[] {
  const key = (s: DanteSubscription): string => `${s.rxDevice} / ${s.rxChannel}`
  const a = new Map(vorher.subscriptions.map((s) => [norm(key(s)), s]))
  const b = new Map(nachher.subscriptions.map((s) => [norm(key(s)), s]))
  const alle = [...new Set([...a.keys(), ...b.keys()])].sort()
  const out: DanteDiffRow[] = []

  for (const k of alle) {
    const va = a.get(k)
    const vb = b.get(k)
    const rx = key(vb ?? (va as DanteSubscription))
    if (!va) {
      out.push({ rx, kind: 'rx-added', before: NO_SOURCE, after: quelle(vb) })
      continue
    }
    if (!vb) {
      out.push({ rx, kind: 'rx-removed', before: quelle(va), after: NO_SOURCE })
      continue
    }
    const qa = quelle(va)
    const qb = quelle(vb)
    if (qa === qb) continue
    const kind: DanteDiffKind =
      qa === NO_SOURCE ? 'subscribed' : qb === NO_SOURCE ? 'unsubscribed' : 'changed'
    out.push({ rx, kind, before: qa, after: qb })
  }
  return out
}

// Kanonisches Deutsch — dieselbe Regel wie bei allen Blaettern.
const NO_CHANNEL = 'kein Kanal'

/** Der Patch als Blatt: eine Zeile je Empfangskanal, Quelle daneben. */
export function dantePatchTable(patch: DantePatch): CsvTable {
  return {
    headers: ['Empfänger', 'Empfangskanal', 'Sender', 'Sendekanal'],
    rows: patch.subscriptions.map((s) => [
      s.rxDevice,
      s.rxChannel,
      s.txDevice ?? NO_SOURCE,
      s.txChannel ?? NO_CHANNEL,
    ]),
  }
}

/** Der Vergleich als Blatt — die Änderungsliste. */
export function danteDiffTable(rows: readonly DanteDiffRow[]): CsvTable {
  return {
    headers: ['Empfangskanal', 'Was', 'Vorher', 'Nachher'],
    rows: rows.map((r) => [r.rx, DANTE_DIFF_LABEL[r.kind], r.before, r.after]),
  }
}
