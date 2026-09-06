// ───────────────────────────────────────────────────────────────────────────
// Der Namens-Generator (Bedarf 74, P2).
//
// Warum es ihn gibt und was er ausdruecklich nicht tut, steht in
// `types/namingScheme.ts`. Hier steht, was gerechnet und was geprueft wird.
//
// ─── DIE PRUEFUNG IST DER EIGENTLICHE WERT ─────────────────────────────────
//
// Namen erzeugen kann eine Zeichenkettenverkettung. Was fehlt, ist die
// Antwort auf „was richtet das an": zwei Geraete mit demselben Namen, ein
// Name, den ein Dante-Geraet nicht traegt, und — der teuerste Fall — ein
// Name, der irgendwo im Plan als TEXT steht und nach dem Umbenennen ins Leere
// zeigt.
//
// ─── WARUM DIE 31 ZEICHEN NUR FUER DANTE-GERAETE GELTEN ────────────────────
//
// Die Grenze kommt aus der Audinate-Dokumentation und gilt fuer Dante. Sie auf
// jedes Geraet im Plan anzuwenden waere eine Behauptung ueber Fremdsysteme,
// fuer die hier keine Fundstelle liegt — und sie wuerde Namen beanstanden, die
// vollkommen in Ordnung sind. Gemeldet wird sie deshalb nur, wenn das Geraet
// eine Dante-Schnittstelle fuehrt.
//
// ─── DER BLICK AUF DEN PATCH, DEN DER PLAN NICHT HAT ───────────────────────
//
// Der Beleg sagt: „renaming a transmit channel breaks existing subscriptions
// on firmware 4.3+". Diese Anwendung kennt den Subscription-Satz nicht — sie
// hat ihn nie gesehen und wird ihn nicht raten. Was sie kennt, ist die
// Tatsache, DASS ein Geraet am Dante-Netz haengt. Genau das sagt der Befund:
// eine Warnung ueber eine Folge, keine Behauptung ueber einen Zustand.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem } from '../types/equipment'
import {
  DANTE_NAME_LIMIT,
  DANTE_NAME_LIMIT_SOURCE,
  type NameProposal,
  type NameSegment,
  type NamingScheme,
} from '../types/namingScheme'
import { locationNameForEquipment } from './equipmentLocation'
import type { CsvTable } from './csv'

export type NamingFindingKind =
  | 'duplicate-name'
  | 'empty-name'
  | 'too-long-for-dante'
  | 'dante-subscription-risk'
  | 'name-in-free-text'
  | 'no-change'
  | 'scope-empty'

export const NAMING_FINDING_LABEL: Readonly<Record<NamingFindingKind, string>> = {
  'duplicate-name': 'Zwei Geräte bekämen denselben Namen',
  'empty-name': 'Die Regel ergibt für dieses Gerät keinen Namen',
  'too-long-for-dante': 'Länger als ein Dante-Name sein darf',
  'dante-subscription-risk': 'Umbenennung am Dante-Netz — Subscriptions brechen',
  'name-in-free-text': 'Der alte Name steht im Klartext im Plan',
  'no-change': 'Die Regel ändert nichts',
  'scope-empty': 'Die Regel trifft kein Gerät',
}

export interface NamingFinding {
  kind: NamingFindingKind
  text: string
  /** Das betroffene Geraet, fuer den Sprung. Leer bei regelweiten Befunden. */
  equipmentId?: string
}

export interface NamingAssessment {
  /** Nur die Geraete, deren Name sich aendern wuerde. */
  proposals: NameProposal[]
  /** Alle vom Filter getroffenen Geraete, auch die unveraenderten. */
  inScope: number
  findings: NamingFinding[]
  /**
   * Ob `applyNamingScheme` anwenden wuerde. `false` heisst nicht „nichts zu
   * tun", sondern „nicht ohne Schaden" — der Grund steht in den Befunden.
   */
  applicable: boolean
}

const DANTE_ROLES = new Set(['dante-primary', 'dante-secondary'])

/** Fuehrt das Geraet eine Dante-Schnittstelle? */
export const hasDanteInterface = (item: EquipmentItem): boolean =>
  (item.networkInterfaces ?? []).some((n) => DANTE_ROLES.has(String(n.role)))

