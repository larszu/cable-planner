// ───────────────────────────────────────────────────────────────────────────
// BEDARF 89 (P2) — das Sicherheitsnetz, einmal erklaert.
//
//   > Scene names exist in the OBS scene collection, again in hand-edited
//   > NOALBS JSON, and again in the operator's memory during the show; the
//   > safety net's characteristic failure is parking the show on a slate while
//   > the stream is fine.
//
// Belege, beide in voller Laenge gelesen:
//   NOALBS #178 (2024-10-23, offen) — der Waechter erreicht `http://localhost/
//   stat` NICHT, obwohl dieselbe URL im Browser antwortet. Also schaltet er
//   dauerhaft auf die Offline-Szene, waehrend RTMP laeuft, und `!bitrate`
//   antwortet „No connection :(".
//   NOALBS #119 (2022-09-14) — eine klebende Offline-Szene, die sich immer
//   wieder durchsetzt.
//
// ─── DER FEHLER IST EIN FALSCH-POSITIV, NICHT EIN VERPASSTER AUSFALL ───────
//
// Das ist der Grund, warum dieses Objekt ueberhaupt existiert. Ein
// Sicherheitsnetz, das nicht ausloest, kostet eine Show. Ein Sicherheitsnetz,
// das GRUNDLOS ausloest, kostet auch eine Show — und niemand sucht den Fehler
// beim Netz, weil das Netz ja „funktioniert". Beide Belege sind von dieser
// zweiten Sorte.
//
// Die drei Angaben, die der Bedarf nennt (Schwellen, Szenennamen, welches Ziel
// geschuetzt wird), stehen deshalb HIER und nicht in drei Koepfen. Dazu die
// eine, die aus #178 folgt: WO der Waechter laeuft. `localhost` ist keine
// Adresse, sondern eine Annahme ueber die Maschine.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Was der Waechter tun soll, wenn ein Ziel schwaechelt.
 *
 * Alle Szenen sind optional, und keine wird geraten. Eine erfundene
 * „Offline"-Szene waere genau der Fehler aus dem Bedarf: der Waechter schaltet
 * auf einen Namen, den der Encoder nicht kennt, und die Show steht.
 */
export interface FallbackRule {
  id: string
  /** Das Ziel, das diese Regel schuetzt — eine `DeliveryDestination.id`. */
  destinationId: string
  /** Szene fuer den Normalbetrieb — der Rueckweg. */
  sceneNormal?: string
  /** Szene bei niedriger Bitrate. */
  sceneLow?: string
  /** Szene, wenn nichts mehr ankommt. */
  sceneOffline?: string
  /** Schwelle „niedrig" in kbit/s. */
  lowKbps?: number
  /** Schwelle „offline" in kbit/s. */
  offlineKbps?: number
  /** Notiz — was am Showtag jemand wissen muss. */
  note?: string
}

/** Das Sicherheitsnetz des ganzen Projekts. */
export interface FallbackPlan {
  /**
   * Das Geraet, auf dem der Waechter LAEUFT.
   *
   * Aus NOALBS #178. Ohne dieses Feld ist `localhost` in der Statistik-URL
   * nicht pruefbar — und genau diese Annahme hat dort die Show auf die
   * Offline-Szene geparkt.
   */
  watcherEquipmentId?: string
  /** Die Statistik-Quelle, WIE SIE DER WAECHTER SIEHT (nicht wie der Browser). */
  statsUrl?: string
  /**
   * Die Szenen, die der Encoder wirklich hat.
   *
   * Abgetippt oder eingefuegt — der Planer liest keine Szenensammlung. Solange
   * diese Liste leer ist, kann die Namenspruefung nicht laufen, und DAS wird
   * gesagt: ein stiller Durchlauf saehe aus wie „geprueft".
   */
  scenes: string[]
  rules: FallbackRule[]
}
