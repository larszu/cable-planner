// ───────────────────────────────────────────────────────────────────────────
// Die Übergabe an die Post (Bedarf 62, P2).
//
// ─── DER BEFUND ────────────────────────────────────────────────────────────
//
//   > Card labelling and media reports are a manual discipline; CAMERA
//   > IDENTITY IN POST ('B_Day1_003') HAS NO LINK TO THE PLANNED POSITION,
//   > and renaming originals breaks metadata.
//
// Die Bedarfs-Datenbank sagt auch, was zu bauen ist:
//
//   > Emit a per-show manifest mapping camera position -> switcher input ->
//   > ISO/record channel -> card label, printable and exportable, so post can
//   > reconcile without asking the crew.
//
// ─── WAS DER PLAN BEANTWORTEN KANN, UND WAS NICHT ──────────────────────────
//
// Drei der vier Spalten stehen schon im Kabelgraph — die Rolle, das Geraet,
// das sie realisiert, und der Mischer-Eingang (`switcherLinkFor`). Die vierte
// zerfaellt in zwei sehr verschiedene Faelle, und genau diese Unterscheidung
// ist der Grund, warum es `recording.ts` gibt:
//
//   ATEM ISO      zeichnet JE EINGANG auf. Der Aufnahmekanal IST die
//                 Eingangsnummer — der Plan weiss ihn also bereits.
//   HyperDeck &c. zeichnen auf, WAS AM EINGANG ANLIEGT. Welche Rolle darin
//                 landet, sagt die Verkabelung; eine Kanalnummer gibt es
//                 nicht, und eine zu erfinden schickte die Post an eine
//                 Datei, die es nicht gibt.
//
// Steht im Plan gar kein Recorder, sagt das Blatt genau das. „Kein Recorder
// im Plan" ist eine Auskunft; eine leere Zelle ist keine.
//
// ─── DIE KARTENBESCHRIFTUNG IST EIN PRAEFIX UND KEINE DATEINAME ────────────
//
// Der Beleg nennt `B_Day1_003`: Kameraletter, Drehtag, Kartennummer. Von den
// dreien gehoert dem Plan genau EINES — der Buchstabe, denn er ist die Rolle.
// Drehtag und Kartennummer entstehen am Set und stehen nirgends in dieser
// Datei. Das Blatt liefert deshalb das PRAEFIX und sagt, worauf es beruht;
// es baut keinen Dateinamen zusammen, den niemand zugesagt hat.
//
// Der Buchstabe kommt aus der Rollen-NUMMER (1 → A … 26 → Z), weil genau das
// die Zuordnung ist, die die Regie ohnehin spricht. Ohne Nummer — oder jenseits
// von 26 — traegt das Praefix den bereinigten Rollennamen, und die Spalte
// „Grundlage" sagt, welcher der beiden Faelle vorliegt. Ein 27. Buchstabe
// waere eine erfundene Regel, und zwar eine, die zwei Rollen denselben Namen
// geben koennte.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { CsvTable } from './csv'
import {
  buildGraphContext,
  deriveLabels,
  isReferencePort,
  resolveSignalSource,
  switcherLinkFor,
} from './labelDerivation'
import { detectRecording } from './recording'

/** Was in der Aufnahme-Spalte steht, wo der Plan keinen Recorder kennt. */
export const NO_RECORDER = 'kein Recorder im Plan'
/** Was in der Mischer-Spalte steht, wo die Rolle keinen Mischer erreicht. */
export const NO_SWITCHER = 'kein Mischer-Eingang im Plan'

/** Worauf das Karten-Praefix beruht. */
export type CardPrefixBasis =
  /** Aus der Rollen-Nummer abgeleiteter Buchstabe (1 → A). */
  | 'number'
  /** Aus dem Rollen-Namen bereinigt — keine Nummer, oder jenseits von Z. */
  | 'name'

export const PREFIX_BASIS_LABEL: Readonly<Record<CardPrefixBasis, string>> = {
  number: 'Rollen-Nummer',
  name: 'Rollen-Name',
}

/**
 * Der Buchstabe zur Nummer — nur 1..26.
 *
 * Jenseits davon gibt es KEINEN. Ein zweistelliges Schema („AA") waere eine
 * Regel, die dieses Haus nie vereinbart hat, und der Beleg nennt genau einen
 * Buchstaben. Die Antwort ist deshalb `null` und nicht ein erfundenes Kuerzel.
 */