const applyCase = (s: string, mode: NamingScheme['caseMode']): string =>
  mode === 'upper' ? s.toUpperCase() : mode === 'lower' ? s.toLowerCase() : s

const segmentValue = (
  seg: NameSegment,
  item: EquipmentItem,
  project: CablePlannerProject,
  index: number,
): string => {
  switch (seg.part) {
    case 'literal':
      return (seg.literal ?? '').trim()
    case 'category':
      return (item.category ?? '').trim()
    case 'location':
      return locationNameForEquipment(item, project.locations ?? [])?.trim() ?? ''
    case 'current':
      return (item.name ?? '').trim()
    case 'index':
      return String(index).padStart(Math.max(1, seg.pad ?? 1), '0')
  }
}

/**
 * Der Name, den die Regel fuer dieses Geraet ergaebe.
 *
 * LEERE TEILE FALLEN WEG, samt ihrem Trenner. Ein Geraet ohne Ort bekaeme
 * sonst „Video--01" — ein Name mit einem Loch darin, den jemand am Showtag
 * fuer einen Fehler haelt und von Hand „repariert".
 */
export function buildName(
  scheme: NamingScheme,
  item: EquipmentItem,
  project: CablePlannerProject,
  index: number,
): string {
  const teile = scheme.segments
    .map((s) => segmentValue(s, item, project, index))
    .filter((s) => s !== '')
  return applyCase(teile.join(scheme.separator), scheme.caseMode)
}

/** Die Geraete, auf die die Regel wirkt — in Plan-Reihenfolge, damit die
 *  laufende Nummer zwischen zwei Laeufen dieselbe bleibt. */
export const scopeOf = (project: CablePlannerProject, scheme: NamingScheme): EquipmentItem[] => {
  const filter = (scheme.categoryFilter ?? '').trim()
  if (!filter) return [...project.equipment]
  return project.equipment.filter((e) => (e.category ?? '').trim() === filter)
}

/**
 * Steht der alte Name irgendwo im Plan als TEXT?
 *
 * Der Plan verweist sonst ueberall per Id — das ist gut so und der Grund,
 * warum ein Umbenennen ueberhaupt gefahrlos moeglich ist. Was NICHT per Id
 * geht, sind die Freitexte, die Menschen getippt haben: Kabelnotizen,
 * Geraetenotizen, Antworten der Haus-IT. Dort steht der Name als Zeichenkette
 * und wird nach dem Umbenennen falsch, ohne dass irgendetwas bricht — die
 * teuerste Sorte Fehler, weil nichts auffaellt.
 */
export function freeTextHits(project: CablePlannerProject, name: string): number {
  const nadel = name.trim()
  if (!nadel) return 0
  const texte: string[] = []
  for (const c of project.cables) if (c.notes) texte.push(c.notes)
  for (const e of project.equipment) if (e.notes) texte.push(e.notes)
  for (const v of project.metadata.venueAnswers ?? []) if (v.note) texte.push(v.note)
  for (const d of project.deliveryDestinations ?? []) if (d.note) texte.push(d.note)
  return texte.filter((t) => t.includes(nadel)).length
}

