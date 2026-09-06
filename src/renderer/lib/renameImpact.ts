// ───────────────────────────────────────────────────────────────────────────
// Umbenennen kostet EINE Änderung — und man sieht vorher, wo sie ankommt
// (Bedarf 101, P3).
//
//   > A renamed preset or source has to be re-typed on every button that
//   > references it, on every page; label editing happens several times a day
//   > during show weeks.
//
// Belegt an `bitfocus/companion#1266` (2022) — dort für PTZ-Presets auf drei
// Seiten: „if I want to change the name of a preset … I have to change the
// names of all three buttons one by one" — und an `bitfocus/companion#4324`
// (2026, offen): die zusätzlichen Klicks „add up very quickly … when changing
// labels several times a day".
//
// ─── WAS HIER SCHON GELÖST WAR, UND WAS NICHT ──────────────────────────────
//
// Die eine Änderung gibt es in diesem Plan seit ADR-001: eine `SourceIdentity`
// ist eine ROLLE, Geräte binden sich an ihre `id`, und jedes abgeleitete
// Artefakt liest den Namen über `deriveLabels` nach. Wer die Rolle umbenennt,
// hat damit ALLE Blätter umbenannt — ohne dieses Modul.
//
// Was fehlte, ist die andere Hälfte des Belegs: die Gewissheit. Wer in
// Companion drei Knöpfe von Hand nachzieht, SIEHT wenigstens, was er anfasst.
// Wer hier ein Feld ändert, sieht nichts — und muss darauf vertrauen, dass es
// überall angekommen ist. Dieses Modul beantwortet das, bevor die Änderung
// passiert, und es beantwortet es mit derselben Ableitung, aus der die
// Exporter ihre Texte ziehen: `deriveLabels` einmal mit dem alten und einmal
// mit dem neuen Namen, und die Differenz IST die Liste der Blätter. Eine von
// Hand gepflegte Aufzählung wäre schon beim nächsten Zielsystem falsch.
//
// ─── DIE ZWEI UNANGENEHMEN BEFUNDE ─────────────────────────────────────────
//
//   1. **Die Umbenennung kommt beim Ziel gar nicht an.** Der ATEM-Kurzname
//      hat 4 Byte. „Kamera 1" und „Kamera 1 (Havarie)" landen dort auf
//      demselben Text. Das Blatt ändert sich, der Multiviewer nicht — und das
//      ist genau die Sorte Überraschung, die man in der Sendung entdeckt.
//      `unchangedAtTarget` sagt es vorher.
//
//   2. **Irgendwo steht der alte Name abgetippt.** Ein Portlabel „Cam1", ein
//      Kabelname, eine Notiz. Diese Stellen folgen der Rolle NICHT — sie sind
//      der Rest des Marktproblems innerhalb des eigenen Modells, und sie
//      stumm stehen zu lassen hiesse, die Zusage „eine Änderung" zu brechen.
//      Sie werden benannt, nicht automatisch mitgeändert: ob „Cam1" in einer
//      Notiz diese Rolle meint, weiss nur der Mensch.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { SourceIdentity } from '../types/sourceIdentity'
import { deriveLabels, type LabelCandidate } from './labelDerivation'
import {
  LABEL_TARGETS,
  fitToTarget,
  type FittedLabel,
  type LabelTargetId,
} from './labelTargets'
import type { CsvTable } from './csv'

/** Warum eine Umbenennung nicht ausgeführt wird. */
export type RenameRefusal =
  /** Die Rolle gibt es nicht (mehr). */
  | 'unknown-role'
  /** Leerer Name — eine namenlose Rolle kann niemand zuweisen. */
  | 'empty-name'
  /** Der Name ist schon der aktuelle. */
  | 'same-name'
  /** Eine ANDERE Rolle heisst bereits so. */
  | 'name-taken'

export const RENAME_REFUSAL_LABEL: Readonly<Record<RenameRefusal, string>> = {
  'unknown-role': 'Diese Rolle gibt es nicht mehr.',
  'empty-name': 'Ohne Namen lässt sich die Rolle niemandem zuweisen.',
  'same-name': 'Der Name steht schon so da.',
  'name-taken':
    'Eine andere Rolle heisst bereits so — zwei gleichnamige Rollen sind auf ' +
    'dem Multiviewer nicht mehr auseinanderzuhalten.',
}