export const cameraLetter = (n: number | undefined): string | null => {
  if (n === undefined || !Number.isInteger(n) || n < 1 || n > 26) return null
  return String.fromCharCode(64 + n)
}

/**
 * Der Rollen-Name als Karten-Praefix.
 *
 * Karten-Ordner und Media-Manager vertragen keine Umlaute und keine
 * Leerzeichen zuverlaessig — das ist derselbe Grund, aus dem `danteNaming`
 * existiert. Bereinigt wird deshalb auf ASCII-Buchstaben, Ziffern und
 * Unterstrich; alles andere wird EIN Unterstrich, und Raender fallen weg.
 *
 * Bleibt nichts uebrig (eine Rolle, die nur aus Sonderzeichen besteht), ist
 * das Ergebnis der leere String — und der Aufrufer nennt das, statt einen
 * Namen zu erfinden.
 */
export const sanitisePrefix = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/** Wo die Aufzeichnung dieser Rolle landet. */
export type RecordBinding =
  /** Ein Mischer mit ISO-Aufzeichnung: der Kanal ist der Eingang. */
  | { kind: 'switcher-iso'; recorder: string; channel: number }
  /** Ein eigener Recorder: das Geraet und sein Eingang. */
  | { kind: 'recorder'; recorder: string; input: number }
  /** Kein Recorder im Plan — eine Auskunft, keine Luecke. */
  | { kind: 'none' }

export interface HandoverRow {
  roleId: string
  roleName: string
  roleNumber?: number
  /** Das Praefix, unter dem die Post diese Rolle wiederfindet. */
  cardPrefix: string
  cardPrefixBasis: CardPrefixBasis
  /** Geraet, das die Rolle realisiert. */
  equipmentId: string
  equipmentName: string
  /** Mischer und Eingang — fehlt, wenn die Rolle keinen erreicht. */
  switcherName?: string
  switcherInput?: number
  record: RecordBinding
}

export interface HandoverGap {
  roleId: string
  roleName: string
  /** Klartext, warum diese Rolle nicht auf dem Blatt steht. */
  reason: string
}

export interface HandoverManifest {
  rows: HandoverRow[]
  /**
   * Rollen ohne Geraet — sie haben keine Zeile, weil es nichts gibt, das
   * aufgezeichnet wird. GERECHNET und nicht gefuehrt: wer das Geraet
   * zuordnet, sieht die Luecke von selbst verschwinden.
   */
  gaps: HandoverGap[]
}

const NO_PREFIX = 'ohne Praefix'

/**
 * Das Praefix einer Rolle, samt seiner Grundlage.
 *
 * DIE ENGSTELLE fuer die Beschriftung: Blatt, CSV und jede kuenftige Ausgabe
 * lesen dieselbe Ableitung. Zwei Ableitungen koennten sich unterscheiden, und
 * dann trueg die Karte im Koffer einen anderen Buchstaben als die Liste, mit
 * der die Post sie sucht — genau der Zustand, den der Bedarf beklagt.
 */
export const cardPrefixFor = (role: {
  name: string
  number?: number
}): { prefix: string; basis: CardPrefixBasis } => {
  const letter = cameraLetter(role.number)
  if (letter) return { prefix: letter, basis: 'number' }
  const sauber = sanitisePrefix(role.name)
  return { prefix: sauber || NO_PREFIX, basis: 'name' }
}

/** Ein Eingang eines eigenen Recorders, samt der Quelle, die dort ankommt. */
interface RecorderInput {
  recorderId: string
  recorderName: string
  /** 1-basierte Position des Eingangs — die Nummer, die am Geraet steht. */
  inputIndex: number
  portId: string
  sourceEquipmentId: string
}

/**
 * Die Eingaenge aller eigenen Recorder im Plan, aufgeloest.
 *
 * `sources` aus `deriveLabels` hilft hier NICHT: es fuehrt nur Mischer- und
 * Router-Senken (`kind !== 'atem' && kind !== 'videohub'` faellt dort heraus).
 * Ein HyperDeck steht damit in keiner Zeile — nachgemessen, nicht vermutet:
 * die erste Fassung dieser Datei las `sources` und fand nie einen Recorder.
 *
 * Aufgeloest wird mit `resolveSignalSource`, also mit DERSELBEN
 * Rueckwaertssuche wie die Label-Ableitung. Eine eigene Traversierung waere
 * eine zweite Wahrheit ueber denselben Graphen.
 *
 * `isReferencePort` haelt Genlock-, Timecode- und Rueckweg-Eingaenge heraus.
 * Ohne diese Zeile zaehlte der Referenz-Eingang eines HyperDecks als
 * Aufnahmeweg, und auf dem Blatt staende der Sync-Generator als Motiv.
 */