export function assessNaming(
  project: CablePlannerProject,
  scheme: NamingScheme,
): NamingAssessment {
  const findings: NamingFinding[] = []
  const scope = scopeOf(project, scheme)

  if (scope.length === 0) {
    findings.push({
      kind: 'scope-empty',
      text: `Die Regel trifft kein Gerät${
        (scheme.categoryFilter ?? '').trim() ? ` der Kategorie „${scheme.categoryFilter}"` : ''
      }. Sie anzuwenden täte nichts — das steht hier, damit niemand auf ein stilles Nichts wartet.`,
    })
    return { proposals: [], inScope: 0, findings, applicable: false }
  }

  const alle = new Map<string, string[]>()
  const proposals: NameProposal[] = []
  // Erst die Namen ausserhalb des Geltungsbereichs eintragen: gegen die muss
  // ebenfalls auf Eindeutigkeit geprueft werden, sonst kollidiert die Regel
  // mit einem Geraet, das sie gar nicht anfasst.
  const imScope = new Set(scope.map((e) => e.id))
  for (const e of project.equipment) {
    if (imScope.has(e.id)) continue
    const n = (e.name ?? '').trim()
    if (n) alle.set(n, [...(alle.get(n) ?? []), e.name])
  }

  scope.forEach((item, i) => {
    const neu = buildName(scheme, item, project, i + 1)
    if (!neu) {
      findings.push({
        kind: 'empty-name',
        text: `Für „${item.name}" ergibt die Regel keinen Namen — alle Teile sind leer. Ein leerer Name wird nicht gesetzt.`,
        equipmentId: item.id,
      })
      return
    }
    alle.set(neu, [...(alle.get(neu) ?? []), item.name])
    if (neu !== (item.name ?? '').trim()) {
      proposals.push({ equipmentId: item.id, before: item.name, after: neu })
    }
  })

  for (const [name, traeger] of alle) {
    if (traeger.length < 2) continue
    findings.push({
      kind: 'duplicate-name',
      text: `„${name}" bekämen ${traeger.length} Geräte (${traeger.join(', ')}). Die Regel wird nicht angewandt: ein doppelter Name im Netz ist kein Schönheitsfehler, sondern zwei Geräte, die sich gegenseitig verdrängen.`,
    })
  }

  for (const p of proposals) {
    const item = project.equipment.find((e) => e.id === p.equipmentId)
    if (!item) continue
    if (hasDanteInterface(item)) {
      if (p.after.length > DANTE_NAME_LIMIT) {
        findings.push({
          kind: 'too-long-for-dante',
          text: `„${p.after}" hat ${p.after.length} Zeichen; ein Dante-Name trägt höchstens ${DANTE_NAME_LIMIT} (Quelle: ${DANTE_NAME_LIMIT_SOURCE}). Gekürzt wird hier nichts — eine automatisch gekürzte Kennung ist am Showtag nicht mehr die, die auf dem Blatt steht.`,
          equipmentId: p.equipmentId,
        })
      }
      findings.push({
        kind: 'dante-subscription-risk',
        text: `„${p.before}" hängt am Dante-Netz. Ab Firmware 4.3 bricht das Umbenennen eines Sendekanals bestehende Subscriptions — dieser Plan kennt den Subscription-Satz nicht und kann nicht sagen, welche; er sagt nur, dass es welche geben wird.`,
        equipmentId: p.equipmentId,
      })
    }
    const treffer = freeTextHits(project, p.before)
    if (treffer > 0) {
      findings.push({
        kind: 'name-in-free-text',
        text: `„${p.before}" steht ${treffer}× im Klartext in Notizen oder Antworten. Nach dem Umbenennen stimmt dort der Name nicht mehr, und nichts bricht dabei — deshalb fällt es niemandem auf.`,
        equipmentId: p.equipmentId,
      })
    }
  }

  if (proposals.length === 0) {
    findings.push({
      kind: 'no-change',
      text: `Die Regel ergibt für alle ${scope.length} getroffenen Geräte den Namen, den sie schon tragen. Es gibt nichts anzuwenden.`,
    })
  }

  const doppelt = findings.some((f) => f.kind === 'duplicate-name')
  return { proposals, inScope: scope.length, findings, applicable: proposals.length > 0 && !doppelt }
}

export type NamingRefusal = 'duplicates' | 'nothing-to-do'

export interface NamingApplyResult {
  project?: CablePlannerProject
  refused?: NamingRefusal
  proposals: NameProposal[]
}

/**
 * Wendet die Regel an — oder verweigert mit einem GRUND.
 *
 * Verweigert wird bei doppelten Namen. Das ist dieselbe Regel wie in
 * Bedarf 96: ein Vorgang, der still ueberschreibt, ist schlimmer als einer,
 * der nicht laeuft. Und die Verweigerung traegt ihren Namen, damit die
 * Oberflaeche sie zeigen kann, statt einen Knopf auszugrauen.
 */