/** Ein Ort, an dem der Name des Ziels wirklich ankommt. */
export interface RenameLanding {
  /** Stabiler Schlüssel aus der Ableitung — als React-key nutzbar. */
  key: string
  targetId: LabelTargetId
  /** Zielsystem und Feld im Klartext („ATEM · Kurzname"). */
  target: string
  /** Menschliche Verortung („ATEM 1 · In 3"). */
  where: string
  /** Was das Zielsystem HEUTE speichert. */
  before: string
  /** Was es nach der Umbenennung speichert. */
  after: string
  /** true: der neue Text wird beim Ziel gekürzt. */
  truncated: boolean
  /**
   * true: vorher und nachher sind beim Ziel identisch.
   *
   * Der unangenehme Fall. Das Blatt ändert sich, das Gerät nicht — weil das
   * Budget die Unterscheidung wegschneidet.
   */
  unchangedAtTarget: boolean
  /** Zeichen aus dem neuen Namen, die das Ziel nicht transportieren kann. */
  invalidChars: string[]
}

/** Ein Feld, in dem der alte Name ABGETIPPT steht und deshalb stehen bleibt. */
export interface RenameStraggler {
  /** Verortung („Kamera links" / „Kabel Cam1 → ATEM"). */
  where: string
  /** Welches Feld — im Klartext, nicht als Pfad. */
  field: string
  /** Der Text, wie er dort steht. */
  text: string
}

export interface RenameImpact {
  refusal?: RenameRefusal
  oldName: string
  newName: string
  /** Orte, an denen die eine Änderung ankommt. */
  landings: RenameLanding[]
  /** Felder mit abgetipptem alten Namen. Folgen NICHT. */
  stragglers: RenameStraggler[]
}