const recorderInputsOf = (
  equipment: readonly { id: string; name: string; inputs: { id: string; name?: string }[] }[],
  ctx: ReturnType<typeof buildGraphContext>,
  isRecorder: (equipmentId: string) => ReturnType<typeof detectRecording>,
): RecorderInput[] => {
  const out: RecorderInput[] = []
  for (const device of equipment) {
    if (isRecorder(device.id) !== 'per-device') continue
    device.inputs.forEach((port, idx) => {
      const voll = ctx.portById.get(port.id)
      if (voll && isReferencePort(voll)) return
      const resolved = resolveSignalSource(port.id, ctx)
      if (!resolved) return
      out.push({
        recorderId: device.id,
        recorderName: device.name,
        inputIndex: idx + 1,
        portId: port.id,
        sourceEquipmentId: resolved.equipmentId,
      })
    })
  }
  return out
}

/**
 * Wo die Aufzeichnung dieser Rolle landet — aus dem Graph, nicht aus einem
 * zusaetzlichen Feld.
 *
 * Die Reihenfolge ist Absicht: erst der Mischer, den die Rolle ohnehin
 * speist. Zeichnet der selbst je Eingang auf, ist die Frage beantwortet und
 * die Nummer ist dieselbe, die auch Tally und UMD benutzen — eine zweite
 * Zahl fuer dieselbe Sache waere die zweite Wahrheit, gegen die ADR-001
 * geschrieben ist. Erst danach wird nach einem eigenen Recorder gesucht.
 */
const recordBindingFor = (
  recorderInputs: readonly RecorderInput[],
  eqById: Map<string, { id: string; name: string }>,
  isRecorder: (equipmentId: string) => ReturnType<typeof detectRecording>,
  deviceId: string,
  switcherLink: { sinkEquipmentId: string; inputIndex: number } | null | undefined,
): RecordBinding => {
  if (switcherLink && isRecorder(switcherLink.sinkEquipmentId) === 'per-input') {
    const mischer = eqById.get(switcherLink.sinkEquipmentId)
    if (mischer) {
      return { kind: 'switcher-iso', recorder: mischer.name, channel: switcherLink.inputIndex }
    }
  }
  // Deterministisch, aus demselben Grund wie in `switcherLinkFor`: die
  // Eingaenge folgen der Reihenfolge des `equipment`-Arrays, und ein `find()`
  // darauf machte das Blatt zu einer Funktion des Bearbeitungsverlaufs.
  const treffer = recorderInputs
    .filter((r) => r.sourceEquipmentId === deviceId)
    .sort(
      (a, b) =>
        a.inputIndex - b.inputIndex ||
        a.recorderId.localeCompare(b.recorderId) ||
        a.portId.localeCompare(b.portId),
    )[0]
  if (!treffer) return { kind: 'none' }
  return { kind: 'recorder', recorder: treffer.recorderName, input: treffer.inputIndex }
}

/**
 * Das Manifest fuer die Post.
 *
 * Eine Zeile je Rolle UND Geraet: ein Haupt-/Backup-Paar sind zwei
 * Aufzeichnungen und damit zwei Zeilen. Sie zu einer zusammenzuziehen
 * hiesse, die zweite verschwinden zu lassen — und das ist die, nach der
 * hinterher niemand sucht.
 */
