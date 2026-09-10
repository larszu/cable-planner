// ───────────────────────────────────────────────────────────────────────────
// Ports, die zusammen EINEN Anschluss bilden (#832).
//
// Woertlich aus der Meldung des Eigentuemers: „Inputs und Outputs gruppieren.
// Z.b 2 Mono Klinken als ein Stereo kennzeichnen."
//
// ─── WAS DIESE DATEI BEANTWORTET, UND WAS SIE NICHT ENTSCHEIDET ────────────
//
// Sie liest, was am Port steht, und fasst es zusammen. Sie entscheidet NICHT,
// ob eine Gruppe „richtig" ist: welche Buchsen jemand als Paar fuehrt, weiss
// er selbst. Was sie meldet, ist der WIDERSPRUCH — eine Stereo-Gruppe mit
// drei Mitgliedern behauptet zwei Dinge gleichzeitig, und eines davon ist
// falsch.
//
// ─── DIE ERWARTETE GROESSE STEHT AN DER ART UND NICHT IM PRUEFCODE ─────────
//
// Sonst gaebe es sie zweimal: einmal als Zahl in der Pruefung, einmal als
// Annahme in der Oberflaeche, die die Rollen anbietet. Zwei Zahlen, die
// dasselbe meinen, laufen auseinander.
// ───────────────────────────────────────────────────────────────────────────
import type { Port, PortGroupKind } from '../types/equipment'
import { einsetzen, type Platzhalterwerte } from './platzhalter'

/**
 * Wie viele Ports eine Gruppe dieser Art hat — und welche Rollen sie kennt.
 *
 * `sonstige` hat KEINE erwartete Groesse (`undefined`). Das ist der Punkt der
 * Art: sie steht fuer Paarungen, die keine Liste vorwegnimmt, und eine
 * erfundene Zahl daneben machte aus „nicht festgelegt" ein „zwei".
 */
export const PORT_GROUP_INFO: Record<
  PortGroupKind,
  { groesse?: number; rollen: string[] }
> = {
  stereo: { groesse: 2, rollen: ['L', 'R'] },
  ms: { groesse: 2, rollen: ['M', 'S'] },
  sum: { groesse: 2, rollen: ['A', 'B'] },
  bridge: { groesse: 2, rollen: ['+', '-'] },
  // #665 — Ein Powerlock-Satz ist FUENF einzelne Verbinder, die zusammen EINE
  // Einspeisung bilden. Genau der Fall, den ein einzelnes Kabel nicht abbildet
  // und den die Gruppe traegt: vier davon zu stecken und den fuenften zu
  // vergessen ist kein halber Anschluss, sondern ein Fehler mit Folgen.
  powerlock: { groesse: 5, rollen: ['L1', 'L2', 'L3', 'N', 'PE'] },
  sonstige: { rollen: [] },
}

export interface PortGruppe {
  id: string
  art?: PortGroupKind
  ports: Port[]
}

/**
 * Die Gruppen einer Port-Liste, in der Reihenfolge ihres ersten Auftretens.
 *
 * Nur EINE Seite auf einmal uebergeben (Eingaenge ODER Ausgaenge). Eine
 * Gruppe ueber beide Seiten hinweg waere kein Anschluss, sondern eine
 * Durchschleife — und die ist etwas anderes, das es im Modell auch schon gibt.
 */
export const portGruppen = (ports: readonly Port[]): PortGruppe[] => {
  const nachId = new Map<string, PortGruppe>()
  for (const p of ports) {
    if (!p.portGroup) continue
    const vorhanden = nachId.get(p.portGroup)
    if (vorhanden) {
      vorhanden.ports.push(p)
      // Die erste genannte Art gewinnt. Zwei verschiedene Arten in einer
      // Gruppe meldet `gruppenBefunde` als Widerspruch — hier still die
      // zweite zu uebernehmen hiesse, ihn zu verstecken.
      if (!vorhanden.art) vorhanden.art = p.portGroupKind
    } else {
      nachId.set(p.portGroup, { id: p.portGroup, art: p.portGroupKind, ports: [p] })
    }
  }
  return [...nachId.values()]
}

