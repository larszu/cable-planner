// ───────────────────────────────────────────────────────────────────────────
// #1056 — ein gesprochener (oder getippter) Satz wird zu Kabelwuenschen.
//
// „SDI 1 vom ATEM in den NEC im Foyer" → ATEM · SDI Out 1 → NEC · Eingang.
//
// DETERMINISTISCH, gegen die Namen im Plan. Kein Sprachmodell: der Satz
// nennt fast immer Geraete, die schon auf dem Canvas stehen, und eine
// Unschaerfe-Suche ueber deren Namen, Raeume und Ports trifft das ohne
// Netz, ohne Schluessel und reproduzierbar (Tests). Was mehrdeutig bleibt,
// wird NICHT geraten: das Ergebnis traegt die Kandidaten, die Vorschau
// laesst waehlen. Angelegt wird ueber `connect_many` (#873) — dieselbe
// Pruefung, derselbe Undo-Schritt wie beim MCP-Weg.
//
// REIN: kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../types/project'
import type { ConnectorType, EquipmentItem, EquipmentTemplate, Port } from '../types/equipment'
import { cableCatalog, checkCableCompatibility } from '../types/cableSpec'
import type { LocationFrame } from '../types/location'
import { locationForEquipment } from './equipmentLocation'

export const normalisiere = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/→|->/g, ' -> ')
    .replace(/[^a-z0-9>\-\s]/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()

const woerter = (s: string): string[] => normalisiere(s).split(' ').filter(Boolean)

const ZAHLWORT: Record<string, number> = {
  eins: 1, ein: 1, one: 1, zwei: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, fuenf: 5, funf: 5, five: 5,
  sechs: 6, six: 6, sieben: 7, seven: 7, acht: 8, eight: 8, neun: 9, nine: 9, zehn: 10, ten: 10,
  erste: 1, ersten: 1, first: 1, zweite: 2, zweiten: 2, second: 2, dritte: 3, dritten: 3, third: 3,
}

const zahlVon = (w: string): number | undefined => (/^\d+$/.test(w) ? Number(w) : ZAHLWORT[w])

/** Signalwoerter → woran ein Port sie erkennt (Name oder Steckertyp). */
const SIGNALE: Record<string, string[]> = {
  sdi: ['sdi', 'bnc'],
  hdmi: ['hdmi'],
  dp: ['displayport', 'dp'],
  displayport: ['displayport', 'dp'],
  dvi: ['dvi'],
  vga: ['vga'],
  usb: ['usb'],
  xlr: ['xlr'],
  aes: ['aes'],
  audio: ['audio', 'xlr', 'jack', 'aes'],
  mic: ['mic', 'xlr'],
  ethernet: ['ethernet', 'rj45', 'lan'],
  lan: ['ethernet', 'rj45', 'lan'],
  rj: ['ethernet', 'rj45'],
  netzwerk: ['ethernet', 'rj45', 'lan'],
  network: ['ethernet', 'rj45', 'lan'],
  sfp: ['sfp', 'fiber', 'glasfaser'],
  glasfaser: ['sfp', 'fiber', 'glasfaser', 'lc', 'st'],
  fiber: ['sfp', 'fiber', 'glasfaser', 'lc', 'st'],
  fibre: ['sfp', 'fiber', 'glasfaser', 'lc', 'st'],
  ref: ['ref', 'genlock', 'sync'],
  genlock: ['ref', 'genlock', 'sync'],
  tally: ['tally'],
  dmx: ['dmx'],
}

const EINGANG = new Set(['eingang', 'eingange', 'input', 'inputs', 'in'])
const AUSGANG = new Set(['ausgang', 'ausgange', 'output', 'outputs', 'out'])

/** Gattungswoerter → Woerter, die in Name/Kategorie passender Geraete stehen. */
const GATTUNG: Record<string, string[]> = {
  mischer: ['atem', 'switcher', 'mixer', 'mischer', 'bildmischer', 'vision'],
  bildmischer: ['atem', 'switcher', 'mixer', 'mischer'],
  switcher: ['atem', 'switcher', 'mixer', 'mischer'],
  mixer: ['atem', 'switcher', 'mixer', 'mischer'],
  kamera: ['kamera', 'camera', 'cam'],
  camera: ['kamera', 'camera', 'cam'],
  cam: ['kamera', 'camera', 'cam'],
  monitor: ['monitor', 'display', 'bildschirm', 'tv', 'screen', 'multisync'],
  display: ['monitor', 'display', 'bildschirm', 'screen'],
  bildschirm: ['monitor', 'display', 'bildschirm', 'screen'],
  screen: ['monitor', 'display', 'bildschirm', 'screen'],
  fernseher: ['monitor', 'display', 'tv'],
  beamer: ['beamer', 'projector', 'projektor'],
  projektor: ['beamer', 'projector', 'projektor'],
  projector: ['beamer', 'projector', 'projektor'],
  rekorder: ['recorder', 'rekorder', 'hyperdeck'],
  recorder: ['recorder', 'rekorder', 'hyperdeck'],
  kreuzschiene: ['videohub', 'router', 'kreuzschiene', 'matrix'],
  router: ['videohub', 'router', 'kreuzschiene', 'matrix'],
  konverter: ['converter', 'konverter', 'wandler'],
  converter: ['converter', 'konverter', 'wandler'],
  wandler: ['converter', 'konverter', 'wandler'],
}

/** Fuellwoerter, die kein Geraet benennen. */
const FUELL = new Set(
  (
    'der die das den dem des ein eine einen einem einer irgendein irgendeine irgendeinen irgendeinem soll sollen bitte mal ' +
    'von vom aus nach in ins im an am auf zum zur zu mit und hangt hangen steht stehen ist sind da dort hier ' +
    'wand links rechts oben unten hinten vorne neben kabel verbinde verbinden stecke stecken lege legen leg ' +
    'the a an from to into onto of on at with and please cable connect plug run wall left right which that is hangs some any ' +
    'port anschluss buchse'
  ).split(' '),
)

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0
  const z = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let vorher = z[0]
    z[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = z[j]
      z[j] = Math.min(z[j] + 1, z[j - 1] + 1, vorher + (a[i - 1] === b[j - 1] ? 0 : 1))
      vorher = t
    }
  }
  return z[b.length]
}

