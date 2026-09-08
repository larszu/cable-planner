// ───────────────────────────────────────────────────────────────────────────
// ISSUE #664, zweite Haelfte — „mehrere Ebenen der Verkabelung anzeigbar
// machen fuer Festinstallationen. Zum Beispiel Kabel geht von a ueber b von b
// ueber c nach d. Bei d ist ein Patchbay und da geht es dann von d nach e und
// von e zum Endgeraet oder einem Wandanschluss."
//
// Der Plan kannte diese Kette bisher nur in Einzelteilen. Die Patchliste zeigt
// KABEL: eine Zeile je Steckverbindung, „von A Port 1 nach B Port 3". In einer
// Festinstallation liegen zwischen Kamera und Mischer aber drei bis fuenf
// solcher Zeilen — Wandanschluss, Steigleitung, zwei Blenden, Wandler — und
// keine davon sagt, was am anderen Ende haengt. Wer wissen will, wo Kamera 1
// tatsaechlich ankommt, liest sechs Zeilen und haelt die Portnummern im Kopf.
//
// Diese Datei setzt sie zusammen: eine Kette ist der Weg von der Quelle bis
// zum Endgeraet, mit allen Zwischenebenen darin.
//
// ─── WAS ALS DURCHLEITUNG GILT — UND WARUM NUR DAS ─────────────────────────
//
// Vier Bauformen, jede mit einem NACHPRUEFBAREN Weiterweg:
//
//   Patchblende  Position n hinten auf Position n vorn (`patchPanel.ts`).
//                Bauart, kein Betriebszustand.
//   Wandler      genau ein abgehendes Kabel — dieselbe Regel wie in der
//                Patchliste seit #285. Zwei Ausgangskabel: mehrdeutig, Ende.
//   Verteiler    ein Eingang auf mehrere Ausgaenge; die Kette VERZWEIGT sich
//                und laeuft in jedem Ast weiter.
//   Kreuzschiene NUR mit gesetztem Kreuzpunkt (`videohubRouting.planned`).
//                Ohne ihn gibt es 20 gleich plausible Antworten, und die
//                falsche zeigt auf die falsche Kamera. Dann: Ende, benannt.
//
// Ein Mischer leitet nicht durch — er ist das Ziel. Ein Geraet ohne Markierung
// ebenfalls: geraten wird hier nichts, die Kette endet lieber frueh und sagt,
// warum.
//
// ─── WARUM DAS ENDE IMMER EINEN NAMEN HAT ──────────────────────────────────
//
// „Die Kette endet hier" ist als Anzeige wertlos, wenn offenbleibt, ob das
// Geraet das Ziel IST oder ob die Ableitung aufgegeben hat. Beides sieht auf
// dem Blatt gleich aus und bedeutet das Gegenteil. `ChainEnd` trennt die
// Faelle, und `endNote` traegt den Satz, den die Anzeige zeigt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import { detectDeviceKind } from './deviceKind'
import { isPatchPanelDevice, patchPanelCounterpart } from './patchPanel'
import { resolvePortLabel } from './portLabel'

/** Welche Bauform den Weiterweg hergegeben hat. */
export type PassThroughKind = 'patch-panel' | 'converter' | 'distribution-amp' | 'router'

export const PASS_THROUGH_LABEL: Readonly<Record<PassThroughKind, string>> = {
  'patch-panel': 'Patchfeld',
  converter: 'Wandler',
  'distribution-amp': 'Verteilverstärker',
  router: 'Kreuzschiene',
}

