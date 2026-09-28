// ───────────────────────────────────────────────────────────────────────────
// Die VERMUTETE VERBINDUNG (Issue #906).
//
// NUTZER-AUFTRAG, woertlich:
//
//   > es soll vereinfacht werden vorhandene Infrastruktur und vorhandene
//   > Systeme zu dokumentieren. Beispiel: Schulungszentrum ohne
//   > Dokumentation. […] Man muss also auch Skizzen oder notes machen koennen
//   > die dann die Grundlage bilden. Also nicht fertige Geraete anlegen
//   > koennen zum Beispiel, damit man in Raum beim erfassen schnell und
//   > effektiv arbeiten kann.
//
// ─── DER HARTE PUNKT, UND WARUM ES DIESEN TYP BRAUCHT ──────────────────────
//
// `Cable.fromPortId` ist ein PFLICHTFELD. Man kann zwei Geraete im Plan nicht
// verbinden, ohne die Buchse zu benennen — und genau die weiss man im
// unerfassten Raum nicht. Man sieht, DASS ein Kabel von der Kamera ins
// Patchfeld laeuft; welche der vierundzwanzig Buchsen es dort trifft, steht
// nirgends.
//
// Drei Wege waren moeglich, und zwei davon waeren teuer geworden:
//
//   (a) Jedem erfassten Geraet ein generisches Port-Paar mitgeben. Damit
//       koennte man sofort verbinden — und haette eine ERFUNDENE Buchse, die
//       still in Stueckliste, Patchliste und Kabelzug wandert. Das ist genau
//       die Falle aus `docs/device-identity-concept.md`: eine erfundene
//       Belegung sieht im Plan so autoritativ aus wie eine gemessene.
//   (b) Im Raum nur Geraete, Notizen und Fotos erfassen, verbinden spaeter am
//       Schreibtisch. Nichts erfunden — aber genau die Auskunft „was geht
//       wohin" geht verloren, die man im Raum SIEHT und danach vergisst.
//   (c) Dieser Typ.
//
// ─── WAS SIE IST UND WAS SIE NICHT IST ─────────────────────────────────────
//
// Sie ist eine Beobachtung: „zwischen diesen zwei Geraeten laeuft etwas."
// Sie ist KEIN Kabel. Deshalb liegt sie in einer EIGENEN Liste am Projekt und
// nicht in `project.cables` — und das ist die ganze Zusicherung:
//
//   Stueckliste, Patchliste, Kabelzug, Laengen, Trommel-Aufteilung, Export —
//   alle laufen ueber `project.cables`. Etwas, das dort nicht steht, kann
//   dort auch nicht versehentlich mitgezaehlt werden.
//
// Eine Markierung AM Kabel („istVermutet: true") haette dieselbe Auskunft
// getragen und die Zusicherung nicht: dann muesste jede der Dutzend
// Auswertungen die Markierung kennen, und die dreizehnte haette sie
// vergessen. Eine eigene Liste vergisst niemand, weil sie niemand sieht.
//
// ─── WIE SIE ENDET ─────────────────────────────────────────────────────────
//
// Nicht als Altlast. Sobald jemand die Buchsen kennt, wird aus der Vermutung
// ein Kabel (`zuKabel` in `lib/vermuteteVerbindungen.ts`), und die Vermutung
// verschwindet. Bis dahin zaehlt der Plan-Check sie und sagt, wie viele offen
// sind — eine Vermutung, nach der niemand fragt, waere eine stille
// Falschaussage auf Zeit.
// ───────────────────────────────────────────────────────────────────────────

export interface VermuteteVerbindung {
  id: string
  /** Die beiden Geraete. Ungerichtet gemeint — was im Raum sichtbar ist, ist
   *  „hier laeuft etwas hin", nicht „hier ist der Ausgang". Die Reihenfolge
   *  haelt bloss fest, wo der Stift angesetzt hat. */
  vonEquipmentId: string
  nachEquipmentId: string
  /**
   * Was man im Raum gesehen hat: „blaues Cat-Kabel", „laeuft unter dem
   * Doppelboden", „Buchse 12 oder 13". Freitext, und bewusst kein Feld pro
   * Vermutung: was man notiert, weiss man erst vor Ort.
   */
  notiz?: string
  /**
   * Die vermutete Kabelart, WENN man sie sehen konnte. Kein Pflichtfeld: die
   * Farbe eines Mantels sagt nicht immer, was drin ist, und ein Kabel im
   * Kabelkanal sagt gar nichts.
   */
  vermuteterTyp?: string
  /** Wann erfasst. ISO-Zeitstempel — auf dem Blatt steht sonst nicht, wie alt
   *  die Beobachtung ist, und eine zwei Jahre alte Vermutung ist eine andere
   *  Auskunft als die von heute. */
  erfasstAm?: string
  /** Fotos dieser Beobachtung, als Ids in `project.fotos`. */
  fotoIds?: string[]
}

/** Was auf dem Blatt steht, wo keine Notiz gemacht wurde. */
export const OHNE_NOTIZ = 'nichts notiert'

/**
 * Rohsatz aus einer Projektdatei zu einer gueltigen Vermutung — oder `null`.
 *
 * Eine Vermutung ohne ihre beiden Geraete ist kein Datensatz, sondern eine
 * Linie ins Leere. Sie beim Laden wegzuraeumen ist dieselbe Regel wie bei
 * `normaliseNetworkInterface`: ein Fehlzeiger sieht in der Zeichnung aus wie
 * eine Beobachtung.
 */
export function normalisiereVermutung(roh: unknown): VermuteteVerbindung | null {
  if (!roh || typeof roh !== 'object') return null
  const v = roh as Record<string, unknown>
  if (typeof v.id !== 'string' || !v.id) return null
  if (typeof v.vonEquipmentId !== 'string' || !v.vonEquipmentId) return null
  if (typeof v.nachEquipmentId !== 'string' || !v.nachEquipmentId) return null
  // Eine Vermutung von einem Geraet auf sich selbst ist keine Beobachtung.
  if (v.vonEquipmentId === v.nachEquipmentId) return null
  return {
    id: v.id,
    vonEquipmentId: v.vonEquipmentId,
    nachEquipmentId: v.nachEquipmentId,
    ...(typeof v.notiz === 'string' && v.notiz ? { notiz: v.notiz } : {}),
    ...(typeof v.vermuteterTyp === 'string' && v.vermuteterTyp
      ? { vermuteterTyp: v.vermuteterTyp }
      : {}),
    ...(typeof v.erfasstAm === 'string' && v.erfasstAm ? { erfasstAm: v.erfasstAm } : {}),
    ...(Array.isArray(v.fotoIds)
      ? { fotoIds: v.fotoIds.filter((f): f is string => typeof f === 'string' && !!f) }
      : {}),
  }
}