/** Wie gut passt ein gesprochenes Wort auf ein Namenswort (0 … 1). */
const wortPasst = (q: string, n: string): number => {
  if (q === n) return 1
  if (/^\d+$/.test(q) || /^\d+$/.test(n)) return 0
  if (q.length >= 3 && n.startsWith(q)) return 0.85
  if (n.length >= 3 && q.startsWith(n)) return 0.8
  if (q.length >= 4 && n.length >= 4 && levenshtein(q, n) <= (q.length >= 7 ? 2 : 1)) return 0.7
  return 0
}

// ─── Satz zerlegen ─────────────────────────────────────────────────────────

const STARK = new Set(['nach', 'auf', 'zum', 'zur', 'zu', 'to', 'into', 'onto', '->', 'mit', 'with'])
const SCHWACH = new Set(['in', 'ins', 'an'])
const VORNE = new Set(['von', 'vom', 'from', 'verbinde', 'verbinden', 'connect', 'kabel', 'cable', 'leg', 'lege', 'stecke', 'plug', 'bitte', 'please'])

/** Mehrere Kabel in einem Satz: getrennt durch Satzzeichen oder „und dann". */
export const zerlegeSaetze = (text: string): string[] =>
  text
    .split(/[;\n]+|\.\s+|\bund dann\b|\bdanach\b|\band then\b|\bthen\b/i)
    .map((s) => s.trim())
    .filter((s) => /[a-z0-9]/i.test(s))

/** Ein Satz → Quell- und Zieltext, oder null. */
export const teileSatz = (satz: string): { von: string; nach: string } | null => {
  const w = woerter(satz)
  const vorne = w.findIndex((x) => !VORNE.has(x))
  const rest = vorne < 0 ? [] : w.slice(vorne)
  let i = rest.findIndex((x, k) => k > 0 && STARK.has(x))
  if (i < 0) i = rest.findIndex((x, k) => k > 0 && SCHWACH.has(x))
  // „SDI 1 in Eingang 2": „in" vor einer Zahl/einem Signalwort ist Richtung,
  // nicht Trenner — hier selten, aber der Fehler waere ein leerer Quelltext.
  if (i < 0) return null
  const von = rest.slice(0, i).join(' ')
  const nach = rest.slice(i + 1).join(' ')
  return von && nach ? { von, nach } : null
}

