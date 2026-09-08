/**
 * Aus einer Sichtprüfung einen Befund machen (B-42, Inkrement 2).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE EINE AUSSAGE, WEGEN DER ES DIESE DATEI GIBT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * „Falsches Bild" ist ein Symptom. „Es steht KAMERA 3 drauf, wo KAMERA 1
 * stehen sollte" ist ein Befund. Und wenn am anderen Monitor umgekehrt
 * KAMERA 1 steht, wo KAMERA 3 hingehört, ist es kein Befund mehr, sondern
 * die Ursache: **zwei Ausgänge sind vertauscht.**
 *
 * Genau diese Verdichtung macht das Prüfbild-Verfahren wertvoll. Ohne sie
 * bleibt eine Liste von „stimmt nicht", die jemand von Hand
 * gegeneinanderhalten muss — und beim Umpatchen unter Zeitdruck tut das
 * niemand.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS DIESE DATEI NICHT TUT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Sie repariert nichts und schaltet nichts. Sie sagt, WAS jemand vorfand und
 * was das über den Plan bedeutet. Ob die Anlage falsch gepatcht ist oder der
 * Plan falsch gezeichnet, kann sie nicht wissen — beide Fälle sehen von hier
 * gleich aus, und deshalb heisst der Befund „vertauscht" und nicht
 * „Anlage falsch".
 *
 * Sie RÄT auch keinen Namen zurecht. Der gesehene Name wird gegen die
 * Geräte-Namen des Plans gehalten, normalisiert nur über Gross-/Kleinschreibung
 * und Randleerzeichen. Wer hier unscharf verglichen (Levenshtein, Präfix,
 * „enthält") machte aus einer Beobachtung eine Vermutung — und die stünde
 * dann als Befund da.
 */
import type { CablePlannerProject } from '../types/project'
import type { PatternCheck } from '../types/patternCheck'
import { PATTERN_OBSERVATION_LABEL } from '../types/patternCheck'
import { patternRouting, type PatternStop } from './patternRouting'

export type BefundArt =
  /** Gesehen wie erwartet. */
  | 'stimmt'
  /**
   * Der gesehene Name gehört zu einer anderen Quelle, UND dort wurde
   * umgekehrt diese hier gesehen. Beide Wege gehören getauscht.
   */
  | 'vertauscht'
  /**
   * Ein fremdes Bild, ohne Gegenstück. Entweder ist der Gegenort noch
   * ungeprüft, oder es ist keine paarweise Vertauschung.
   */
  | 'fremdes-bild'
  /** Kein Bild angekommen. */
  | 'kein-bild'
  /** Der Plan sieht hier eine Ankunft vor, es steht aber kein Monitor. */
  | 'kein-monitor'
  /**
   * Noch niemand hat hier hingesehen.
   *
   * Der Wert heisst `noch-offen` und nicht `ungeprueft`, weil der
   * ASCII-Drift-Waechter jede ae/oe/ue-Ersatzform in einem String-Literal
   * meldet — zu Recht: was in einem Literal steht, kann auf dem Blatt
   * landen. Dieselbe Entscheidung wie bei `ChainEnd.ziel` in
   * `signalChain.ts`.
   */
  | 'noch-offen'

export interface PatternBefund {
  equipmentId: string
  equipmentName: string
  portName: string
  art: BefundArt
  /** Bei `vertauscht`: der Ort, mit dem getauscht ist. */
  vertauschtMit?: { equipmentId: string; equipmentName: string }
  /** Der gesehene Name, wo einer gemeldet wurde. */
  gesehenerName?: string
  /** Zeitpunkt der jüngsten Prüfung, wo es eine gibt. */
  at?: string
  /** Klartext für Anzeige und Blatt. */
  text: string
}

/** Nur Gross-/Kleinschreibung und Randleerzeichen — bewusst nicht mehr. */
const norm = (s: string): string => s.trim().toLocaleLowerCase('de')

/**
 * Die jüngste Prüfung je Ankunftsort, für DIESE Quelle.
 *
 * Jüngste und nicht erste: „gestern ging es, heute nicht" ist die Auskunft,
 * die den Fehler findet, und der aktuelle Stand ist der letzte. Die älteren
 * bleiben im Projekt stehen — die Liste ist die Historie.
 */
export const juengsteChecks = (
  checks: readonly PatternCheck[],
  quelleId: string,
): Map<string, PatternCheck> => {
  const raus = new Map<string, PatternCheck>()
  for (const c of checks) {
    if (c.quelleId !== quelleId) continue
    const bisher = raus.get(c.equipmentId)
    if (!bisher || c.at > bisher.at) raus.set(c.equipmentId, c)
  }
  return raus
}

const textFuer = (b: Omit<PatternBefund, 'text'>, erwartet: string): string => {
  switch (b.art) {
    case 'stimmt':
      return `${erwartet} steht an, wie geplant.`
    case 'vertauscht':
      return `Vertauscht mit ${b.vertauschtMit?.equipmentName ?? '?'}: hier steht ${b.gesehenerName ?? '?'}, dort ${erwartet}.`
    case 'fremdes-bild':
      return `Hier steht ${b.gesehenerName ?? 'ein anderes Bild'}, erwartet war ${erwartet}.`
    case 'kein-bild':
      return `Kein Bild — erwartet war ${erwartet}.`
    case 'kein-monitor':
      return 'Der Plan sieht hier eine Ankunft vor, es steht aber kein Monitor.'
    case 'noch-offen':
      return `Noch nicht geprüft — erwartet wird ${erwartet}.`
  }
}

