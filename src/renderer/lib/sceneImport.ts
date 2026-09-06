// ───────────────────────────────────────────────────────────────────────────
// Die Szenendatei des Pults lesen und zwei Stände vergleichen (Bedarf 92, P2).
//
// Warum es das gibt und wo die Grenze liegt, steht in `types/sceneImport.ts`.
// Hier steht, wie gelesen und wie verglichen wird.
//
// ─── DAS FORMAT, ZEILE FUER ZEILE ──────────────────────────────────────────
//
// Eine X32/M32-Szenendatei ist Text. Die Kanaele stehen als:
//
//   /ch/01/config "Kick" 1 RD 1
//    │    │       │      │ │  └ Icon-/Quellindex
//    │    │       │      │ └─── Farbe (RD, GN, YE …), teils mit „i" fuer invers
//    │    │       │      └───── Icon-Nummer
//    │    │       └──────────── Name in Anfuehrungszeichen
//    │    └──────────────────── Unterknoten
//    └───────────────────────── Kanal, zweistellig, 1-basiert
//
// Ein leerer Name steht als `""`. Genau der ist der interessante Fall: er
// heisst „dieser Kanal ist am Pult unbeschriftet", NICHT „diesen Kanal gibt es
// nicht" — und ein Import, der ihn wegliesse, machte aus einem Loch im
// Beschriftungsstreifen ein Loch in der Liste.
//
// ─── WAS BEIM VERGLEICH GEZAEHLT WIRD ──────────────────────────────────────
//
// Vier Faelle, und der vierte ist der, um den es geht:
//   `added`     Kanal war leer, ist jetzt beschriftet.
//   `removed`   Kanal war beschriftet, ist jetzt leer.
//   `renamed`   Beide beschriftet, anderer Name.
//   `recolored` Gleicher Name, andere Farbe.
//
// Der letzte sieht harmlos aus und ist es nicht: die Farbe ist am Pult die
// Gruppierung. Ein Kanal, der von Rot nach Gelb gewandert ist, ist in der
// Probe von den Drums zu den Vocals umgezogen — auf einem Blatt, das nur
// Namen vergleicht, ist das unsichtbar.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import {
  type SceneChannel,
  type SceneFormat,
  type SceneImport,
} from '../types/sceneImport'
import type { CsvTable } from './csv'

/**
 * Die Kanal-Zeile.
 *
 * `/ch/01/config "Kick" 1 RD 1` — Nummer, Name in Anfuehrungszeichen, danach
 * bis zu drei Felder. Name und Folgefelder sind optional, weil aeltere
 * Exporte kuerzere Zeilen schreiben; fehlt der Name ganz, ist die Zeile
 * unlesbar und wird gezaehlt statt still verworfen.
 */
const CHANNEL_LINE = /^\/ch\/(\d{1,2})\/config\s+"((?:[^"\\]|\\.)*)"(?:\s+(\S+))?(?:\s+(\S+))?/

/** Die `/mute`-Zeile desselben Kanals, wo eine Datei sie fuehrt. */
const MUTE_LINE = /^\/ch\/(\d{1,2})\/mix\s+(\S+)/

/**
 * Woran das Format erkannt wird.
 *
 * Es wird NICHT geraten: erkennt keine Marke, steht `unknown` da, und die
 * Kanaele werden trotzdem gelesen — die Zeilen sind laut Beleg dieselben. Eine
 * erfundene Marke auf dem Blatt waere schlechter als ein ehrliches „nicht
 * erkannt": jemand suchte den Fehler dann beim falschen Pult.
 */