// ─── Ein Ende verstehen ────────────────────────────────────────────────────

export interface EndeWunsch {
  /** Geraete-Suchwoerter (ohne Port, Raum, Fuellwoerter). */
  suche: string[]
  signal?: string
  nummer?: number
  richtung?: 'in' | 'out'
  raum?: LocationFrame
}

const raumWoerter = (l: LocationFrame) => woerter(l.name)

export const versteheEnde = (text: string, locations: readonly LocationFrame[]): EndeWunsch => {
  let w = woerter(text)
  // Raum: das am besten passende Rahmen-Namenswort (Unschaerfe: „Foxer").
  let raum: LocationFrame | undefined
  let raumGuete = 0
  let raumIdx: number[] = []
  for (const l of locations) {
    const rw = raumWoerter(l)
    if (!rw.length) continue
    const idx: number[] = []
    let summe = 0
    for (const r of rw) {
      let best = 0
      let bestI = -1
      w.forEach((q, i) => {
        if (FUELL.has(q) && q !== r) return
        const g = wortPasst(q, r)
        if (g > best) {
          best = g
          bestI = i
        }
      })
      if (best < 0.7) {
        summe = 0
        break
      }
      summe += best
      idx.push(bestI)
    }
    const guete = summe / rw.length
    if (guete > raumGuete) {
      raumGuete = guete
      raum = l
      raumIdx = idx
    }
  }
  if (raum) w = w.filter((_, i) => !raumIdx.includes(i))

  let signal: string | undefined
  let nummer: number | undefined
  let richtung: 'in' | 'out' | undefined
  const suche: string[] = []
  for (let i = 0; i < w.length; i++) {
    const x = w[i]
    const naechste = w[i + 1] !== undefined ? zahlVon(w[i + 1]) : undefined
    if (SIGNALE[x]) {
      signal = x
      if (naechste !== undefined) {
        nummer = naechste
        i++
      }
      continue
    }
    if (EINGANG.has(x) || AUSGANG.has(x)) {
      // Nacktes „in"/„an" ohne Zahl ist Praeposition, keine Richtung.
      if ((x === 'in' || x === 'out') && naechste === undefined) continue
      richtung = EINGANG.has(x) ? 'in' : 'out'
      if (naechste !== undefined) {
        nummer = naechste
        i++
      }
      continue
    }
    if (FUELL.has(x)) continue
    suche.push(x)
  }
  // Zahlwoerter, die nicht am Port haengen, bleiben Teil des Namens („Kamera zwei").
  const geraeteSuche = suche.map((x) => (ZAHLWORT[x] !== undefined ? String(ZAHLWORT[x]) : x))
  return { suche: geraeteSuche, signal, nummer, richtung, raum }
}

// ─── Geraet finden ─────────────────────────────────────────────────────────

const geraeteWoerter = (e: EquipmentItem): string[] => {
  const basis = [e.name, e.shortName ?? '', e.subtitle ?? '', e.category ?? '']
  return [...new Set(basis.flatMap(woerter))]
}

const geraetGuete = (e: EquipmentItem, suche: readonly string[]): number => {
  const nw = geraeteWoerter(e)
  const namensZahlen = woerter(e.name).filter((x) => /^\d+$/.test(x))
  let summe = 0
  let wortTreffer = 0
  for (const q of suche) {
    if (/^\d+$/.test(q)) {
      if (namensZahlen.includes(q)) summe += 1
      else if (namensZahlen.length) summe -= 1
      continue
    }
    let best = Math.max(0, ...nw.map((n) => wortPasst(q, n)))
    const gattung = GATTUNG[q]
    if (gattung && best < 1) best = Math.max(best, ...nw.map((n) => (gattung.includes(n) ? 0.9 : 0)))
    if (best > 0) wortTreffer++
    summe += best
  }
  return wortTreffer === 0 ? 0 : summe
}