/**
 * Alle Ankunftsorte einer Quelle mit ihrem Befund.
 *
 * Ungeprüfte Orte stehen MIT DRIN, und zwar als eigener Befund. Eine Liste,
 * die nur die geprüften zeigt, sieht nach einer abgeschlossenen Abnahme aus,
 * sobald jemand drei von zwölf Monitoren angesehen hat.
 */
export const patternDiagnose = (
  project: CablePlannerProject,
  quelleId: string | undefined,
): PatternBefund[] => {
  if (!quelleId) return []
  const erwartet = project.equipment.find((e) => e.id === quelleId)?.name ?? ''
  const ziele: PatternStop[] = patternRouting(project, quelleId).ziele
  const checks = juengsteChecks(project.patternChecks ?? [], quelleId)

  // Name → Geraete-Id, fuer die Aufloesung des gesehenen Namens. Mehrere
  // Geraete duerfen denselben Namen tragen; dann ist die Aufloesung nicht
  // eindeutig und der Befund bleibt `fremdes-bild` — geraten wird nicht.
  const nachName = new Map<string, string[]>()
  for (const e of project.equipment) {
    const k = norm(e.name)
    const liste = nachName.get(k)
    if (liste) liste.push(e.id)
    else nachName.set(k, [e.id])
  }

  /** Welche Quelle steckt hinter dem gesehenen Namen? Eindeutig oder gar nicht. */
  const quelleHinter = (name: string | undefined): string | null => {
    if (!name) return null
    const treffer = nachName.get(norm(name))
    return treffer && treffer.length === 1 ? treffer[0] : null
  }

  const raus: PatternBefund[] = []
  for (const ziel of ziele) {
    const check = checks.get(ziel.equipmentId)
    const basis = {
      equipmentId: ziel.equipmentId,
      equipmentName: ziel.equipmentName,
      portName: ziel.portName,
      at: check?.at,
      gesehenerName: check?.gesehenerName,
    }

    if (!check) {
      raus.push({ ...basis, art: 'noch-offen', text: textFuer({ ...basis, art: 'noch-offen' }, erwartet) })
      continue
    }
    if (check.gesehen === 'stimmt' || check.gesehen === 'kein-bild' || check.gesehen === 'kein-monitor') {
      const art: BefundArt =
        check.gesehen === 'stimmt' ? 'stimmt' : check.gesehen === 'kein-bild' ? 'kein-bild' : 'kein-monitor'
      raus.push({ ...basis, art, text: textFuer({ ...basis, art }, erwartet) })
      continue
    }

    // `falsches-bild`. Steckt hinter dem gesehenen Namen eine Quelle, deren
    // eigener Weg HIERHER zeigt — und wurde an DEREN erwartetem Ort umgekehrt
    // unsere Quelle gesehen? Dann sind die beiden Wege getauscht.
    const andere = quelleHinter(check.gesehenerName)
    let vertauschtMit: PatternBefund['vertauschtMit']
    if (andere) {
      const gegenZiele = patternRouting(project, andere).ziele
      const gegenChecks = juengsteChecks(project.patternChecks ?? [], andere)
      for (const gz of gegenZiele) {
        const gc = gegenChecks.get(gz.equipmentId)
        if (!gc || gc.gesehen !== 'falsches-bild') continue
        if (quelleHinter(gc.gesehenerName) !== quelleId) continue
        vertauschtMit = { equipmentId: gz.equipmentId, equipmentName: gz.equipmentName }
        break
      }
    }
    const art: BefundArt = vertauschtMit ? 'vertauscht' : 'fremdes-bild'
    raus.push({ ...basis, art, vertauschtMit, text: textFuer({ ...basis, art, vertauschtMit }, erwartet) })
  }
  return raus
}

export interface DiagnoseSumme {
  stimmt: number
  vertauscht: number
  fremd: number
  keinBild: number
  keinMonitor: number
  ungeprueft: number
}

/** Die Zahlen für den Streifen. */
export const diagnoseSumme = (befunde: readonly PatternBefund[]): DiagnoseSumme => {
  const s: DiagnoseSumme = {
    stimmt: 0,
    vertauscht: 0,
    fremd: 0,
    keinBild: 0,
    keinMonitor: 0,
    ungeprueft: 0,
  }
  for (const b of befunde) {
    if (b.art === 'stimmt') s.stimmt++
    else if (b.art === 'vertauscht') s.vertauscht++
    else if (b.art === 'fremdes-bild') s.fremd++
    else if (b.art === 'kein-bild') s.keinBild++
    else if (b.art === 'kein-monitor') s.keinMonitor++
    else s.ungeprueft++
  }
  return s
}

/** Zeilen für das Abnahme-Blatt. */
export const diagnoseZeilen = (
  befunde: readonly PatternBefund[],
): { geraet: string; anschluss: string; befund: string; gesehen: string; zeitpunkt: string }[] =>
  befunde.map((b) => ({
    geraet: b.equipmentName,
    anschluss: b.portName,
    befund: b.text,
    gesehen: b.gesehenerName ?? '',
    zeitpunkt: b.at ?? '',
  }))

export { PATTERN_OBSERVATION_LABEL }