const detectFormat = (text: string): SceneFormat => {
  if (/^#\d+\.\d+#\s*"?WING/im.test(text) || /\/\$syswing/i.test(text)) return 'wing'
  if (/^#\d+\.\d+#/m.test(text) || /^\/ch\/\d{1,2}\/config/m.test(text)) return 'x32'
  return 'unknown'
}

const unescape = (s: string): string => s.replace(/\\"/g, '"').replace(/\\\\/g, '\\')

/**
 * Liest eine Szenendatei.
 *
 * Doppelte Kanalzeilen: die ERSTE gewinnt. Dieselbe Regel wie ueberall sonst
 * beim Laden — und hier zusaetzlich, weil eine Szenendatei ihre Kanaele in
 * einem Block schreibt und ein zweiter Block meist aus einem angehaengten
 * zweiten Export stammt.
 */
export function parseSceneFile(text: string): SceneImport {
  const format = detectFormat(text)
  const byCh = new Map<number, SceneChannel>()
  const mutes = new Map<number, boolean>()
  let unreadable = 0

  for (const roh of text.split(/\r?\n/)) {
    const line = roh.trim()
    if (!line.startsWith('/ch/')) continue

    const m = CHANNEL_LINE.exec(line)
    if (m) {
      const ch = Number(m[1])
      // Kanal 0 gibt es nicht; eine Zeile, die einen behauptet, ist unlesbar.
      if (!Number.isInteger(ch) || ch < 1) {
        unreadable += 1
        continue
      }
      if (byCh.has(ch)) continue
      const eintrag: SceneChannel = { ch, name: unescape(m[2]) }
      // Feld 3 ist das Icon, Feld 4 die Farbe. Nur Buchstabenkuerzel wie „RD"
      // oder „RDi" gelten als Farbe — eine Zahl an der Stelle ist keine.
      //
      // `OFF` ist die Farbe „keine": das X32 schreibt sie fuer einen Streifen
      // ohne Farbe, und sie als Farbe zu fuehren waere ein Unterschied, den es
      // am Pult nicht gibt — der Vergleich meldete dann eine Farbaenderung, wo
      // jemand nur eine Farbe entfernt hat.
      const farbe = m[4]
      if (farbe && farbe !== 'OFF' && /^[A-Za-z]{2,3}$/.test(farbe)) eintrag.color = farbe
      byCh.set(ch, eintrag)
      continue
    }

    const mm = MUTE_LINE.exec(line)
    if (mm) {
      const ch = Number(mm[1])
      if (Number.isInteger(ch) && ch >= 1) mutes.set(ch, mm[2] === 'OFF')
      continue
    }

    // Sieht aus wie eine Kanalzeile, ist aber keine — z. B. ein abgeschnittener
    // Export. Wird gezaehlt, damit die Zahl auf dem Blatt stehen kann.
    if (/^\/ch\/\d{1,2}\/config/.test(line)) unreadable += 1
  }

  const channels = [...byCh.values()]
    .map((c) => (mutes.has(c.ch) ? { ...c, muted: mutes.get(c.ch) } : c))
    .sort((a, b) => a.ch - b.ch)

  return { format, channels, unreadable }
}

// ─── Der Vergleich zweier Uploads ──────────────────────────────────────────

export type SceneDiffKind = 'added' | 'removed' | 'renamed' | 'recolored'

export const SCENE_DIFF_LABEL: Readonly<Record<SceneDiffKind, string>> = {
  added: 'neu beschriftet',
  removed: 'Beschriftung entfernt',
  renamed: 'umbenannt',
  recolored: 'Farbe geändert',
}

export interface SceneDiffRow {
  ch: number
  kind: SceneDiffKind
  before: string
  after: string
  /** Nur bei `recolored` gesetzt. */
  beforeColor?: string
  afterColor?: string
}

const named = (c: SceneChannel | undefined): boolean => !!c && c.name.trim() !== ''

/**
 * Was sich zwischen zwei Ständen geändert hat.
 *
 * Kanaele, die in beiden Staenden unbeschriftet sind, stehen NICHT in der
 * Liste: bei 32 oder 48 Kanaelen waeren das die meisten Zeilen, und eine
 * Aenderungsliste, in der fast nichts eine Aenderung ist, wird nicht gelesen.
 */
export function diffScenes(vorher: SceneImport, nachher: SceneImport): SceneDiffRow[] {
  const a = new Map(vorher.channels.map((c) => [c.ch, c]))
  const b = new Map(nachher.channels.map((c) => [c.ch, c]))
  const alle = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x - y)
  const out: SceneDiffRow[] = []

  for (const ch of alle) {
    const va = a.get(ch)
    const vb = b.get(ch)
    const nameA = va?.name.trim() ?? ''
    const nameB = vb?.name.trim() ?? ''

    if (!named(va) && !named(vb)) continue
    if (!named(va)) {
      out.push({ ch, kind: 'added', before: nameA, after: nameB })
      continue
    }
    if (!named(vb)) {
      out.push({ ch, kind: 'removed', before: nameA, after: nameB })
      continue
    }
    if (nameA !== nameB) {
      out.push({ ch, kind: 'renamed', before: nameA, after: nameB })
      continue
    }
    // Gleicher Name, andere Farbe: am Pult ist die Farbe die Gruppierung.
    if ((va?.color ?? '') !== (vb?.color ?? '')) {
      out.push({
        ch,
        kind: 'recolored',
        before: nameA,
        after: nameB,
        ...(va?.color ? { beforeColor: va.color } : {}),
        ...(vb?.color ? { afterColor: vb.color } : {}),
      })
    }
  }
  return out
}

// Kanonisches Deutsch — dieselbe Regel wie bei allen Blaettern: ein Text, der
// mit der eingestellten Sprache wechselt, aendert den Stand des Dokuments.
const NO_NAME = 'unbeschriftet'
const NO_COLOR = 'keine Farbe'

/** Die eingelesene Liste als Blatt. */
export function sceneTable(scene: SceneImport): CsvTable {
  return {
    headers: ['Ch', 'Name', 'Farbe', 'Stumm'],
    rows: scene.channels.map((c) => [
      c.ch,
      c.name.trim() || NO_NAME,
      c.color ?? NO_COLOR,
      c.muted === undefined ? 'nicht angegeben' : c.muted ? 'ja' : 'nein',
    ]),
  }
}

/** Der Vergleich als Blatt — die Änderungsliste aus der Probe. */
export function sceneDiffTable(rows: readonly SceneDiffRow[]): CsvTable {
  return {
    headers: ['Ch', 'Was', 'Vorher', 'Nachher'],
    rows: rows.map((r) => [
      r.ch,
      SCENE_DIFF_LABEL[r.kind],
      r.kind === 'recolored' ? (r.beforeColor ?? NO_COLOR) : r.before || NO_NAME,
      r.kind === 'recolored' ? (r.afterColor ?? NO_COLOR) : r.after || NO_NAME,
    ]),
  }
}

// ─── Die Zuordnung zum Plan ────────────────────────────────────────────────

export type MatchMode =
  /** Ueber den Namen — der Normalfall. */
  | 'by-name'
  /** Ueber die Kanalnummer. NUR wenn der Nutzer sagt, dass sie stimmt. */
  | 'by-number'

export interface SceneMatch {
  sceneCh: number
  sceneName: string
  /** Die Kanalnummer im Plan, oder `undefined` fuer „nicht zugeordnet". */
  planCh?: number
  planSource?: string
}

/**
 * Ordnet die Pult-Kanäle den Plan-Kanälen zu.
 *
 * ÜBER DIE NUMMER NUR AUF ANSAGE. Ein Pult zaehlt seine Eingaenge, der Plan
 * zaehlt seine Kabel, und beide beginnen bei 1 — daraus eine Gleichung zu
 * machen waere die naheliegendste und teuerste Annahme dieses Moduls. Ueber
 * den Namen ist die Zuordnung eine Beobachtung („beide heissen Kick"), ueber
 * die Nummer eine Behauptung ueber die Verkabelung.
 *
 * Was sich nicht findet, bleibt ohne `planCh`. Das ist die Auskunft: dieser
 * Kanal steht am Pult und nirgends im Plan.
 */
export function matchToPlan(
  scene: SceneImport,
  plan: ReadonlyArray<{ ch: number; source: string }>,
  mode: MatchMode,
): SceneMatch[] {
  const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const byName = new Map<string, { ch: number; source: string }>()
  for (const p of plan) {
    const k = norm(p.source)
    // Erster gewinnt: zwei Plan-Kanaele mit demselben Quellnamen sind moeglich
    // (zwei Mikros „SM58"), und den zweiten stillschweigend zu bevorzugen
    // waere Zufall statt Regel.
    if (k && !byName.has(k)) byName.set(k, p)
  }
  const byNumber = new Map(plan.map((p) => [p.ch, p]))

  return scene.channels.map((c) => {
    const treffer =
      mode === 'by-number' ? byNumber.get(c.ch) : byName.get(norm(c.name))
    return {
      sceneCh: c.ch,
      sceneName: c.name.trim(),
      ...(treffer ? { planCh: treffer.ch, planSource: treffer.source } : {}),
    }
  })
}

/** Die Zuordnung als Blatt. Nicht Zugeordnetes trägt einen NAMEN. */
export function matchTable(matches: readonly SceneMatch[]): CsvTable {
  return {
    headers: ['Ch (Pult)', 'Name (Pult)', 'Ch (Plan)', 'Quelle (Plan)'],
    rows: matches.map((m) => [
      m.sceneCh,
      m.sceneName || NO_NAME,
      m.planCh ?? 'nicht zugeordnet',
      m.planSource ?? 'nicht im Plan',
    ]),
  }
}