export const findeGeraete = (
  project: Readonly<CablePlannerProject>,
  wunsch: EndeWunsch,
): EquipmentItem[] => {
  const locations = project.locations ?? []
  let pool = project.equipment
  if (wunsch.raum) {
    const imRaum = pool.filter((e) => locationForEquipment(e, locations)?.id === wunsch.raum?.id)
    if (imRaum.length) pool = imRaum
  }
  const bewertet = pool
    .map((e) => ({ e, g: wunsch.suche.length ? geraetGuete(e, wunsch.suche) : wunsch.raum ? 0.5 : 0 }))
    .filter((x) => x.g >= 0.5)
    .sort((a, b) => b.g - a.g)
  if (!bewertet.length) return []
  const spitze = bewertet[0].g
  // Knapp dahinter zaehlt als gleich gut: lieber nachfragen als raten.
  return bewertet.filter((x) => x.g >= spitze - 0.05).map((x) => x.e)
}

// ─── Port waehlen ──────────────────────────────────────────────────────────

const portNummer = (p: Port, i: number): number => (typeof p.portNumber === 'number' ? p.portNumber : i + 1)

const portHatSignal = (p: Port, signal: string): boolean => {
  const merkmale = [...woerter(p.name), ...woerter(String(p.connectorType ?? ''))]
  return SIGNALE[signal].some((s) => merkmale.some((m) => m === s || m.startsWith(s)))
}

export interface PortWahl {
  port?: Port
  richtung: 'in' | 'out'
  /** Der genannte Stecker fehlt am Geraet — es wurde ein anderer genommen. */
  signalFehlt: boolean
}

export const waehlePort = (
  geraet: EquipmentItem,
  wunsch: EndeWunsch,
  rolle: 'from' | 'to',
  belegt: (geraetId: string, portId: string) => boolean = () => false,
): PortWahl => {
  const richtung = wunsch.richtung ?? (rolle === 'from' ? 'out' : 'in')
  const seite = richtung === 'out' ? geraet.outputs : geraet.inputs
  const bidi = (richtung === 'out' ? geraet.inputs : geraet.outputs).filter((p) => p.direction === 'bidirectional')
  const alle = [...seite.map((p, i) => ({ p, n: portNummer(p, i) })), ...bidi.map((p, i) => ({ p, n: portNummer(p, i) }))]
  let kandidaten = alle
  let signalFehlt = false
  if (wunsch.signal) {
    const mit = alle.filter((x) => portHatSignal(x.p, wunsch.signal as string))
    if (mit.length) kandidaten = mit
    else signalFehlt = alle.length > 0
  }
  if (wunsch.nummer !== undefined && !signalFehlt) {
    const n = wunsch.nummer
    const imNamen = kandidaten.find((x) => woerter(x.p.name).includes(String(n)))
    const nachNr = kandidaten.find((x) => x.n === n)
    const nachPos = kandidaten[n - 1]
    // Gibt es den Port mit der Nummer nicht, kein Ersatz: ein Kabel auf
    // Eingang 1, wenn Eingang 9 gesagt wurde, ist falsch, nicht „fast richtig".
    return { port: (imNamen ?? nachNr ?? nachPos)?.p, richtung, signalFehlt }
  }
  const frei = kandidaten.find((x) => !belegt(geraet.id, x.p.id)) ?? kandidaten[0]
  return { port: frei?.p, richtung, signalFehlt }
}

// ─── Alles zusammen ────────────────────────────────────────────────────────

export interface SprachEnde {
  wunsch: EndeWunsch
  kandidaten: EquipmentItem[]
  geraetId?: string
  portId?: string
  signalFehlt: boolean
}

export interface SprachKabel {
  satz: string
  nachText: string
  von: SprachEnde
  nach: SprachEnde
}

export interface SprachErgebnis {
  kabel: SprachKabel[]
  /** Saetze ohne erkennbares „von … nach …". */
  unverstanden: string[]
}

export const loeseEnde = (
  project: Readonly<CablePlannerProject>,
  wunsch: EndeWunsch,
  rolle: 'from' | 'to',
  geraetId?: string,
): SprachEnde => {
  const kandidaten = findeGeraete(project, wunsch)
  const id = geraetId ?? (kandidaten.length === 1 ? kandidaten[0].id : undefined)
  const geraet = id ? project.equipment.find((e) => e.id === id) : undefined
  if (!geraet) return { wunsch, kandidaten, signalFehlt: false }
  const belegt = (g: string, p: string) => project.cables.some((c) => c.toEquipmentId === g && c.toPortId === p)
  const wahl = waehlePort(geraet, wunsch, rolle, belegt)
  return { wunsch, kandidaten, geraetId: geraet.id, portId: wahl.port?.id, signalFehlt: wahl.signalFehlt }
}

