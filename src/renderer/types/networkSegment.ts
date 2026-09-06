// ───────────────────────────────────────────────────────────────────────────
// Das Segment als Gegenstand des Plans (Bedarf 116, P3).
//
//   > A systems tech must reach VuNET, the mixer app, Dante Controller, Lake
//   > Controller and Shure WWB ON SEPARATE VLANs FROM ONE MACHINE, while
//   > keeping amp control off Dante PTP and stopping Waves SoundGrid
//   > attaching to the wrong segment.
//
// Belegt an `misnow1/vunet-dante-combiner-2000` (angelegt 2026-08-13, sieben
// offene Punkte): ein tragbares Linux-Gateway im Mgmt-VLAN, gebaut, damit EIN
// Steuer-Rechner alle fünf Anwendungen erreicht — ohne zweite Netzkarte, mit
// einem dokumentierten „break-glass"-Rückfall.
//
// ─── WAS ES SCHON GAB, UND WAS FEHLTE ──────────────────────────────────────
//
// Die VLAN-ID steht seit Bedarf 19/24 an jeder Schnittstelle, die Rolle
// (`media-primary`, `control`, `management` …) auch, und die PTP-Domäne seit
// Bedarf 73. Was fehlte, ist das SEGMENT als Gegenstand: eine Zahl ohne Namen
// ist keine Auskunft. „VLAN 30" beantwortet nicht, ob Dante dort hin darf.
//
// Erst mit einem benannten Segment lassen sich die drei Sätze aus dem Beleg
// überhaupt prüfen:
//
//   * „on separate VLANs" — liegen Medien und Steuerung getrennt, oder teilen
//     sie ein Segment?
//   * „keeping amp control off Dante PTP" — steht eine Steuer-Schnittstelle
//     in einem Segment, dessen Zweck Medien ist?
//   * „stopping SoundGrid attaching to the wrong segment" — passt die Rolle
//     der Schnittstelle zum Zweck des Segments, in dem sie liegt?
//
// ─── EINE VOKABEL, NICHT ZWEI ──────────────────────────────────────────────
//
// Der Zweck eines Segments ist eine `NetworkInterfaceRole` und KEIN eigener
// Aufzählungstyp. Ein zweiter Satz Wörter für dieselbe Sache („media" hier,
// „media-primary" dort) wäre genau die Krankheit, die das Spaltenlexikon
// (Bedarf 81) bei Spaltennamen abgestellt hat: dann dürfte „control" im
// Segment etwas anderes heissen als an der Schnittstelle, und niemand hätte
// einen Ort, an dem der Widerspruch auffiele.
// ───────────────────────────────────────────────────────────────────────────

import type { NetworkInterfaceRole } from './network'

export interface NetworkSegment {
  /** VLAN-Id. Der Schlüssel — ein Segment IST eine VLAN-Id mit Bedeutung. */
  vlanId: number
  /** Wie es im Haus heisst („Dante Prim", „Steuerung", „Mgmt"). */
  name: string
  /**
   * Wofür es da ist — dieselbe Vokabel wie an der Schnittstelle.
   *
   * `unspecified` heisst „noch nicht entschieden" und ist kein Fehler: ein
   * Segment, das der Veranstalter stellt und über das niemand Auskunft gibt,
   * ist genau das. Es zu raten wäre teurer als die Lücke.
   */
  purpose: NetworkInterfaceRole
  /**
   * Die PTP-Domäne, die in diesem Segment gefahren wird — als ENTWURF des
   * Segments, nicht als Messung am Gerät.
   *
   * Sie steht hier NEBEN `NetworkInterface.ptpDomain` und ersetzt sie nicht:
   * die eine ist der Plan für das Segment, die andere die Angabe am Gerät.
   * Genau die Differenz zwischen beiden ist der Befund, den `segmentFindings`
   * meldet — und den `ptpPlan.ts` nicht sehen kann, weil es die Segmente
   * nicht kennt.
   */
  ptpDomain?: number
  /**
   * Wie man von aussen hineinkommt: das Gerät, das in dieses Segment routet
   * (der „Mgmt-VLAN gateway" aus dem Beleg), als Geräte-Id im selben Plan.
   *
   * Fehlt es, sagt das Blatt „nur direkt am Segment" — und das ist eine
   * Auskunft und keine Lücke: nicht jedes Segment SOLL erreichbar sein.
   */
  gatewayEquipmentId?: string
  note?: string
}

/** Was auf dem Blatt steht, wo nichts festgehalten wurde. */
export const NO_SEGMENT_NAME = 'ohne Namen'
export const NO_GATEWAY = 'nur direkt am Segment'
export const NO_PTP_IN_SEGMENT = 'keine Zeit geplant'