export interface RenameInput {
  equipment: EquipmentItem[]
  cables: Cable[]
  sourceIdentities: SourceIdentity[]
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Prüft die Umbenennung, ohne sie auszuführen.
 *
 * Getrennt von `renameImpact`, weil der Store die Absage braucht und die
 * Auswirkung nicht: eine Ablehnung ist eine Ja/Nein-Frage, die Vorschau ist
 * eine Rechnung über den ganzen Graphen.
 */
export function renameRefusal(
  identities: readonly SourceIdentity[],
  id: string,
  newName: string,
): RenameRefusal | null {
  const role = identities.find((s) => s.id === id)
  if (!role) return 'unknown-role'
  const next = newName.trim()
  if (!next) return 'empty-name'
  if (next === role.name.trim()) return 'same-name'
  if (identities.some((s) => s.id !== id && norm(s.name) === norm(next))) return 'name-taken'
  return null
}

/**
 * Ein Wort und kein Wortteil.
 *
 * Ohne die Grenze meldet eine Rolle namens „A" jedes Gerät im Plan. Die
 * Nachbarn dürfen keine Buchstaben oder Ziffern sein; Bindestrich, Punkt,
 * Schrägstrich und Leerzeichen zählen als Grenze — „Cam1-Backup" enthält
 * „Cam1", und genau das soll gemeldet werden.
 */
const containsWord = (haystack: string, needle: string): boolean => {
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (!n) return false
  let from = 0
  for (;;) {
    const i = h.indexOf(n, from)
    if (i < 0) return false
    const vor = i > 0 ? h[i - 1] : ''
    const nach = i + n.length < h.length ? h[i + n.length] : ''
    const wort = /[\p{L}\p{N}]/u
    if (!wort.test(vor) && !wort.test(nach)) return true
    from = i + 1
  }
}

/**
 * Felder, in denen ein Mensch den Rollennamen abtippen kann und die auf einem
 * Blatt landen. Bewusst kurz und einzeln begründet — eine Volltextsuche über
 * das ganze Projekt meldete jede Zufalls-Übereinstimmung und wäre nach dem
 * dritten Fehlalarm abgeschaltet.
 */
const stragglersIn = (
  { equipment, cables }: RenameInput,
  oldName: string,
  identityId: string,
): RenameStraggler[] => {
  const out: RenameStraggler[] = []
  const treffer = (where: string, field: string, text: string | undefined) => {
    if (text && containsWord(text, oldName)) out.push({ where, field, text })
  }

  for (const device of equipment) {
    // Der Gerätename steht auf dem Canvas, in der Stückliste und auf jedem
    // Label-Bogen. Er folgt der Rolle NICHT — das ist Absicht (das Blech
    // heisst, wie es heisst), aber wer „Kamera 1" als Gerätenamen getippt
    // hat, meint meistens die Rolle.
    treffer(device.name, 'Gerätename', device.name)
    treffer(device.name, 'Kurzname', device.shortName)
    treffer(device.name, 'Untertitel', device.subtitle)
    treffer(device.name, 'Notiz', device.notes)
    for (const port of [...device.inputs, ...device.outputs]) {
      // `contentLabel` ist der Text, den die Exporter nehmen, wo KEINE Rolle
      // gebunden ist. Steht dort der alte Name, zeigt das Zielsystem ihn
      // nach der Umbenennung weiter.
      treffer(`${device.name} · ${port.name || 'Port'}`, 'Port-Inhalt', port.contentLabel)
      treffer(`${device.name} · ${port.name || 'Port'}`, 'Portname', port.name)
    }
  }
  for (const cable of cables) {
    // Der Kabelname steht auf dem Etikett, das im Saal am Kabel klebt. Er
    // wird nicht nachgedruckt, wenn eine Rolle umbenannt wird.
    treffer(cable.name || 'Kabel', 'Kabelname', cable.name)
    treffer(cable.name || 'Kabel', 'Kabelnotiz', cable.notes)
  }

  // Geräte, die die Rolle TRAGEN, tragen ihren Namen oft doppelt — einmal als
  // Bindung, einmal abgetippt. Das ist kein zweiter Befund, sondern derselbe.
  const gebunden = new Set(
    equipment.filter((e) => e.sourceIdentityId === identityId).map((e) => e.name),
  )
  return out.filter((s) => !(s.field === 'Gerätename' && gebunden.has(s.text)))
}

const targetLabel = (id: LabelTargetId): string =>
  `${LABEL_TARGETS[id].system} · ${LABEL_TARGETS[id].field}`

const fittedByKey = (candidates: LabelCandidate[]): Map<string, FittedLabel & { where: string }> => {
  const out = new Map<string, FittedLabel & { where: string }>()
  for (const c of candidates) {
    out.set(c.key, { ...fitToTarget(c.raw, LABEL_TARGETS[c.targetId], c.sourceText), where: c.where })
  }
  return out
}

/**
 * Was die eine Änderung bewirkt — berechnet, nicht behauptet.
 *
 * Die Ableitung läuft zweimal: einmal wie sie heute ist, einmal mit der
 * umbenannten Rolle. Was sich dazwischen unterscheidet, IST die Liste der
 * Blätter. Deshalb kann sie nicht veralten, wenn ein sechstes Zielsystem
 * dazukommt.
 */
export function renameImpact(input: RenameInput, id: string, newName: string): RenameImpact {
  const role = input.sourceIdentities.find((s) => s.id === id)
  const oldName = role?.name ?? ''
  const next = newName.trim()
  const refusal = renameRefusal(input.sourceIdentities, id, newName)
  if (refusal) return { refusal, oldName, newName: next, landings: [], stragglers: [] }

  const vorher = fittedByKey(
    deriveLabels({
      equipment: input.equipment,
      cables: input.cables,
      sourceIdentities: input.sourceIdentities,
    }).candidates,
  )
  const nachher = fittedByKey(
    deriveLabels({
      equipment: input.equipment,
      cables: input.cables,
      sourceIdentities: input.sourceIdentities.map((s) =>
        s.id === id ? { ...s, name: next } : s,
      ),
    }).candidates,
  )

  const landings: RenameLanding[] = []
  for (const [key, neu] of nachher) {
    const alt = vorher.get(key)
    // Nur was sich im WUNSCHTEXT unterscheidet, ist eine Landung. Ein
    // Kandidat, dessen Text die Rolle gar nicht speist, bliebe sonst als
    // „unverändert" in der Liste und machte sie unlesbar.
    if (!alt || alt.raw === neu.raw) continue
    landings.push({
      key,
      targetId: neu.targetId,
      target: targetLabel(neu.targetId),
      where: neu.where,
      before: alt.value,
      after: neu.value,
      truncated: neu.truncated,
      unchangedAtTarget: alt.value === neu.value,
      invalidChars: neu.invalidChars,
    })
  }
  landings.sort((a, b) => a.target.localeCompare(b.target) || a.where.localeCompare(b.where))

  return {
    oldName,
    newName: next,
    landings,
    stragglers: stragglersIn(input, oldName, id),
  }
}

/** Landungen, bei denen die Umbenennung beim Ziel NICHT ankommt. */
export const swallowedLandings = (impact: RenameImpact): RenameLanding[] =>
  impact.landings.filter((l) => l.unchangedAtTarget)

export const RENAME_TABLE_HEADERS = ['Zielsystem', 'Ort', 'Vorher', 'Nachher', 'Hinweis'] as const

const hinweis = (l: RenameLanding): string => {
  const teile: string[] = []
  if (l.unchangedAtTarget) teile.push('kommt hier NICHT an (Budget)')
  else if (l.truncated) teile.push('gekürzt')
  if (l.invalidChars.length) teile.push(`nicht darstellbar: ${l.invalidChars.join(' ')}`)
  return teile.join('; ')
}

/** Die Vorschau als Tabelle — für den Unterlagen-Stapel und den CSV-Export. */
export const renameTable = (impact: RenameImpact): CsvTable => ({
  headers: [...RENAME_TABLE_HEADERS],
  rows: impact.landings.map((l) => [l.target, l.where, l.before, l.after, hinweis(l)]),
})