export const versteheSprache = (project: Readonly<CablePlannerProject>, text: string): SprachErgebnis => {
  const locations = project.locations ?? []
  const kabel: SprachKabel[] = []
  const unverstanden: string[] = []
  for (const satz of zerlegeSaetze(text)) {
    const teile = teileSatz(satz)
    if (!teile) {
      // Ein Nachsatz ohne „nach" („… im Foyer. Irgendein NEC.") praezisiert
      // das Ziel des vorigen Kabels.
      const vorher = kabel.at(-1)
      if (vorher) {
        const zusatz = `${vorher.nachText} ${satz}`
        kabel[kabel.length - 1] = { ...vorher, satz: `${vorher.satz} ${satz}`, nachText: zusatz, nach: loeseEnde(project, versteheEnde(zusatz, locations), 'to') }
      } else unverstanden.push(satz)
      continue
    }
    const von = loeseEnde(project, versteheEnde(teile.von, locations), 'from')
    const nach = loeseEnde(project, versteheEnde(teile.nach, locations), 'to')
    kabel.push({ satz, nachText: teile.nach, von, nach })
  }
  return { kabel, unverstanden }
}

/** Ist das Kabel bereit fuer `connect_many`? */
export const istVollstaendig = (k: SprachKabel): boolean =>
  !!(k.von.geraetId && k.von.portId && k.nach.geraetId && k.nach.portId)

/** Das Kabel, das schon am Ziel-Port steckt (fuer die Rueckfrage). */
export const belegtDurch = (project: Readonly<CablePlannerProject>, k: SprachKabel) =>
  project.cables.find((c) => c.toEquipmentId === k.nach.geraetId && c.toPortId === k.nach.portId)

// ─── Teil 2: Wandler und Geraete aus der Bibliothek (#1056) ────────────────

/**
 * Braucht die Strecke einen Wandler? Dieselbe Frage wie `rat` in
 * mcpSchreiben: passt KEIN Katalogkabel auf beide Stecker, ja.
 */
export const brauchtWandler = (von: ConnectorType, nach: ConnectorType): boolean =>
  von !== nach && !cableCatalog.some((spec) => checkCableCompatibility(von, nach, spec).level !== 'error')

const istWandlerVorlage = (t: EquipmentTemplate) =>
  /convert|wandler|konverter|scaler/i.test(`${t.name} ${t.category ?? ''}`)

/**
 * Die Bibliotheksvorlage, die `von` aufnimmt und `nach` ausgibt; nur
 * Wandler. Null heisst: der Aufrufer legt einen generischen an.
 */
export const findeWandlerVorlage = (
  bibliothek: readonly EquipmentTemplate[],
  von: ConnectorType,
  nach: ConnectorType,
): EquipmentTemplate | null =>
  bibliothek.find(
    (t) =>
      istWandlerVorlage(t) &&
      t.inputs.some((p) => p.connectorType === von) &&
      t.outputs.some((p) => p.connectorType === nach),
  ) ?? null

/** Vorlage fuer ein Ende, das im Plan nichts trifft. */
export const findeVorlage = (
  bibliothek: readonly EquipmentTemplate[],
  wunsch: EndeWunsch,
): EquipmentTemplate | undefined => {
  if (!wunsch.suche.length) return undefined
  const bewertet = bibliothek
    .map((t) => ({ t, g: geraetGuete(alsGeraet(t), wunsch.suche) }))
    .filter((x) => x.g >= 0.85)
    .sort((a, b) => b.g - a.g || a.t.name.length - b.t.name.length)
  return bewertet[0]?.t
}

/** Fuer die Portwahl an einer Vorlage, die noch nicht im Plan steht. */
export const alsGeraet = (t: EquipmentTemplate): EquipmentItem => ({ ...t, id: '', x: 0, y: 0 }) as EquipmentItem

export interface SchreibErgebnis {
  ok: boolean
  text: string
  daten: Record<string, unknown>
}

export type Schreiber = (werkzeug: string, args: Record<string, unknown>) => SchreibErgebnis

/** Was die Vorschau fuer ein Kabel festgelegt hat. */
export interface SprachAuftragEnde {
  geraetId?: string
  /** Statt eines Geraets im Plan: diese Bibliotheksvorlage platzieren. */
  vorlage?: EquipmentTemplate
  portId?: string
  wunsch: EndeWunsch
}