/** Warum die Kette aufhoert. Nie „einfach so". */
export type ChainEnd =
  /** Das letzte Geraet leitet nicht durch — es IST das Ziel. Der Wert heisst
   *  `ziel` und nicht `endgeraet`, weil der ASCII-Drift-Waechter jede
   *  ae/oe/ue-Ersatzform in einem String-Literal meldet — zu Recht: was in
   *  einem Literal steht, kann auf dem Blatt landen. */
  | 'ziel'
  /** Der Weiterweg am Geraet ist bestimmt, aber es haengt kein Kabel dran. */
  | 'nicht-verkabelt'
  /** Der Weiterweg ist nicht ableitbar (Blende ungleich bestueckt, Wandler mit
   *  mehreren Ausgangskabeln, Kreuzschiene ohne gesetzten Kreuzpunkt). */
  | 'mehrdeutig'
  /** Laenger als `MAX_LEVELS` Zwischenstationen — abgeschnitten, nicht zu Ende. */
  | 'zu-lang'
  /** Der Weg lief in sich zurueck. */
  | 'schleife'

export interface ChainStep {
  cableId: string
  /** Kabelnummer, sonst Name, sonst Typ — das, woran man es findet. */
  cableLabel: string
  fromEquipmentId: string
  fromEquipmentName: string
  fromPortId: string
  fromPortName: string
  toEquipmentId: string
  toEquipmentName: string
  toPortId: string
  toPortName: string
  /** Wie es an diesem ZIEL weitergeht; null heisst: hier ist Schluss. */
  through: PassThroughKind | null
}

export interface SignalChain {
  /** Stabil aus den Kabel-Ids — taugt als React-Key und ueber Neuladen hinweg. */
  id: string
  steps: ChainStep[]
  end: ChainEnd
  /** Klartext fuer die Anzeige; leer bei 'ziel'. */
  endNote: string
  /** Zwischenebenen (Blenden, Wandler, …). Ohne die ist es kein Mehr-Ebenen-Weg. */
  levels: number
}

/** Mehr Zwischenstationen hat auch eine grosse Festinstallation nicht. */
const MAX_LEVELS = 12

/** Schutz vor einer kombinatorischen Explosion bei stark verzweigten Verteilern. */
const MAX_CHAINS = 400

const portText = (port: Port | undefined, fallback: string): string =>
  port ? resolvePortLabel(port).text || port.name || fallback : fallback

const cableText = (c: Cable): string =>
  c.cableNumber?.trim() || c.name?.trim() || c.type || c.id

interface Forward {
  kind: PassThroughKind
  /** Die Kabel, auf denen es weitergeht. Leer heisst: Weiterweg unverkabelt. */
  cables: Cable[]
  /** Gesetzt, wenn der Weiterweg NICHT ableitbar war. */
  ambiguous?: string
}

/**
 * Wie es an `device` weitergeht, wenn das Signal an `arrivalPortId` ankam.
 *
 * null heisst: dieses Geraet leitet nicht durch — es ist das Ziel. Das ist
 * eine ANDERE Aussage als `ambiguous`, und die Anzeige haengt daran.
 */
const forwardFrom = (
  device: EquipmentItem,
  arrivalPortId: string,
  cablesFromEquipment: Map<string, Cable[]>,
  cablesFromPort: Map<string, Cable[]>,
): Forward | null => {
  if (isPatchPanelDevice(device)) {
    const other = patchPanelCounterpart(device, { id: arrivalPortId })
    if (!other) {
      return {
        kind: 'patch-panel',
        cables: [],
        ambiguous:
          device.inputs.length === device.outputs.length
            ? 'Anschluss gehört nicht zur Durchleitung des Patchfelds'
            : `Patchfeld ungleich bestückt (${device.inputs.length} hinten, ${device.outputs.length} vorn) — die Position sagt hier nichts`,
      }
    }
    return { kind: 'patch-panel', cables: cablesFromPort.get(other.id) ?? [] }
  }

  if (device.isDistributionAmp) {
    const outs = (cablesFromEquipment.get(device.id) ?? []).filter(
      (c) => c.fromPortId !== arrivalPortId,
    )
    return { kind: 'distribution-amp', cables: outs }
  }

  if (device.isConverter) {
    // #285 — dieselbe Regel wie in der Patchliste: genau ein Folgekabel.
    const outs = (cablesFromEquipment.get(device.id) ?? []).filter(
      (c) => c.fromPortId !== arrivalPortId,
    )
    if (outs.length > 1) {
      return {
        kind: 'converter',
        cables: [],
        ambiguous: `Wandler mit ${outs.length} abgehenden Kabeln — kein eindeutiger Weiterweg`,
      }
    }
    return { kind: 'converter', cables: outs }
  }

  if (detectDeviceKind(device) === 'videohub') {
    const planned = device.videohubRouting?.planned
    const inIdx = device.inputs.findIndex((p) => p.id === arrivalPortId)
    if (!planned || inIdx < 0) {
      return {
        kind: 'router',
        cables: [],
        ambiguous: 'Kreuzschiene ohne gesetzten Kreuzpunkt — der Weiterweg ist nicht geplant',
      }
    }
    const outs: Cable[] = []
    device.outputs.forEach((p, outIdx) => {
      if (planned[outIdx] === inIdx) outs.push(...(cablesFromPort.get(p.id) ?? []))
    })
    if (outs.length === 0) {
      return {
        kind: 'router',
        cables: [],
        ambiguous: 'Kreuzpunkt gesetzt, aber am geschalteten Ausgang hängt kein Kabel',
      }
    }
    return { kind: 'router', cables: outs }
  }

  return null
}

