// ───────────────────────────────────────────────────────────────────────────
// ISSUE #664 — „Patchbays als Geraetekategorie erstellen und mehrere Ebenen
// der Verkabelung anzeigbar machen fuer Festinstallationen."
//
// Diese Datei ist die EINE Stelle, die beantwortet: ist dieses Geraet eine
// Patchblende, und welcher Anschluss auf der anderen Seite gehoert zu diesem?
//
// Sie hat genau einen Grund zu existieren: die Antwort wurde vorher an drei
// Stellen VERSCHIEDEN gegeben. `detectDeviceKind` hielt eine 24er-Blende fuer
// eine Kreuzschiene (die Struktur-Heuristik „>= 8 BNC rein, >= 8 BNC raus"
// trifft auf jede Blende zu), die Rueckwaertssuche in `labelDerivation`
// verlangte GENAU EINEN passenden Eingang und fand vierundzwanzig, und die
// Patchliste folgte nur Wandlern mit genau einem Ausgangskabel. Ergebnis: die
// Kette brach an jeder Blende, und auf dem Blatt stand die Blende als Quelle
// statt der Kamera.
//
// ─── WARUM DER DURCHGANG KEIN RATEN IST ────────────────────────────────────
//
// Eine Patchblende IST die positionsweise Durchleitung: Buchse n hinten liegt
// auf Buchse n vorn. Das ist ihre Bauart, kein Betriebszustand. Deshalb darf
// sie abgeleitet werden — anders als beim Router (`routedInput`), wo der
// Kreuzpunkt geschaltet wird und ohne gesetzten Plan nichts ableitbar ist.
//
// ─── WO ES AUFHOERT ────────────────────────────────────────────────────────
//
// Sind vorn und hinten verschieden viele Buchsen, ist die Zuordnung nicht mehr
// die Position — dann gibt es null und die Kette haelt an der Blende an wie
// bisher. Und ein gestecktes Rangierkabel, das die Normalisierung aufhebt,
// weiss der Plan nicht: er beschreibt die geplante Verkabelung, nicht das, was
// jemand vor Ort umgesteckt hat.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import type { Frontplatte, FrontplattenArt } from '../types/frontplatte'

/**
 * Die Geraetekategorie aus der Ueberschrift des Issues.
 *
 * Sie steht in `DEFAULT_CATEGORIES` (libraryPersist.ts) und ist der zweite
 * Weg, ein Geraet als Blende auszuweisen — der erste ist das Flag
 * `isPatchPanel`, das der Rack-Builder-Dialog setzt.
 */
export const PATCH_PANEL_CATEGORY = 'Patch panels'

/** Nur die Kategorie, ohne das Flag — die UI braucht beide Haelften getrennt. */
export const categoryIsPatchPanel = (category: string | undefined): boolean =>
  (category ?? '').trim().toLowerCase() === PATCH_PANEL_CATEGORY.toLowerCase()

/**
 * #913 — die Frontplatten-Arten, die ihrer Bauart nach DURCHLEITEN.
 *
 * Eine Wanddose, ein Wandfeld, eine Stagebox und eine Blende sind in der
 * Festinstallation genau die Zwischenstationen, an denen die Kette bisher
 * abbrach: sie waren als Platte ausgewiesen, aber fuer die Signalkette erst
 * dann ein Durchgang, wenn zusaetzlich jemand das Patchfeld-Haekchen setzte.
 * Der Weg Kamera → Blende Halle → Hausstrecke → Blende 3.OG → Regie zerfiel
 * dadurch in Einzelstuecke. `sonstige` bleibt aussen vor: was das ist, sagt
 * die Art gerade nicht.
 */
export const DURCHLEITENDE_PLATTEN: readonly FrontplattenArt[] = ['wandfeld', 'stagebox', 'blende']

/** Leitet diese Frontplatte ihrer Art nach durch? Ohne Platte: nein. */
export const plattenDurchleitung = (device: { frontplatte?: Pick<Frontplatte, 'art'> }): boolean =>
  !!device.frontplatte && DURCHLEITENDE_PLATTEN.includes(device.frontplatte.art)

/**
 * Ist dieses Geraet eine Patchblende?
 *
 * DREI WEGE, EINE ANTWORT: das Flag `isPatchPanel` (vom Rack-Builder gesetzt,
 * in den Properties umschaltbar), die Kategorie „Patchfelder" ODER eine
 * durchleitende Frontplatte (#913). Wer ein Geraet in diese Kategorie legt
 * oder als Wandfeld ausweist, hat damit gesagt, was es ist; ein zweites
 * Haekchen zu verlangen waere eine Falle. Nur bei der Platte ist ein
 * ausdrueckliches Nein moeglich (`isPatchPanel: false`) — eine Stagebox mit
 * aktivem Wandler darin leitet nicht Position auf Position durch.
 */
export const isPatchPanelDevice = (
  device: Pick<EquipmentItem, 'category'> & { isPatchPanel?: boolean; frontplatte?: Pick<Frontplatte, 'art'> },
): boolean =>
  device.isPatchPanel === true ||
  categoryIsPatchPanel(device.category) ||
  (device.isPatchPanel !== false && plattenDurchleitung(device))

