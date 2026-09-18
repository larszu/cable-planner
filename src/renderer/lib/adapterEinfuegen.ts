// ───────────────────────────────────────────────────────────────────────────
// Einen Adapter in ein bestehendes Kabel einsetzen (#876).
//
// ─── WAS DABEI WIRKLICH PASSIERT ───────────────────────────────────────────
//
// Aus EINEM Kabel werden ZWEI, und dazwischen steht ein Gerät. Das ist keine
// Kosmetik: der Adapter hat zwei Anschlüsse, an denen je ein Kabel endet, und
// genau so steht er später in der Kabelliste, in der Stückliste und am Dock.
//
// ─── DIE LÄNGE IST DER STOLPERSTEIN ────────────────────────────────────────
//
// Ein 40-m-Lauf wird durch einen Adapter nicht zu zweimal 40 m. Er wird auch
// nicht zu zweimal 20 m — wo der Adapter sitzt, weiss der Plan nicht. Das
// erste Stück bekommt deshalb die ganze Länge und das zweite NULL, und das
// Zweite ist ausdrücklich „noch nicht gemessen": ein Adapter sitzt in aller
// Regel unmittelbar am Gerät, und ein halber Lauf, der aussieht wie eine
// Messung, ist schlimmer als eine Null, die jemand ausfüllt.
//
// ─── UND WAS HIER NICHT ENTSCHIEDEN WIRD ───────────────────────────────────
//
// Ob eingesetzt wird. Diese Datei rechnet den Vorgang aus; der Store führt
// ihn in EINEM Undo-Schritt aus (`projectHistory.transact`), und der Mensch
// drückt den Knopf.
//
// REIN: keine Uhr, keine Id-Erzeugung, kein Store. Ids kommen von aussen —
// sonst wäre diese Funktion nicht zweimal gleich ausführbar, und ein Test
// müsste eine Zufallszahl vergleichen.
// ───────────────────────────────────────────────────────────────────────────
import type { AdapterSpec } from '../types/adapter'
import { adapterBezeichnung } from '../types/adapter'
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'

export interface EinfuegePlan {
  /** Das neue Gerät — ein Adapter mit genau zwei Anschlüssen. */
  geraet: EquipmentItem
  /** Quelle → Adapter. Trägt die Länge des ursprünglichen Laufs. */
  kabelVor: Cable
  /** Adapter → Senke. Länge 0: noch nicht gemessen. */
  kabelNach: Cable
}

/** Masse des eingesetzten Geräts und der Platz, den es um sich braucht. */
const BREITE = 160
const HOEHE = 80
const ABSTAND = 40
/** Wie weit er nach unten ausweicht, wenn der Platz dazwischen nicht reicht. */
const VERSATZ = 140

export interface EinfuegeIds {
  geraet: string
  kabelVor: string
  kabelNach: string
}

/**
 * Der Vorgang als Daten.
 *
 * Das Gerät steht MITTIG zwischen seinen beiden Nachbarn, wenn beide bekannt
 * sind — sonst dort, wo das Kabel hinzeigt. Ein Adapter, der im Nichts
 * liegt, wäre am Canvas nicht zu finden, und ein Plan, in dem jemand ein
 * Gerät suchen muss, das er gerade selbst eingesetzt hat, ist ein
 * Ärgernis mit Ansage.
 */
export function planeEinfuegen(
  kabel: Cable,
  spec: AdapterSpec,
  ids: EinfuegeIds,
  quelle: Pick<EquipmentItem, 'x' | 'y' | 'width'> | undefined,
  senke: Pick<EquipmentItem, 'x' | 'y'> | undefined,
): EinfuegePlan {
  // MITTIG ZWISCHEN DIE BEIDEN, und zwar mit der eigenen Breite gerechnet:
  // ein Gerät, dessen linke Kante auf der Mitte sitzt, steht halb im
  // Nachbarn. Gemessen im Browser an einem 800 px breiten Abstand — der
  // Adapter lag auf dem Scheinwerfer.
  //
  // Und wenn der Platz dazwischen NICHT reicht, geht er nach unten statt
  // in den Nachbarn hinein. Ein Gerät, das ein anderes verdeckt, ist im
  // Plan schlimmer als eines, das eine Reihe tiefer steht.
  const linkeKante = (quelle?.x ?? senke?.x ?? 0) + (quelle?.width ?? 0)
  const rechteKante = senke?.x ?? linkeKante + 2 * BREITE
  const luecke = rechteKante - linkeKante
  const x =
    quelle && senke
      ? Math.round(linkeKante + luecke / 2 - BREITE / 2)
      : Math.round(linkeKante + 100)
  const mitteY = Math.round(quelle && senke ? (quelle.y + senke.y) / 2 : (quelle?.y ?? senke?.y ?? 0))
  const y = quelle && senke && luecke < BREITE + 2 * ABSTAND ? mitteY + VERSATZ : mitteY

  const geraet: EquipmentItem = {
    id: ids.geraet,
    name: adapterBezeichnung(spec),
    category: 'Other',
    inputs: [
      { id: `${ids.geraet}-in`, name: 'IN', type: 'port', connectorType: spec.von, direction: 'in' },
    ],
    outputs: [
      { id: `${ids.geraet}-out`, name: 'OUT', type: 'port', connectorType: spec.nach, direction: 'out' },
    ],
    x,
    y,
    width: BREITE,
    height: HOEHE,
    adapter: spec,
  } as EquipmentItem

  const gemeinsam = {
    type: kabel.type,
    color: kabel.color,
    cableSpecId: kabel.cableSpecId,
    standard: kabel.standard,
    layer: kabel.layer,
    routing: kabel.routing,
    // Der Vermerk „braucht einen Adapter" gehört jetzt dem Adapter und nicht
    // mehr dem Kabel: er steht im Plan, statt als Warnung an einer Kante zu
    // kleben, die inzwischen passt.
    needsConverter: false,
  }

  return {
    geraet,
    kabelVor: {
      ...gemeinsam,
      id: ids.kabelVor,
      name: kabel.name,
      length: kabel.length,
      fromEquipmentId: kabel.fromEquipmentId,
      fromPortId: kabel.fromPortId,
      toEquipmentId: ids.geraet,
      toPortId: `${ids.geraet}-in`,
      notes: kabel.notes,
    } as Cable,
    kabelNach: {
      ...gemeinsam,
      id: ids.kabelNach,
      name: kabel.name,
      // NULL und nicht die halbe Länge: wo der Adapter sitzt, weiss der Plan
      // nicht. Siehe Kopf dieser Datei.
      length: 0,
      fromEquipmentId: ids.geraet,
      fromPortId: `${ids.geraet}-out`,
      toEquipmentId: kabel.toEquipmentId,
      toPortId: kabel.toPortId,
      notes: '',
    } as Cable,
  }
}