/**
 * Alle Signalwege des Projekts, die ueber mindestens eine Zwischenebene laufen.
 *
 * Direkte Verbindungen bleiben draussen: die stehen schon in der Patchliste,
 * und eine zweite Liste derselben Zeilen macht die interessanten unsichtbar.
 * Genau darum geht es im Issue — die MEHRSTUFIGEN Wege sind die, die man aus
 * den Einzelzeilen nicht mehr zusammenbekommt.
 */
/**
 * Zuschnitt der Suche.
 *
 * Beide Vorgaben halten das bisherige Verhalten, damit die vorhandenen
 * Aufrufer (Patchliste, Mehr-Ebenen-Ansicht) unveraendert bleiben.
 */
export interface ChainOptions {
  /**
   * Nur Wege, die an DIESEM Geraet beginnen.
   *
   * Wozu: „wo landet das Pruefbild von Kamera 1" ist dieselbe Traversierung,
   * nur mit einem Startpunkt. Sie ein zweites Mal zu schreiben waere die
   * Defektform `zwei-rechnungen` — zwei Wege durch dieselbe Kreuzschiene, die
   * beim naechsten Sonderfall auseinanderlaufen.
   */
  vonEquipmentId?: string
  /**
   * Auch direkte Verbindungen (ohne Zwischenebene) zurueckgeben.
   *
   * Fuer die Mehr-Ebenen-Ansicht bleiben sie draussen — sie stehen schon in
   * der Patchliste. Fuer die Frage „wo kommt es an" gehoeren sie dazu: ein
   * Monitor direkt am Mischer ist ein Ankunftsort wie jeder andere.
   */
  auchDirekte?: boolean
}