export const buildHandoverManifest = (
  project: Pick<CablePlannerProject, 'equipment' | 'cables' | 'sourceIdentities'>,
): HandoverManifest => {
  const identities = project.sourceIdentities ?? []
  const { sources } = deriveLabels({
    equipment: project.equipment,
    cables: project.cables,
    sourceIdentities: identities,
  })
  // `buildGraphContext` liefert dieselbe Geraete-Auflösung, die auch die
  // Label-Ableitung benutzt — kein zweiter Index über dasselbe Array.
  const ctx = buildGraphContext(project.equipment, project.cables)
  const { eqById } = ctx
  const aufnahmeCache = new Map<string, ReturnType<typeof detectRecording>>()
  const isRecorder = (equipmentId: string) => {
    const bekannt = aufnahmeCache.get(equipmentId)
    if (bekannt !== undefined) return bekannt
    const device = eqById.get(equipmentId)
    const wert = device ? detectRecording(device) : null
    aufnahmeCache.set(equipmentId, wert)
    return wert
  }

  const recorderInputs = recorderInputsOf(project.equipment, ctx, isRecorder)

  const rows: HandoverRow[] = []
  const gaps: HandoverGap[] = []

  for (const identity of identities) {
    const devices = project.equipment.filter((e) => e.sourceIdentityId === identity.id)
    if (devices.length === 0) {
      gaps.push({
        roleId: identity.id,
        roleName: identity.name,
        reason: 'Der Rolle ist kein Gerät zugeordnet — es gibt nichts, was aufgezeichnet wird.',
      })
      continue
    }
    const { prefix, basis } = cardPrefixFor(identity)
    for (const device of devices) {
      const link = switcherLinkFor(sources, [device.id])
      const switcher = link ? eqById.get(link.sinkEquipmentId) : undefined
      rows.push({
        roleId: identity.id,
        roleName: identity.name,
        ...(identity.number !== undefined ? { roleNumber: identity.number } : {}),
        cardPrefix: prefix,
        cardPrefixBasis: basis,
        equipmentId: device.id,
        equipmentName: device.name,
        ...(switcher && link
          ? { switcherName: switcher.name, switcherInput: link.inputIndex }
          : {}),
        record: recordBindingFor(recorderInputs, eqById, isRecorder, device.id, link),
      })
    }
  }

  // Feste Ordnung, damit derselbe Plan zweimal dasselbe Blatt ergibt
  // (ADR-004): nach Rollen-Nummer, dann Name, dann Geraet. Ohne sie waere der
  // Fingerabdruck eine Funktion der Bearbeitungs-Reihenfolge.
  const nummer = (r: HandoverRow) => r.roleNumber ?? Number.MAX_SAFE_INTEGER
  rows.sort(
    (a, b) =>
      nummer(a) - nummer(b) ||
      a.roleName.localeCompare(b.roleName, 'de') ||
      a.equipmentName.localeCompare(b.equipmentName, 'de') ||
      a.equipmentId.localeCompare(b.equipmentId),
  )
  gaps.sort((a, b) => a.roleName.localeCompare(b.roleName, 'de') || a.roleId.localeCompare(b.roleId))

  return { rows, gaps }
}

/** Die Aufnahme-Spalte im Klartext. Kanonisches Deutsch — sie steht auf Papier. */
export const recordText = (binding: RecordBinding): string => {
  switch (binding.kind) {
    case 'switcher-iso':
      return `${binding.recorder} · ISO-Kanal ${binding.channel}`
    case 'recorder':
      return `${binding.recorder} · Eingang ${binding.input}`
    case 'none':
      return NO_RECORDER
  }
}

/**
 * Das Blatt.
 *
 * Die Praefix-Grundlage steht MIT auf dem Blatt. Ohne sie saehe ein „A" aus
 * der Nummer genauso aus wie ein „A" aus dem Namen — und wer zwei Shows
 * zusammenlegt, koennte nicht sehen, dass die eine Spalte eine Zusage ist und
 * die andere eine Bereinigung.
 */
export const handoverManifestTable = (manifest: HandoverManifest): CsvTable => ({
  headers: [
    'Karten-Präfix',
    'Grundlage',
    'Rolle',
    'Nummer',
    'Gerät',
    'Mischer',
    'Mischer-Eingang',
    'Aufzeichnung',
  ],
  rows: manifest.rows.map((r) => [
    r.cardPrefix,
    PREFIX_BASIS_LABEL[r.cardPrefixBasis],
    r.roleName,
    r.roleNumber ?? '',
    r.equipmentName,
    r.switcherName ?? NO_SWITCHER,
    r.switcherInput ?? '',
    recordText(r.record),
  ]),
})

/** Dasselbe Blatt direkt aus dem Projekt — der Weg fuer Register und Export. */
export const handoverManifestTableForProject = (
  project: Pick<CablePlannerProject, 'equipment' | 'cables' | 'sourceIdentities'>,
): CsvTable => handoverManifestTable(buildHandoverManifest(project))