export interface SprachAuftrag {
  von: SprachAuftragEnde
  nach: SprachAuftragEnde
  wandler: boolean
  ersetzen: boolean
}

const neueId = (antwort: SchreibErgebnis) =>
  antwort.ok && typeof antwort.daten.deviceId === 'string' ? antwort.daten.deviceId : undefined

const portVon = (g: EquipmentItem | undefined, id?: string) =>
  g?.outputs.find((x) => x.id === id) ?? g?.inputs.find((x) => x.id === id)

/**
 * Fuehrt die Auftraege aus: fehlende Geraete aus der Bibliothek platzieren,
 * Wandler einsetzen, dann alle Kabel in EINEM `connect_many`. Der Aufrufer
 * klammert das mit `projectHistory.transact` — ein Diktat, ein Undo-Schritt.
 */
export const fuehreSprachAuftraegeAus = (
  auftraege: readonly SprachAuftrag[],
  schreiben: Schreiber,
  aktuell: () => Readonly<CablePlannerProject>,
  bibliothek: readonly EquipmentTemplate[],
): { ok: boolean; texte: string[] } => {
  const texte: string[] = []
  const kabel: Array<Record<string, unknown>> = []
  const geraet = (id?: string) => aktuell().equipment.find((x) => x.id === id)
  const ende = (e: SprachAuftragEnde, rolle: 'from' | 'to', bei?: { x: number; y: number }) => {
    if (e.geraetId) return { geraetId: e.geraetId, portId: e.portId }
    if (!e.vorlage) return null
    const r = schreiben('add_device', { template: e.vorlage.name, ...(bei ?? {}) })
    texte.push(r.text)
    const g = geraet(neueId(r))
    return g ? { geraetId: g.id, portId: waehlePort(g, e.wunsch, rolle).port?.id } : null
  }
  for (const a of auftraege) {
    const q = ende(a.von, 'from')
    const qGeraet = geraet(q?.geraetId)
    const z = ende(a.nach, 'to', qGeraet ? { x: qGeraet.x + 500, y: qGeraet.y } : undefined)
    if (!q?.portId || !z?.portId || !qGeraet) continue
    const zGeraet = geraet(z.geraetId)
    const qPort = portVon(qGeraet, q.portId)
    const zPort = portVon(zGeraet, z.portId)
    const ersetzen = a.ersetzen ? { replace: true } : {}
    if (a.wandler && qPort && zPort && zGeraet) {
      const mitte = { x: Math.round((qGeraet.x + zGeraet.x) / 2), y: Math.round((qGeraet.y + zGeraet.y) / 2) + 160 }
      const vorlage = findeWandlerVorlage(bibliothek, qPort.connectorType, zPort.connectorType)
      const r = vorlage
        ? schreiben('add_device', { template: vorlage.name, ...mitte })
        : schreiben('create_device', {
            name: `Converter ${qPort.connectorType} to ${zPort.connectorType}`,
            category: 'Converter',
            portGroups: [
              { direction: 'in', count: 1, connector: qPort.connectorType, labelPrefix: 'In' },
              { direction: 'out', count: 1, connector: zPort.connectorType, labelPrefix: 'Out' },
            ],
            ...mitte,
          })
      texte.push(r.text)
      const w = geraet(neueId(r))
      const wIn = w?.inputs.find((x) => x.connectorType === qPort.connectorType)
      const wOut = w?.outputs.find((x) => x.connectorType === zPort.connectorType)
      if (w && wIn && wOut) {
        kabel.push({ fromDeviceId: q.geraetId, fromPortId: q.portId, toDeviceId: w.id, toPortId: wIn.id })
        kabel.push({ fromDeviceId: w.id, fromPortId: wOut.id, toDeviceId: z.geraetId, toPortId: z.portId, ...ersetzen })
        continue
      }
    }
    kabel.push({ fromDeviceId: q.geraetId, fromPortId: q.portId, toDeviceId: z.geraetId, toPortId: z.portId, ...ersetzen })
  }
  if (!kabel.length) return { ok: false, texte: [...texte, 'Nothing to connect.'] }
  const r = schreiben('connect_many', { cables: kabel })
  texte.push(r.text)
  return { ok: r.ok, texte }
}