/**
 * Der Satz zum Befund — sprachfrei, wie in `types/adapter.ts` und den anderen
 * Urteils-Modulen seit #837.
 *
 * WARUM DAS MODUL NICHT SELBST UEBERSETZT: es wird an ZWEI Stellen gelesen —
 * in der Eigenschaften-Leiste, wo `t()` aus dem Hook kommt, und im Plan-Check
 * auf dem gedruckten Blatt. Ein `tr()` hier drin haette beide an die
 * eingestellte Sprache gehaengt und jeden Test, der den Text prueft, auf einem
 * deutschen Rechner rot gemacht — dasselbe Argument wie in
 * `lib/checkCategoryLabel.ts`.
 *
 * ES IST AUCH DER GRUND, WARUM ES NUR EINE FASSUNG DES SATZES GIBT. Vorher
 * stand er in `PortList.tsx` und sonst nirgends; der Plan-Check haette ihn
 * zwangslaeufig ein zweites Mal formuliert, und zwei Fassungen desselben
 * Befundes waeren beim naechsten Umbau auseinandergelaufen.
 */
export interface GruppenSatz {
  /** Woerterbuch-Schluessel. */
  schluessel: string
  /** Der englische Satz mit eingesetzten Werten — Quelle und Fallback. */
  text: string
  /** Die Werte einzeln, damit die Uebersetzung sie neu einsetzen kann. */
  werte: Platzhalterwerte
}

export type GruppenBefund = GruppenSatz &
  (
    | { art: 'groesse'; gruppe: string; erwartet: number; ist: number }
    | { art: 'artenmix'; gruppe: string; arten: PortGroupKind[] }
    | { art: 'rolle-doppelt'; gruppe: string; rolle: string }
  )


/**
 * Was an den Gruppen NICHT stimmen kann.
 *
 * Drei Befunde, und alle drei sind Widersprueche in den Angaben selbst — kein
 * Geschmacksurteil:
 *
 *   groesse       eine Stereo-Gruppe mit einem oder drei Mitgliedern
 *   artenmix      zwei Ports derselben Gruppe nennen verschiedene Arten
 *   rolle-doppelt zweimal „L" in derselben Gruppe
 *
 * Eine Gruppe OHNE Art gibt nichts zurueck: „diese beiden gehoeren zusammen"
 * ist eine vollstaendige Aussage, auch ohne zu sagen, wie.
 */
export const gruppenBefunde = (ports: readonly Port[]): GruppenBefund[] => {
  const befunde: GruppenBefund[] = []
  for (const g of portGruppen(ports)) {
    const arten = [...new Set(g.ports.map((p) => p.portGroupKind).filter(Boolean))] as PortGroupKind[]
    if (arten.length > 1) {
      const werte = { group: g.id, kinds: arten.join(' / ') }
      befunde.push({
        art: 'artenmix',
        gruppe: g.id,
        arten,
        schluessel: 'ports.group.kindMismatch',
        text: einsetzen(
          'Group "{group}" is declared as {kinds} at the same time — only one of them can be true.',
          werte,
        ),
        werte,
      })
    }

    const erwartet = g.art ? PORT_GROUP_INFO[g.art].groesse : undefined
    if (erwartet !== undefined && g.ports.length !== erwartet) {
      const werte = { group: g.id, is: g.ports.length, expected: erwartet }
      befunde.push({
        art: 'groesse',
        gruppe: g.id,
        erwartet,
        ist: g.ports.length,
        schluessel: 'ports.group.sizeMismatch',
        text: einsetzen(
          'Group "{group}": {is} of {expected} ports — the group says one connector, the plan shows another number.',
          werte,
        ),
        werte,
      })
    }

    const gesehen = new Set<string>()
    for (const p of g.ports) {
      const r = p.portGroupRole?.trim()
      if (!r) continue
      if (gesehen.has(r)) {
        const werte = { group: g.id, role: r }
        befunde.push({
          art: 'rolle-doppelt',
          gruppe: g.id,
          rolle: r,
          schluessel: 'ports.group.roleTwice',
          text: einsetzen(
            'Group "{group}" has "{role}" twice — two left channels are not a stereo pair.',
            werte,
          ),
          werte,
        })
      }
      gesehen.add(r)
    }
  }
  return befunde
}

/**
 * Die naechste freie Gruppen-Id in dieser Port-Liste.
 *
 * Zaehlt hoch statt eine UUID zu vergeben: der Wert steht in der Oberflaeche
 * und auf dem gedruckten Blatt, und `SP-2` liest jemand vor, `4f3a…` nicht.
 */
export const naechsteGruppenId = (ports: readonly Port[], praefix = 'SP'): string => {
  const belegt = new Set(ports.map((p) => p.portGroup).filter(Boolean) as string[])
  for (let i = 1; ; i += 1) {
    const kandidat = `${praefix}-${i}`
    if (!belegt.has(kandidat)) return kandidat
  }
}