export const signalChains = (
  equipment: readonly EquipmentItem[],
  cables: readonly Cable[],
  opts: ChainOptions = {},
): SignalChain[] => {
  const eqById = new Map(equipment.map((e) => [e.id, e]))
  const portById = new Map<string, Port>()
  for (const e of equipment) for (const p of [...e.inputs, ...e.outputs]) portById.set(p.id, p)

  const cablesFromEquipment = new Map<string, Cable[]>()
  const cablesFromPort = new Map<string, Cable[]>()
  for (const c of cables) {
    const byEq = cablesFromEquipment.get(c.fromEquipmentId)
    if (byEq) byEq.push(c)
    else cablesFromEquipment.set(c.fromEquipmentId, [c])
    const byPort = cablesFromPort.get(c.fromPortId)
    if (byPort) byPort.push(c)
    else cablesFromPort.set(c.fromPortId, [c])
  }

  const stepOf = (c: Cable): ChainStep => {
    const from = eqById.get(c.fromEquipmentId)
    const to = eqById.get(c.toEquipmentId)
    return {
      cableId: c.id,
      cableLabel: cableText(c),
      fromEquipmentId: c.fromEquipmentId,
      fromEquipmentName: from?.name ?? '?',
      fromPortId: c.fromPortId,
      fromPortName: portText(portById.get(c.fromPortId), c.fromPortId),
      toEquipmentId: c.toEquipmentId,
      toEquipmentName: to?.name ?? '?',
      toPortId: c.toPortId,
      toPortName: portText(portById.get(c.toPortId), c.toPortId),
      through: null,
    }
  }

  // Ein Kabel, das selbst schon die FORTSETZUNG eines anderen ist, faengt
  // keine eigene Kette an — sonst stuende jeder Weg mehrfach da, einmal ab
  // jeder Zwischenebene.
  const continuation = new Set<string>()
  for (const c of cables) {
    const to = eqById.get(c.toEquipmentId)
    if (!to) continue
    const fw = forwardFrom(to, c.toPortId, cablesFromEquipment, cablesFromPort)
    if (fw) for (const next of fw.cables) continuation.add(next.id)
  }

  const out: SignalChain[] = []

  const walk = (steps: ChainStep[], seenCables: Set<string>) => {
    if (out.length >= MAX_CHAINS) return
    const last = steps[steps.length - 1]
    const device = eqById.get(last.toEquipmentId)

    const finish = (end: ChainEnd, endNote: string) => {
      const levels = steps.filter((s) => s.through !== null).length
      if (levels === 0 && !opts.auchDirekte) return
      out.push({
        id: steps.map((s) => s.cableId).join('>'),
        steps,
        end,
        endNote,
        levels,
      })
    }

    if (!device) return finish('mehrdeutig', 'Zielgerät steht nicht mehr im Plan')

    const fw = forwardFrom(device, last.toPortId, cablesFromEquipment, cablesFromPort)
    if (!fw) return finish('ziel', '')
    if (fw.ambiguous) {
      last.through = null
      return finish('mehrdeutig', `${PASS_THROUGH_LABEL[fw.kind]}: ${fw.ambiguous}`)
    }
    if (fw.cables.length === 0) {
      last.through = null
      return finish(
        'nicht-verkabelt',
        `${PASS_THROUGH_LABEL[fw.kind]}: der Weiterweg ist im Plan nicht verkabelt`,
      )
    }
    if (steps.length > MAX_LEVELS) {
      last.through = fw.kind
      return finish('zu-lang', `Mehr als ${MAX_LEVELS} Zwischenstationen — hier abgeschnitten`)
    }

    last.through = fw.kind
    for (const next of fw.cables) {
      if (seenCables.has(next.id)) {
        finish('schleife', 'Der Weg läuft in sich zurück')
        continue
      }
      walk([...steps.slice(0, -1), { ...last }, stepOf(next)], new Set([...seenCables, next.id]))
    }
  }

  for (const c of cables) {
    if (opts.vonEquipmentId !== undefined) {
      // Mit gesetztem Startgeraet zaehlt NUR der Startpunkt, und die
      // Fortsetzungs-Sperre gilt nicht: ein Kabel aus diesem Geraet heraus
      // ist ein gueltiger Anfang, auch wenn es anderswo die Fortsetzung
      // eines laengeren Weges ist. Ohne diese Ausnahme faenden wir vom
      // Mischer aus keinen einzigen Weg, sobald etwas in ihn hineinfuehrt.
      if (c.fromEquipmentId !== opts.vonEquipmentId) continue
    } else if (continuation.has(c.id)) {
      continue
    }
    walk([stepOf(c)], new Set([c.id]))
  }

  return out
}

/** Eine Kette als eine Zeile — fuer Ausdruck, CSV und Tooltip. */
export const chainOneLine = (chain: SignalChain): string => {
  const first = chain.steps[0]
  const parts = [`${first.fromEquipmentName} · ${first.fromPortName}`]
  for (const s of chain.steps) {
    parts.push(`—[${s.cableLabel}]→ ${s.toEquipmentName} · ${s.toPortName}`)
  }
  return parts.join(' ')
}