/**
 * Der Anschluss auf der anderen Seite — Position n gegen Position n.
 *
 * Beidseitig: von einem Ausgang kommt der gleichnummerige Eingang zurueck und
 * umgekehrt. Die Rueckwaertssuche (`labelDerivation`) braucht die eine
 * Richtung, die Vorwaertskette (`signalChain`) die andere; zwei Funktionen
 * waeren zwei Wahrheiten.
 *
 * null heisst „nicht ableitbar", nie „keine Verbindung": ungleiche
 * Buchsenzahlen, kein Blende-Geraet, oder der Port gehoert gar nicht dazu.
 */
export const patchPanelCounterpart = (
  device: EquipmentItem,
  port: Pick<Port, 'id'>,
): Port | null => {
  if (!isPatchPanelDevice(device)) return null
  if (device.inputs.length !== device.outputs.length) return null
  if (device.inputs.length === 0) return null

  const outIdx = device.outputs.findIndex((p) => p.id === port.id)
  if (outIdx >= 0) return device.inputs[outIdx] ?? null

  const inIdx = device.inputs.findIndex((p) => p.id === port.id)
  if (inIdx >= 0) return device.outputs[inIdx] ?? null

  return null
}

/** Ein Kabelende: Geraet und Port. */
export interface KabelEnde {
  equipmentId: string
  portId: string
}

/**
 * Je Port die Gegenenden seiner Kabel. Ein Kabel kann in beide Richtungen
 * gezeichnet sein, deshalb steht jedes zweimal darin.
 */
export const gegenendenJePort = (cables: readonly Cable[]): Map<string, KabelEnde[]> => {
  const m = new Map<string, KabelEnde[]>()
  const add = (portId: string, ende: KabelEnde) => {
    const list = m.get(portId)
    if (list) list.push(ende)
    else m.set(portId, [ende])
  }
  for (const c of cables) {
    add(c.fromPortId, { equipmentId: c.toEquipmentId, portId: c.toPortId })
    add(c.toPortId, { equipmentId: c.fromEquipmentId, portId: c.fromPortId })
  }
  return m
}

const MAX_BLENDEN = 12

/**
 * Vom Ende eines Kabels durch Blenden, Wandfelder und Patchfelder hindurch bis
 * zum Geraet, das dort wirklich haengt.
 *
 * Richtungslos, weil ein Netzwerkkabel keine Richtung hat: wer am Switch
 * steht, will wissen, welche Kamera hinter Patchfeld und Wandfeld steckt.
 * Endet der Weg in einer Blende (Position n unbeschaltet), bleibt die Blende
 * die Antwort — sie ist dann tatsaechlich das Letzte, was der Plan kennt.
 * `blenden` nennt die durchlaufenen Platten in Reihenfolge.
 */
export const durchBlenden = (
  start: KabelEnde,
  eqById: ReadonlyMap<string, EquipmentItem>,
  enden: ReadonlyMap<string, readonly KabelEnde[]>,
): { ende: KabelEnde; blenden: string[] } => {
  let ende = start
  const blenden: string[] = []
  const besucht = new Set<string>([start.portId])
  for (let i = 0; i < MAX_BLENDEN; i++) {
    const geraet = eqById.get(ende.equipmentId)
    if (!geraet || !isPatchPanelDevice(geraet)) break
    const gegen = patchPanelCounterpart(geraet, { id: ende.portId })
    if (!gegen || besucht.has(gegen.id)) break
    const weiter = enden.get(gegen.id)?.find((e) => !besucht.has(e.portId))
    if (!weiter) break
    besucht.add(gegen.id)
    besucht.add(weiter.portId)
    blenden.push(geraet.id)
    ende = weiter
  }
  return { ende, blenden }
}

/**
 * Die Ports, die auf der Frontplatte sitzen.
 *
 * Ein durchleitendes Geraet (Wandfeld, Blende, Patchfeld) hat zwei Seiten:
 * vorne die Buchsen, hinten die Hausstrecke oder die Rackverkabelung. Der
 * Platten-Editor verlangte fuer beide eine Lage und meldete die Rueckseite als
 * „ohne Lage auf der Platte" — bei einem Wandfeld mit acht Buchsen acht
 * Fehlmeldungen. Auf die Platte gehoert eine Seite:
 *
 * 1. die ausdrueckliche Angabe `frontplatte.seite`,
 * 2. sonst die Seite, deren Stecker schon eine Lage haben (bei Gleichstand
 *    die Eingaenge — die Wahl steht im Editor und laesst sich umstellen).
 *
 * Alles, was nicht durchleitet, zeigt wie bisher alle Ports.
 */
export const plattenPorts = (device: EquipmentItem): Port[] => {
  if (!hatPlattenSeiten(device)) return [...device.inputs, ...device.outputs]
  const seite = plattenSeite(device)
  return seite === 'outputs' ? [...device.outputs] : [...device.inputs]
}

/** Welche Seite eines durchleitenden Geraets auf der Platte sitzt. */
export const plattenSeite = (device: EquipmentItem): 'inputs' | 'outputs' => {
  const gesetzt = device.frontplatte?.seite
  if (gesetzt) return gesetzt
  const mitLage = (ports: readonly Port[]) =>
    ports.filter((p) => p.panelPosX !== undefined && p.panelPosY !== undefined).length
  return mitLage(device.outputs) > mitLage(device.inputs) ? 'outputs' : 'inputs'
}

/** Leitet das Geraet durch, sodass eine Seite gewaehlt werden muss? */
export const hatPlattenSeiten = (device: EquipmentItem): boolean =>
  isPatchPanelDevice(device) &&
  device.inputs.length > 0 &&
  device.inputs.length === device.outputs.length