export function applyNamingScheme(
  project: CablePlannerProject,
  scheme: NamingScheme,
): NamingApplyResult {
  const a = assessNaming(project, scheme)
  if (a.proposals.length === 0) return { refused: 'nothing-to-do', proposals: [] }
  if (!a.applicable) return { refused: 'duplicates', proposals: a.proposals }
  const byId = new Map(a.proposals.map((p) => [p.equipmentId, p.after]))
  return {
    project: {
      ...project,
      equipment: project.equipment.map((e) =>
        byId.has(e.id) ? { ...e, name: byId.get(e.id) as string } : e,
      ),
    },
    proposals: a.proposals,
  }
}

const NO_HIT = 'nein'

/** Die Spalten des Umbenennungssatzes. Einmal, damit die leere und die
 *  gefuellte Tabelle nicht auseinanderlaufen koennen. */
const RENAME_SET_HEADERS = [
  'Alter Name',
  'Neuer Name',
  'Zeichen',
  'Am Dante-Netz',
  'Im Klartext im Plan',
]

/**
 * Der Umbenennungssatz — alt neben neu.
 *
 * Das ist bewusst eine TABELLE und keine Dante-Preset-XML: das Schema haengt
 * an der Controller-Version, diese Anwendung hat es nie gesehen, und eine
 * Datei, die aussieht wie ein Preset, wird in ein laufendes Netz eingespielt.
 * Zum Abtippen taugt sie, und fuer das Suchen-und-Ersetzen, das Audinate
 * selbst empfiehlt, ist sie genau die richtige Form.
 */
export function renameSetTable(
  project: CablePlannerProject,
  scheme: NamingScheme | undefined = project.namingScheme,
): CsvTable {
  // Ohne Regel gibt es keinen Umbenennungssatz. Eine leere Tabelle ist hier
  // die wahre Antwort und kein Ausweichen — sie sagt „nichts umzubenennen".
  if (!scheme) return { headers: RENAME_SET_HEADERS, rows: [] }
  const a = assessNaming(project, scheme)
  return {
    headers: RENAME_SET_HEADERS,
    rows: a.proposals.map((p) => {
      const item = project.equipment.find((e) => e.id === p.equipmentId)
      const dante = item ? hasDanteInterface(item) : false
      const treffer = freeTextHits(project, p.before)
      return [
        p.before,
        p.after,
        p.after.length,
        dante ? `ja (Grenze ${DANTE_NAME_LIMIT})` : NO_HIT,
        treffer > 0 ? `${treffer}×` : NO_HIT,
      ]
    }),
  }
}

/**
 * Normalisiert ein gespeichertes Schema beim Laden.
 *
 * Ein Segment mit unbekanntem Teil fliegt raus — es koennte sonst still einen
 * leeren Namensteil erzeugen, und der faellt erst auf, wenn das Ergebnis
 * schon an fuenfzig Geraeten steht.
 */
export function normaliseNamingScheme(raw: unknown): NamingScheme | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const teile = new Set(['category', 'location', 'index', 'literal', 'current'])
  const segments: NameSegment[] = []
  for (const rawS of Array.isArray(o.segments) ? o.segments : []) {
    const s = (rawS ?? {}) as Record<string, unknown>
    if (typeof s.part !== 'string' || !teile.has(s.part)) continue
    const seg: NameSegment = { part: s.part as NameSegment['part'] }
    if (typeof s.literal === 'string' && s.literal.trim()) seg.literal = s.literal.trim()
    if (typeof s.pad === 'number' && s.pad >= 1 && s.pad <= 6) seg.pad = Math.floor(s.pad)
    segments.push(seg)
  }
  if (segments.length === 0) return undefined
  const caseMode: NamingScheme['caseMode'] =
    o.caseMode === 'upper' || o.caseMode === 'lower' ? o.caseMode : 'as-is'
  const separator = typeof o.separator === 'string' ? o.separator : '-'
  const categoryFilter =
    typeof o.categoryFilter === 'string' && o.categoryFilter.trim()
      ? o.categoryFilter.trim()
      : undefined
  return { segments, separator, caseMode, ...(categoryFilter ? { categoryFilter } : {}) }
}
