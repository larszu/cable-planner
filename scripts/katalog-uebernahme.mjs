// ───────────────────────────────────────────────────────────────────────────
// Die Geraetetypen der Schwester-Planer in den Katalog des Kabel-Planers
// uebernehmen — Kamerabodies, Objektive und Rigs aus dem multicam-planner,
// Lichtgeraete aus dem light-planner.
//
// NUTZER-AUFTRAG 2026-09-23: „lege alle standard geraete aus dem multicam
// planner auch als standard geraete im cable planner an und alle licht
// geraete auch und vice versa".
//
// ─── WARUM EIN GENERATOR UND KEINE HANDARBEIT ──────────────────────────────
//
// Ueber 1300 Eintraege. Von Hand geschrieben waeren sie ab dem Tag falsch, an
// dem jemand im multicam-planner eine Kamera ergaenzt: der Katalog hier
// wuesste nichts davon, und die beiden Listen liefen auseinander — genau die
// zweite Wahrheit, gegen die ADR-001 geschrieben ist.
//
// Also: die erzeugten Dateien sind VENDORIERT (eingecheckt, damit der
// Kabel-Planer ohne die Nachbar-Repos baut), und dieses Skript zieht sie nach.
// `npm run katalog:check` meldet, wenn sie veraltet sind.
//
// ─── WAS UEBERNOMMEN WIRD UND WAS NICHT ────────────────────────────────────
//
// Uebernommen wird, was die Quelle als TATSACHE fuehrt: Hersteller, Modell,
// Datenblatt-Link, Leistung, Gewicht, Sensor, Brennweite, Reichweite.
//
// NICHT uebernommen werden Anschluesse — die Quellen kennen keine. Jeder
// erzeugte Eintrag traegt deshalb `portsUnknown: true`, den Marker aus
// `docs/device-identity-concept.md`:
//
//   > Unbekanntes wird explizit als unbekannt gefuehrt, nie geraten. Lieber
//   > ein sichtbares „Ports aus Datenblatt ergaenzen" als eine unsichtbare
//   > Falschaussage.
//
// Eine erfundene Belegung saehe im Plan genauso autoritativ aus wie eine
// echte und wanderte still in BOM, Patchliste und Verkabelung.
//
// ─── DIE GERAETETYP-ID IST ABGELEITET, NICHT GEWUERFELT ────────────────────
//
// UUIDv5 ueber einen festen Namensraum und die stabile Quell-Id
// (`avplan:camera:sony-fx6`). Damit rechnet JEDE App dieselbe GUID aus, ohne
// dass eine Liste hin und her kopiert werden muesste — und ein erneuter Lauf
// erzeugt dieselben Werte statt neuer.
//
// Die neun Kameras, die im multicam-planner schon eine von Hand gesetzte GUID
// tragen, behalten sie. Eine abgeleitete daruebergelegt haette die bestehende
// Verknuepfung zum Kamera-Katalog zerschnitten.
// ───────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'
import { KATEGORIE, SIGNAL, SIGNAL_GROSS, STECKER } from './easyschematic-vokabular.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const NUR_PRUEFEN = args.includes('--pruefen')

const HIER = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MULTICAM = resolve(flag('multicam', join(HIER, '..', '..', 'dev', 'multicam-planner')))
const LIGHT = resolve(
  flag('light', join(HIER, '..', '..', 'av-planner-suite', 'apps', 'light-planner')),
)
const LIB = join(HIER, 'src', 'renderer', 'lib')

// ─── UUIDv5 (RFC 4122 §4.3) ────────────────────────────────────────────────
//
// Der Namensraum ist festgeschrieben, damit er nie „mal eben" neu gewuerfelt
// wird: eine neue Wurzel hiesse neue GUIDs fuer alles, und jede gespeicherte
// Verknuepfung in jedem Projektfile zeigte ins Leere.
const NAMESPACE = 'a7f3c1e2-5b84-5d16-9c3a-7e2f4b8d0a61'

const uuid5 = (namespace, name) => {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const hash = createHash('sha1')
    .update(Buffer.concat([ns, Buffer.from(name, 'utf8')]))
    .digest()
  const b = Buffer.from(hash.subarray(0, 16))
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export const geraetetypId = (bereich, quellId) => uuid5(NAMESPACE, `avplan:${bereich}:${quellId}`)

const lade = async (datei, name) => {
  const mod = await import(pathToFileURL(datei).href)
  if (mod[name]) return mod[name]
  const erste = Object.values(mod).find((v) => Array.isArray(v) && v.length > 5)
  if (!erste) throw new Error(`keine Liste ${name} in ${datei}`)
  return erste
}

const ts = (wert) => {
  if (wert === undefined || wert === null || wert === '') return undefined
  if (typeof wert === 'number') return Number.isFinite(wert) ? String(wert) : undefined
  if (typeof wert === 'boolean') return String(wert)
  return `'${String(wert).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\s+/g, ' ').trim()}'`
}

/**
 * Ein Katalog-Eintrag in genau der Form, die `catalogSourceUrls.test.ts`
 * liest: der `// Quelle:`-Kommentar steht unmittelbar ueber dem Eintrag, und
 * `manufacturerUrl` ist die ERSTE Zeile im Template. Wer die Reihenfolge
 * aendert, macht den Beleg fuer den Waechter unsichtbar.
 */
const eintrag = ({ deviceTypeId, match, url, kategorie, felder, ports }) => {
  const z = []
  if (url) z.push(`  // Quelle: ${url}`)
  z.push('  {')
  if (match?.length) z.push(`    match: [${[...new Set(match)].map(ts).join(', ')}],`)
  z.push(`    deviceTypeId: ${ts(deviceTypeId)},`)
  z.push('    template: {')
  if (url) z.push(`      manufacturerUrl: ${ts(url)},`)
  z.push(`      name: ${ts(felder.name)},`)
  z.push(`      category: ${kategorie},`)
  for (const [k, v] of Object.entries(felder)) {
    if (k === 'name') continue
    const lit = ts(v)
    if (lit !== undefined) z.push(`      ${k}: ${lit},`)
  }
  if (ports) {
    const liste = (ps) =>
      ps.length === 0
        ? '[]'
        : `[\n${ps
            .map(
              (pt) =>
                `        { id: '', name: ${ts(pt.name)}, type: ${ts(pt.type)}, connectorType: ${ts(pt.connectorType)} },`,
            )
            .join('\n')}\n      ]`
    z.push(`      inputs: ${liste(ports.inputs)},`)
    z.push(`      outputs: ${liste(ports.outputs)},`)
  } else {
    z.push('      inputs: [],')
    z.push('      outputs: [],')
    z.push('      portsUnknown: true,')
  }
  z.push('    },')
  z.push('  },')
  return z.join('\n')
}

const schreibe = (name, inhalt) => {
  const pfad = join(LIB, name)
  let alt = null
  try {
    alt = readFileSync(pfad, 'utf8')
  } catch {
    /* noch nicht da */
  }
  if (alt === inhalt) return 'unveraendert'
  if (NUR_PRUEFEN) return 'VERALTET'
  writeFileSync(pfad, inhalt)
  return alt === null ? 'neu' : 'aktualisiert'
}

/**
 * Haendler-Adressen kommen NICHT als `manufacturerUrl` mit.
 *
 * Das Feld heisst so, wie es heisst, und die Eigenschaften-Leiste bietet es
 * als „Hersteller-Link" an. Eine Haendler-Seite dort ist kein
 * Schoenheitsfehler: sie verschwindet, wenn das Produkt aus dem Sortiment
 * faellt, und sie sagt dem Nutzer etwas anderes zu, als draufsteht.
 * `catalogSourceUrls.test.ts` prueft genau das — hier wird es gefiltert,
 * statt den Waechter zu erweitern.
 *
 * Gemessen 2026-09-24: 16 Eintraege des multicam-planners zeigen auf B&H.
 * Sie zaehlen hier als UNBELEGT, und das ist die richtige Auskunft: der
 * Beleg fuer das Datenblatt fehlt weiterhin. Im multicam-planner bleibt die
 * Adresse stehen — dort ist sie als Herkunftsbeleg der ZAHLEN dokumentiert
 * und nicht als Hersteller-Link.
 */
const HAENDLER = [
  'markertek.com', 'bhphotovideo.com', 'fullcompass.com', 'thomann.de',
  'sweetwater.com', 'newegg.com', 'amazon.com', 'amazon.de', 'ebay.com',
  'adorama.com', 'musicstore.de', 'soundpro.com', 'geartechs.com',
]

const istHaendler = (url) => {
  if (!url) return false
  try {
    const host = new URL(url).host.replace(/^www\./, '')
    return HAENDLER.some((h) => host.endsWith(h))
  } catch {
    return false
  }
}

/** Die Adresse, wenn sie als Hersteller-Link taugt — sonst nichts. */
const herstellerUrl = (url) => (istHaendler(url) ? undefined : url)

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

const datei = (name, kopf, konstante, saat, kategorieKonstante, kategorieWert, eintraege) =>
  [
    kopf,
    "import type { EquipmentTemplate } from '../types/equipment'",
    '',
    `const ${kategorieKonstante} = '${kategorieWert}'`,
    '',
    '/** Katalog-Eintrag: stabile Geraetetyp-Id plus Vorlage. `match` traegt die',
    ' *  normalisierten Namensformen, ueber die ein Import ohne GUID aufloest. */',
    `export interface ${name} {`,
    '  deviceTypeId: string',
    '  match: string[]',
    '  template: EquipmentTemplate',
    '}',
    '',
    `export const ${konstante}: ${name}[] = [`,
    eintraege.join('\n'),
    ']',
    '',
    `/** Die Vorlagen allein — fuer die Bibliotheks-Saat in \`projectStore\`. */`,
    `export const ${saat}: EquipmentTemplate[] =`,
    `  ${konstante}.map((e) => ({ ...e.template, deviceTypeId: e.deviceTypeId }))`,
    '',
  ].join('\n')

/**
 * Der Kopf einer erzeugten Katalog-Datei.
 *
 * DIE REIHENFOLGE IST NICHT KOSMETIK. `tests/katalogBeleglage.test.ts` (B-11)
 * verlangt von einem Katalog OHNE jeden Beleg genau eine Zeile —
 * `// BELEGLAGE: kein Datenblatt-Link je Eintrag (B-11).` — und dass OBERHALB
 * davon das Wort „Datenblatt" NICHT fällt. Der Grund ist gut: was über der
 * Zeile steht, liest man als Zusage; was darunter steht, erklärt die Lücke.
 * Deshalb steht bei `belegt === 0` die Beleglage-Zeile vor jedem anderen Satz.
 */
const BELEGLAGE_ZEILE = '// BELEGLAGE: kein Datenblatt-Link je Eintrag (B-11).'

/**
 * Dateirumpf fuer einen Katalog, dessen Eintraege VERSCHIEDENE Kategorien
 * tragen.
 *
 * `datei()` schreibt oben eine Konstante (`const CAM = 'Cameras'`) und setzt
 * sie in jeden Eintrag — das passt, solange ein Katalog genau eine Kategorie
 * hat. Die EasySchematic-Uebernahme verteilt sich auf ueber vierzig; dort
 * steht die Kategorie als Literal am Eintrag.
 */
/** Wie viele Eintraege in einem Teilstueck stehen. Siehe `datei_`. */
const STUECK = 400

const datei_ = (name, kopf, konstante, saat, eintraege) => {
  // ─── WARUM DIE LISTE ZERTEILT IST ────────────────────────────────────────
  //
  // Als EIN Literal mit 3982 Eintraegen bricht TypeScript ab:
  //
  //   error TS2590: Expression produces a union type that is too complex to
  //   represent.
  //
  // Der Pruefer leitet fuer ein Array-Literal den Vereinigungstyp seiner
  // Elemente her, und bei 3982 Eintraegen mit zusammen 44 376 Anschluessen
  // sprengt der jede Grenze — die Anmerkung `: EasySchematicEntry[]` haelt
  // ihn davon NICHT ab. Teilstuecke von je ${STUECK} und ein Zusammenlegen am
  // Ende umgehen das, ohne einen Typ wegzuwerfen: jedes Stueck ist
  // vollstaendig geprueft.
  const stuecke = []
  for (let i = 0; i < eintraege.length; i += STUECK) {
    stuecke.push(eintraege.slice(i, i + STUECK))
  }
  const teile = stuecke.map(
    (st, i) => `const TEIL_${i + 1}: ${name}[] = [\n${st.join('\n')}\n]`,
  )
  return [
    kopf,
    "import type { EquipmentTemplate } from '../types/equipment'",
    '',
    '/** Katalog-Eintrag: stabile Geraetetyp-Id plus Vorlage. `match` traegt die',
    ' *  normalisierten Namensformen, ueber die ein Import ohne GUID aufloest. */',
    `export interface ${name} {`,
    '  deviceTypeId: string',
    '  match: string[]',
    '  template: EquipmentTemplate',
    '}',
    '',
    teile.join('\n\n'),
    '',
    `export const ${konstante}: ${name}[] = [`,
    stuecke.map((_, i) => `  ...TEIL_${i + 1},`).join('\n'),
    ']',
    '',
    '/** Die Vorlagen allein — fuer die Bibliotheks-Saat in `projectStore`. */',
    `export const ${saat}: EquipmentTemplate[] =`,
    `  ${konstante}.map((e) => ({ ...e.template, deviceTypeId: e.deviceTypeId }))`,
    '',
  ].join('\n')
}

const ERZEUGT = (quelle, anzahl, belegt, opt = {}) => {
  const kasten = `// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  ERZEUGT — nicht von Hand aendern.                                    ║
// ║  Quelle: ${quelle.padEnd(60)}║
// ║  Nachziehen: npm run katalog:uebernahme                               ║
// ║  Pruefen:    npm run katalog:check                                    ║
// ╚═══════════════════════════════════════════════════════════════════════╝`
  const marker = `// JEDER EINTRAG TRAEGT \`portsUnknown: true\`. Die Quelle kennt keine
// Anschluesse, und eine erfundene Belegung saehe im Plan genauso autoritativ
// aus wie eine echte — sie wanderte still in BOM, Patchliste und Verkabelung.
// Der Marker ist der Weg aus \`docs/device-identity-concept.md\`: der
// Plan-Check fordert die Datenblatt-Ergaenzung ein, und sobald jemand reale
// Ports eintraegt, entfernt die Eigenschaften-Leiste das Flag selbst.`
  const portteil = opt.ports ?? marker
  if (belegt === 0) {
    return `${kasten}
//
${BELEGLAGE_ZEILE}
//
// ${anzahl} Eintraege, kein einziger mit Beleg. Die Quelle nennt keine
// Hersteller-Adresse; eine zu erfinden waere schlimmer als die Luecke.
//
${portteil}
`
  }
  return `${kasten}
//
// ${anzahl} Eintraege, davon ${belegt} mit Datenblatt-Link.
//
${portteil}
`
}

// ─── Kamerabodies ──────────────────────────────────────────────────────────
const kameras = async () => {
  const CAMERAS = await lade(join(MULTICAM, 'src', 'data', 'cameras.ts'), 'CAMERAS')
  const { CAMERA_CATALOG } = await import(pathToFileURL(join(LIB, 'cameraCatalog.ts')).href)
  // Was der handgepflegte Kamera-Katalog schon fuehrt, kommt hier NICHT
  // zweimal vor: dort stehen echte Datenblatt-Ports, hier nur der Body.
  const belegt = new Set([
    ...CAMERA_CATALOG.map((e) => e.deviceTypeId),
    ...CAMERA_CATALOG.map((e) => norm(e.template.name)),
  ])

  const eintraege = []
  const verknuepfung = []
  let mitBeleg = 0
  for (const c of CAMERAS) {
    const name = `${c.manufacturer} ${c.model}`
    const id = c.deviceTypeId ?? geraetetypId('camera', c.id)
    verknuepfung.push({ quellId: c.id, deviceTypeId: id })
    if (belegt.has(c.deviceTypeId) || belegt.has(norm(name))) continue
    const url = herstellerUrl(c.manufacturerUrl)
    if (url) mitBeleg += 1
    eintraege.push(
      eintrag({
        deviceTypeId: id,
        match: [norm(name), norm(c.model)],
        url,
        kategorie: 'CAM',
        felder: {
          name,
          subtitle: c.type,
          notes: [c.sensor?.name, `${c.mount} mount`, c.resolutions?.join('/'), c.notes]
            .filter(Boolean)
            .join(' · '),
          width: 240,
          height: 160,
        },
      }),
    )
  }
  return {
    inhalt: datei(
      'CameraBodyEntry',
      ERZEUGT('multicam-planner src/data/cameras.ts', eintraege.length, mitBeleg) +
        `//
// ─── WARUM ZWEI KAMERA-KATALOGE ────────────────────────────────────────────
//
// \`cameraCatalog.ts\` fuehrt ${CAMERA_CATALOG.length} Modelle MIT Datenblatt-Ports — von Hand
// recherchiert, Buchse fuer Buchse. Diese Datei fuehrt die uebrigen ${eintraege.length}
// Bodies OHNE. Die beiden zusammenzulegen hiesse, den Unterschied zwischen
// „nachgesehen" und „noch nicht nachgesehen" zu verwischen — und genau der
// ist die Auskunft, die jemand vor dem Bestellen braucht.
//
// Wer hier einen Body mit echten Ports belegt, verschiebt ihn nach
// \`cameraCatalog.ts\`; dieser Generator laesst ihn dann von selbst weg.`,
      'CAMERA_BODY_CATALOG',
      'cameraBodyTemplates',
      'CAM',
      'Cameras',
      eintraege,
    ),
    verknuepfung,
    anzahl: eintraege.length,
    mitBeleg,
  }
}

// ─── Objektive ─────────────────────────────────────────────────────────────
const objektive = async () => {
  const LENSES = await lade(join(MULTICAM, 'src', 'data', 'lenses.ts'), 'LENSES')
  const eintraege = []
  const verknuepfung = []
  const gesehen = new Set()
  let mitBeleg = 0
  for (const l of LENSES) {
    const name = `${l.manufacturer} ${l.model}`
    const id = geraetetypId('lens', l.id)
    verknuepfung.push({ quellId: l.id, deviceTypeId: id })
    // Gleicher Name zweimal waere in der Bibliotheks-Seitenleiste eine Zeile,
    // die man nicht auseinanderhalten kann — die Saat legt ohnehin nur die
    // erste an. Also hier schon auslassen, sichtbar in der Zaehlung.
    if (gesehen.has(norm(name))) continue
    gesehen.add(norm(name))
    const url = herstellerUrl(l.manufacturerUrl)
    if (url) mitBeleg += 1
    const brennweite =
      l.focalLengthMin === l.focalLengthMax
        ? `${l.focalLengthMin} mm`
        : `${l.focalLengthMin}-${l.focalLengthMax} mm`
    eintraege.push(
      eintrag({
        deviceTypeId: id,
        match: [norm(name), norm(l.model)],
        url,
        kategorie: 'LENS',
        felder: {
          name,
          subtitle: `${brennweite} · ${l.mount}`,
          notes: [
            brennweite,
            `T/F ${l.maxApertureWide}`,
            `${l.mount} mount`,
            l.squeeze && l.squeeze !== 1 ? `anamorphic ${l.squeeze}x` : null,
            l.notes,
          ]
            .filter(Boolean)
            .join(' · '),
          width: 200,
          height: 120,
        },
      }),
    )
  }
  return {
    inhalt: datei(
      'LensEntry',
      ERZEUGT('multicam-planner src/data/lenses.ts', eintraege.length, mitBeleg) +
        `//
// ─── WAS EIN OBJEKTIV IM KABELPLAN SOLL ────────────────────────────────────
//
// Es haengt an keinem Kabel — bis es das doch tut: eine B4-Box-Optik fuehrt
// Zoom- und Fokus-Steuerung ueber eigene Leitungen, und genau die vergisst
// man beim Packen. Der Kabel-Planer fuehrt sie deshalb als Geraet mit
// \`portsUnknown\`, nicht als Zubehoer ohne Anschluss: „keine Anschluesse"
// waere eine Aussage ueber Hardware, die hier niemand nachgesehen hat.`,
      'LENS_CATALOG',
      'lensTemplates',
      'LENS',
      'Lenses',
      eintraege,
    ),
    verknuepfung,
    anzahl: eintraege.length,
    mitBeleg,
  }
}

// ─── Rigs ──────────────────────────────────────────────────────────────────
const rigs = async () => {
  const RIGS = await lade(join(MULTICAM, 'src', 'data', 'rigs.ts'), 'RIGS')
  const eintraege = []
  const verknuepfung = []
  for (const r of RIGS) {
    const id = geraetetypId('rig', r.id)
    verknuepfung.push({ quellId: r.id, deviceTypeId: id })
    const name = r.manufacturer && !r.name.startsWith(r.manufacturer)
      ? `${r.manufacturer} ${r.name}`
      : r.name
    eintraege.push(
      eintrag({
        deviceTypeId: id,
        match: [norm(name), norm(r.name)],
        url: herstellerUrl(r.manufacturerUrl),
        kategorie: 'RIG',
        felder: {
          name,
          subtitle: r.type,
          notes: [
            `${r.minHeightM}-${r.maxHeightM} m`,
            r.armLengthM ? `arm ${r.armLengthM} m` : null,
            r.telescopeM ? `telescope ${r.telescopeM} m` : null,
            r.trackLengthM ? `travel ${r.trackLengthM} m` : null,
            r.payloadKg ? `payload ${r.payloadKg} kg` : null,
            r.footprintM ? `footprint ${r.footprintM.w}x${r.footprintM.d} m` : null,
            r.notes,
          ]
            .filter(Boolean)
            .join(' · '),
          width: 200,
          height: 120,
        },
      }),
    )
  }
  return {
    inhalt: datei(
      'RigEntry',
      ERZEUGT('multicam-planner src/data/rigs.ts', eintraege.length, 0) +
        `//
// ─── OHNE DATENBLATT-LINK, UND DAS STEHT HIER ──────────────────────────────
//
// Die Quelle fuehrt fuer keines dieser Rigs eine Hersteller-Adresse. Eine zu
// erfinden waere schlimmer als keine; \`catalogueEvidence\` zaehlt sie deshalb
// vollstaendig als unbelegt, und \`catalogSourceUrls.test.ts\` fuehrt diese
// Datei in der Liste der Kataloge ohne Beleg.
//
// Die Maße dagegen SIND belegt — sie stehen im Kopf von \`rigs.ts\` mit ihrer
// Herkunft, einschliesslich der Stellen, an denen die Objektivhoehe geschaetzt
// ist. Diese Schaetzungen sind dort im \`notes\`-Feld markiert und kommen mit.`,
      'RIG_CATALOG',
      'rigTemplates',
      'RIG',
      'Tripods',
      eintraege,
    ),
    verknuepfung,
    anzahl: eintraege.length,
    mitBeleg: 0,
  }
}

// ─── Lichtgeraete ──────────────────────────────────────────────────────────
//
// ZWEI SORTEN EINTRAG, und die Liste sagt welche. Die sieben `Generic`-
// Bauformen (1-kW-Fresnel, PAR64 CP60/61/62, PAR56, LED-PAR 54x3) behaupten
// keinen Hersteller und koennen deshalb keinen Beleg tragen — dieselbe Lage
// wie im `passiveCatalog` („Eine 6-fach-Steckdosenleiste hat kein
// Datenblatt; ihr eines anzudichten waere schlimmer als keins").
//
// WARUM AUCH HIER `portsUnknown` UND KEINE ABGELEITETEN ANSCHLUESSE. Nahe
// lag es: `powerConnector` und `dmxChannels` stehen in der Quelle, also
// koennte man daraus „Power In" und „DMX In" machen. Nur ist der STECKER der
// DMX-Buchse damit nicht gesagt — 3-polig oder 5-polig ist genau die Angabe,
// wegen der jemand mit dem falschen Kabel vor dem Truss steht. Und ein
// Geraet mit Durchschleif-Ausgang hat zwei, eines ohne hat einen. Beides
// waere geraten. Die Angaben stehen deshalb im `notes`-Feld, wo sie als
// Auskunft lesbar sind, statt als Buchse, an die man ein Kabel zeichnet.
const licht = async () => {
  const mod = await import(pathToFileURL(join(LIGHT, 'src', 'core', 'fixtureLibrary.ts')).href)
  // DIE PORT-REGEL WIRD IMPORTIERT, NICHT NACHGEBAUT. `integration/equipment.ts`
  // im light-planner setzt eine dort platzierte Leuchte bereits in ein
  // Kabel-Planer-Geraet um — mit DMX In, DMX Thru und einer Power-Buchse, deren
  // Steckertyp aus `powerConnector` kommt. Haette dieser Generator daneben eine
  // eigene Regel gestellt, gaebe es zwei Antworten auf dieselbe Frage: eine
  // Leuchte aus dem Licht-Plan haette Buchsen, dieselbe Leuchte aus der
  // Bibliothek nicht. Genau diese Defektform (`zwei-rechnungen`) steht im Kopf
  // von `equipment.ts` als Befund, den dort schon jemand bezahlt hat.
  const { powerConnectorToCp } = await import(
    pathToFileURL(join(LIGHT, 'src', 'integration', 'equipment.ts')).href
  )
  const { modesOf } = await import(pathToFileURL(join(LIGHT, 'src', 'core', 'patch.ts')).href)
  const FIXTURES = mod.fixtureLibrary
  const ATTACHMENTS = mod.attachmentLibrary ?? []
  let ohneSteckerAngabe = 0
  let ohneDmx = 0
  const eintraege = []
  const verknuepfung = []
  let mitBeleg = 0
  const ohneBeleg = []

  for (const f of FIXTURES) {
    const id = geraetetypId('fixture', f.id)
    verknuepfung.push({ quellId: f.id, deviceTypeId: id })
    const name = f.name.startsWith(f.manufacturer) ? f.name : `${f.manufacturer} ${f.name}`
    const url = herstellerUrl(f.manufacturerUrl)
    if (url) mitBeleg += 1
    else ohneBeleg.push(name)
    const modi = f.dmxModes?.length
      ? f.dmxModes.map((m) => `${m.name ?? 'Modus'} ${m.channels} ch`).join(', ')
      : f.dmxChannels
        ? `${f.dmxChannels} ch`
        : null
    eintraege.push(
      eintrag({
        deviceTypeId: id,
        match: [norm(name), norm(f.name)],
        url,
        kategorie: 'LIGHT',
        felder: {
          name,
          subtitle: f.category,
          powerWatts: f.wattage,
          weightKg: f.weight,
          notes: [
            f.lumens ? `${f.lumens} lm` : null,
            f.zoomRange ? `zoom ${f.zoomRange[0]}-${f.zoomRange[1]}°` : `beam ${f.beamAngle}°`,
            f.colorTempRange
              ? `${f.colorTempRange[0]}-${f.colorTempRange[1]} K`
              : f.colorTemp
                ? `${f.colorTemp} K`
                : 'RGBW',
            f.cri ? `CRI ${f.cri}` : null,
            f.powerConnector ? `power ${f.powerConnector}` : null,
            modi ? `DMX ${modi}` : null,
            f.ipRating ? f.ipRating : null,
            `mount ${f.mountType}`,
          ]
            .filter(Boolean)
            .join(' · '),
          width: 200,
          height: 140,
        },
        ports: (() => {
          // `modesOf` ist die Fixture-Ebene derselben Frage, die
          // `equipment.ts` mit `footprint(pf)` auf der Platzierungs-Ebene
          // stellt: hat dieses Geraet ueberhaupt eine DMX-Ansteuerung? Leer
          // heisst „konventionelle Leuchte am Dimmer" — sie bekommt eine
          // Kanalnummer, aber keine DMX-Buchse. Ihr eine anzudichten hiesse,
          // eine DMX-Leitung zum 1-kW-Stufenlinsenscheinwerfer zu planen.
          const hatDmx = modesOf(f).length > 0
          if (!hatDmx) ohneDmx += 1
          if (!f.powerConnector) ohneSteckerAngabe += 1
          const dmx = { type: 'DMX', connectorType: 'DMX 5-pol (XLR)' }
          return {
            inputs: [
              ...(hatDmx ? [{ name: 'DMX In', ...dmx }] : []),
              { name: 'Power', type: 'Power', connectorType: powerConnectorToCp(f.powerConnector) },
            ],
            outputs: hatDmx ? [{ name: 'DMX Thru', ...dmx }] : [],
          }
        })(),
      }),
    )
  }

  // Vorsaetze (Fresnel-Linse, Softbox, Torblende) sind KEINE Geraete im
  // Kabelplan: sie fuehren keinen Strom und keine Daten, sie veraendern das
  // Licht. Sie kommen als Zeile in den Kopf, damit sichtbar bleibt, dass sie
  // bewusst fehlen und nicht vergessen wurden.
  return {
    inhalt: datei(
      'FixtureEntry',
      ERZEUGT('light-planner src/core/fixtureLibrary.ts', eintraege.length, mitBeleg, {
        ports: `// ─── DIESE EINTRAEGE HABEN ANSCHLUESSE ─────────────────────────────────────
//
// Anders als die Kameras, Objektive und Rigs: der light-planner beantwortet
// die Frage nach den Buchsen bereits. \`integration/equipment.ts\` setzt eine
// platzierte Leuchte in ein Kabel-Planer-Geraet um — DMX In, DMX Thru und eine
// Power-Buchse, deren Steckertyp aus \`powerConnector\` kommt. DIESE REGEL WIRD
// IMPORTIERT (\`powerConnectorToCp\`, \`modesOf\`), nicht nachgebaut: eine zweite
// Regel daneben hiesse, dass dieselbe Leuchte aus dem Licht-Plan Buchsen hat
// und aus der Bibliothek nicht.
//
// ${ohneDmx} Eintraege bekommen KEINE DMX-Buchse. Das ist eine Aussage und kein
// Versehen: eine konventionelle Leuchte am Dimmer hat keine. Ihr eine
// anzudichten hiesse, eine DMX-Leitung zum Stufenlinsenscheinwerfer zu planen.
//
// ${ohneSteckerAngabe} Eintraege nennen keinen Netzstecker. Sie bekommen den Rueckfall aus
// \`powerConnectorToCp\` (PowerCON) — dieselbe Annahme wie im Licht-Plan, und
// damit dieselbe an beiden Stellen. Wer sie korrigiert, korrigiert sie in
// \`fixtureLibrary.ts\`; von dort holt sie der Generator.`,
      }) +
        `//
// ─── ZWEI SORTEN LUECKE, UND SIE BEDEUTEN VERSCHIEDENES ────────────────────
//
// ${ohneBeleg.length} Eintraege ohne Datenblatt-Link. Davon sind sieben
// \`Generic\`-Bauformen, die keinen Hersteller behaupten — bei ihnen ist die
// Leere die richtige Antwort. Die uebrigen sind offene Recherche: die
// Herstellerseite war aus der Arbeitsumgebung nicht erreichbar oder die
// Suche fand zum genannten Modellnamen keine Produktseite.
//
// Offen (Stand 2026-09-24):
${ohneBeleg.map((n) => `//   ${n}`).join('\n')}
//
// DREI MODELLNAMEN, DIE DER HERSTELLER SO NICHT FUEHRT — aufgefallen bei der
// Recherche, hier festgehalten statt stillschweigend angeglichen:
//   Aputure „LS 300x II"       — aputure.com fuehrt LS 300x und LS 300d II.
//   Chauvet „COLORdash Par H18IP" — die Seite kennt H18X und H18 XIP.
//   Chauvet „Rogue R2 Spot"    — die Seite kennt R2E Spot und R2X Spot.
// Ob die Bibliothek sich vertippt hat oder das Modell ausgelaufen ist, sagt
// keine der beiden Quellen. Geraten wird nichts.
//
// ─── VORSAETZE FEHLEN ABSICHTLICH ──────────────────────────────────────────
//
// ${ATTACHMENTS.length} Vorsaetze (Fresnel-Linse, Softbox, Lantern, Torblende, Snoot)
// stehen im light-planner und kommen NICHT mit: sie fuehren weder Strom noch
// Daten. Im Kabelplan waeren sie Kaestchen ohne Anschluss, die jede Liste
// verlaengern und keine Frage beantworten.`,
      'FIXTURE_CATALOG',
      'fixtureTemplates',
      'LIGHT',
      'Lighting',
      eintraege,
    ),
    verknuepfung,
    anzahl: eintraege.length,
    mitBeleg,
  }
}

// ─── EasySchematic ─────────────────────────────────────────────────────────
//
// Uebernahme der Gemeinschafts-Datenbank von EasySchematic
// (https://api.easyschematic.live/templates, Projekt
// https://github.com/duremovich/EasySchematic, AGPL-3.0), auf ausdrueckliche
// Anweisung des Eigentuemers am 2026-09-24.
//
// ─── DAS IST DER ERSTE UEBERNOMMENE KATALOG MIT ANSCHLUESSEN ───────────────
//
// Kameras, Objektive und Rigs kamen mit `portsUnknown`, weil ihre Quellen
// keine Buchsen kennen. Diese hier kennt sie: 45 033 Anschluesse mit Richtung,
// Signalart und Steckertyp. Sie werden uebersetzt, nicht geraten — die
// Abbildung steht als Tabelle in `easyschematic-vokabular.mjs`, damit man sie
// Zeile fuer Zeile pruefen kann.
//
// ─── DIE RICHTUNG IST EINE ENTSCHEIDUNG, ALSO STEHT SIE HIER ───────────────
//
//   input         -> `inputs`
//   output        -> `outputs`
//   bidirectional -> `inputs`  (11 579 Anschluesse)
//   passthrough   -> `outputs` (645)
//
// Unser Modell trennt Ein- und Ausgang; ihres kennt zusaetzlich die
// beidseitige Buchse. Eine RJ45 an einem Switch IST beides, und sie in BEIDE
// Listen zu legen haette jeden Switch mit der doppelten Portzahl gezeigt —
// eine Falschaussage in jeder Stueckliste. Sie steht deshalb dort, wo man ein
// Kabel hineinsteckt. Ein `passthrough` (Strom-Durchschleifung, Video-Loop)
// geht weiter und steht bei den Ausgaengen.
//
// ─── KEIN DATENBLATT-LINK ──────────────────────────────────────────────────
//
// Ihre Eintraege fuehren keinen. Die Quelle ist die Gemeinschafts-Datenbank
// und nicht das Blatt des Herstellers — `catalogueEvidence` zaehlt sie
// deshalb vollstaendig als unbelegt, und der Dateikopf traegt die
// BELEGLAGE-Zeile. Das ist keine Formalie: eine Portzahl aus zweiter Hand ist
// eine andere Auskunft als eine aus dem Datenblatt, und der Plan soll den
// Unterschied nicht verwischen.
const easySchematic = async () => {
  const datei = flag('easyschematic', join(HIER, 'scripts', 'easyschematic-templates.json'))
  let roh
  try {
    roh = JSON.parse(readFileSync(datei, 'utf8'))
  } catch {
    console.log(
      `easySchematicCatalog.ts    uebersprungen   (${datei} fehlt — holen mit:\n` +
        '  curl -s https://api.easyschematic.live/templates -o scripts/easyschematic-templates.json)',
    )
    return null
  }

  const rueckfall = { stecker: new Map(), gesamt: 0 }
  const steckerVon = (p) => {
    const roh = (p.connectorType ?? '').trim()
    const signal = (p.signalType ?? '').trim()
    // Eine fuenfpolige XLR mit DMX IST der DMX-Stecker, und die Patchliste
    // soll ihn so nennen. Zwei Felder, eine Aussage — deshalb hier und nicht
    // in der Tabelle.
    if (signal === 'dmx' && roh === 'xlr-5') return 'DMX 5-pol (XLR)'
    if (signal === 'dmx' && roh === 'xlr-3') return 'DMX 3-pol (XLR)'
    if (signal === 'midi' && roh === 'din-5') return 'MIDI'
    const treffer = STECKER[roh]
    if (treffer) return treffer
    rueckfall.gesamt += 1
    rueckfall.stecker.set(roh || '(leer)', (rueckfall.stecker.get(roh || '(leer)') ?? 0) + 1)
    return 'Custom'
  }
  const signalVon = (p) => {
    const s = (p.signalType ?? '').trim()
    if (SIGNAL[s]) return SIGNAL[s]
    if (SIGNAL_GROSS.has(s)) return s.toUpperCase()
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Custom'
  }

  const neueKategorien = new Set()
  const eintraege = []
  const gesehen = new Set()
  let ausgelassen = 0
  let anschluesse = 0

  for (const t of roh) {
    const name = `${(t.manufacturer ?? '').trim()} ${(t.label ?? '').trim()}`.trim()
    if (!name || !t.id) { ausgelassen += 1; continue }
    // Gleicher Name zweimal waere in der Bibliotheks-Seitenleiste eine Zeile,
    // die man nicht auseinanderhalten kann.
    const schluessel = norm(name)
    if (gesehen.has(schluessel)) { ausgelassen += 1; continue }
    gesehen.add(schluessel)

    const kat = (t.category ?? '').trim() || 'Other'
    const kategorie = KATEGORIE[kat] ?? kat
    if (!KATEGORIE[kat]) neueKategorien.add(kategorie)

    const inputs = []
    const outputs = []
    for (const p of t.ports ?? []) {
      anschluesse += 1
      const anschluss = {
        name: (p.label ?? '').trim() || (p.signalType ?? 'Port'),
        type: signalVon(p),
        connectorType: steckerVon(p),
      }
      const r = (p.direction ?? '').trim()
      if (r === 'output' || r === 'passthrough') outputs.push(anschluss)
      else inputs.push(anschluss)
    }

    eintraege.push(
      eintrag({
        deviceTypeId: t.id,
        match: [schluessel, norm(t.label ?? '')],
        kategorie: ts(kategorie),
        felder: {
          name,
          ...(t.deviceType ? { subtitle: String(t.deviceType) } : {}),
          width: 240,
          height: Math.min(520, 120 + Math.max(inputs.length, outputs.length) * 18),
        },
        ports: { inputs, outputs },
      }),
    )
  }

  return {
    inhalt: datei_(
      'EasySchematicEntry',
      ERZEUGT('EasySchematic — api.easyschematic.live/templates', eintraege.length, 0, {
        ports: `// ─── HERKUNFT ──────────────────────────────────────────────────────────────
//
// EasySchematic, Gemeinschafts-Datenbank, gelesen ueber die offene API
// \`https://api.easyschematic.live/templates\`. Projekt:
// \`https://github.com/duremovich/EasySchematic\` (AGPL-3.0). Uebernommen auf
// ausdrueckliche Anweisung des Eigentuemers am 2026-09-24.
//
// ─── DER ERSTE UEBERNOMMENE KATALOG MIT ANSCHLUESSEN ───────────────────────
//
// ${anschluesse} Anschluesse mit Richtung, Signalart und Steckertyp. Sie sind
// UEBERSETZT und nicht geraten: die Abbildung ihrer 84 Steckertypen und 73
// Signalarten auf unsere steht als pruefbare Tabelle in
// \`scripts/easyschematic-vokabular.mjs\`.
//
// ${rueckfall.gesamt} Anschluesse fielen auf \`Custom\` zurueck, weil die Tabelle ihren
// Steckertyp nicht kennt. Das ist Absicht: den naechstbesten zu nehmen waere
// eine Falschaussage in der Patchliste, \`Custom\` ist eine Luecke, die
// auffaellt. Betroffen sind${[...rueckfall.stecker.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ` ${k} (${v})`).join(',') || ' keine'}.
//
// ─── DIE RICHTUNG ──────────────────────────────────────────────────────────
//
// \`input\` und \`bidirectional\` werden Eingaenge, \`output\` und
// \`passthrough\` Ausgaenge. Unser Modell trennt Ein- und Ausgang; ihres kennt
// zusaetzlich die beidseitige Buchse. Eine RJ45 am Switch IST beides — sie in
// BEIDE Listen zu legen haette jeden Switch mit der doppelten Portzahl
// gezeigt, und das waere eine Falschaussage in jeder Stueckliste.
//
// ${ausgelassen} Eintraege ausgelassen (Name doppelt oder leer).`,
      }),
      'EASYSCHEMATIC_CATALOG',
      'easySchematicTemplates',
      eintraege,
    ),
    neueKategorien: [...neueKategorien].sort(),
    anzahl: eintraege.length,
    mitBeleg: 0,
  }
}

// ─── Lauf ──────────────────────────────────────────────────────────────────
const stand = []
const k = await kameras()
stand.push(['cameraBodyCatalog.ts', schreibe('cameraBodyCatalog.ts', k.inhalt), k.anzahl, k.mitBeleg])
const o = await objektive()
stand.push(['lensCatalog.ts', schreibe('lensCatalog.ts', o.inhalt), o.anzahl, o.mitBeleg])
const r = await rigs()
stand.push(['rigCatalog.ts', schreibe('rigCatalog.ts', r.inhalt), r.anzahl, r.mitBeleg])
const l = await licht()
stand.push(['fixtureCatalog.ts', schreibe('fixtureCatalog.ts', l.inhalt), l.anzahl, l.mitBeleg])
const es = await easySchematic()
if (es) {
  stand.push([
    'easySchematicCatalog.ts',
    schreibe('easySchematicCatalog.ts', es.inhalt),
    es.anzahl,
    es.mitBeleg,
  ])
  writeFileSync(
    join(HIER, 'scripts', 'easyschematic-kategorien.json'),
    `${JSON.stringify(es.neueKategorien, null, 2)}\n`,
  )
  console.log(`\n${es.neueKategorien.length} neue Kategorien: ${es.neueKategorien.join(', ')}`)
}

// ─── DIE GEGENRICHTUNG ─────────────────────────────────────────────────────
//
// Bis hierher weiss der Kabel-Planer, welche GUID zu welchem Geraet gehoert —
// die Nachbarn wissen es nicht. Beim Export schrieb `cameraExport.ts` deshalb
// bei 368 von 377 Kameras `deviceTypeId: undefined`, und der Kabel-Planer
// musste wieder ueber den Modellnamen raten. Genau das sollte die GUID
// abschaffen.
//
// WARUM EINE TABELLE UND NICHT DIE RECHNUNG. UUIDv5 braucht SHA-1. Im Browser
// ist das `crypto.subtle.digest` und damit ASYNCHRON — eine Nachschlage-
// funktion, die ein Promise zurueckgibt, muesste jeden Aufrufer anfassen. Die
// Rechnung laeuft deshalb HIER, einmal, und die Nachbarn bekommen das
// Ergebnis als erzeugte Tabelle. Eine Wahrheit, drei vendorierte Abschriften —
// und dieses Skript zieht alle drei zugleich nach, damit sie nicht
// auseinanderlaufen koennen.
const verknuepfung = {
  camera: Object.fromEntries(k.verknuepfung.map((v) => [v.quellId, v.deviceTypeId])),
  lens: Object.fromEntries(o.verknuepfung.map((v) => [v.quellId, v.deviceTypeId])),
  rig: Object.fromEntries(r.verknuepfung.map((v) => [v.quellId, v.deviceTypeId])),
  fixture: Object.fromEntries(l.verknuepfung.map((v) => [v.quellId, v.deviceTypeId])),
}

const idTabelle = (bereiche, sprache) => {
  const semi = sprache === 'ts-semi' ? ';' : ''
  const z = [
    '// ╔═══════════════════════════════════════════════════════════════════════╗',
    '// ║  ERZEUGT — nicht von Hand aendern.                                    ║',
    '// ║  Quelle: cable-planner scripts/katalog-uebernahme.mjs                 ║',
    '// ╚═══════════════════════════════════════════════════════════════════════╝',
    '//',
    '// Die stabile Geraetetyp-Id (GDTF/DIN-SPEC-15800-analog: FixtureTypeID) je',
    '// Katalog-Eintrag. Sie ist UUIDv5 ueber einen festen Namensraum und die',
    `// Quell-Id dieses Repos — \`avplan:camera:sony-fx6\` und so weiter.`,
    '//',
    '// WOZU SIE DA IST: damit ein Geraet, das zwischen den Planern wandert, sein',
    '// Datenblatt AUTORITATIV wiederfindet statt ueber den Modellnamen geraten zu',
    '// werden. Ein Name veraltet beim Umbenennen und existiert in zwei',
    '// Schreibweisen; diese Id nicht.',
    '//',
    '// DIE NEUN VON HAND GESETZTEN GUIDS STEHEN WEITER IN `cameras.ts` und',
    '// gewinnen: sie sind aelter als diese Ableitung, und eine gespeicherte',
    '// Verknuepfung in einem Projektfile zeigt auf sie.',
    '//',
    `// Nachziehen: im cable-planner \`npm run katalog:uebernahme\`.`,
    '',
    'export const GERAETETYP_IDS: Record<string, Record<string, string>> = {',
  ]
  for (const [bereich, tabelle] of Object.entries(bereiche)) {
    z.push(`  ${bereich}: {`)
    for (const [quellId, id] of Object.entries(tabelle)) {
      z.push(`    '${quellId}': '${id}',`)
    }
    z.push('  },')
  }
  z.push(`}${semi}`)
  z.push('')
  z.push('/** Die Geraetetyp-Id zu einer Quell-Id, oder `undefined` wenn keine erzeugt')
  z.push(' *  wurde. `undefined` heisst „zu diesem Geraet gibt es keinen Katalog-Eintrag"')
  z.push(' *  und ist eine Auskunft — nicht ein Grund, eine Id zu erfinden. */')
  z.push('export const geraetetypIdVon = (')
  z.push('  bereich: string,')
  z.push('  quellId: string | undefined,')
  z.push(`): string | undefined => (quellId ? GERAETETYP_IDS[bereich]?.[quellId] : undefined)${semi}`)
  z.push('')
  return z.join('\n')
}

const nachbar = (wurzel, relativ, inhalt) => {
  const pfad = join(wurzel, ...relativ)
  let alt = null
  try {
    alt = readFileSync(pfad, 'utf8')
  } catch {
    /* noch nicht da */
  }
  if (alt === inhalt) return 'unveraendert'
  if (NUR_PRUEFEN) return 'VERALTET'
  writeFileSync(pfad, inhalt)
  return alt === null ? 'neu' : 'aktualisiert'
}

stand.push([
  'multicam geraetetypIds.ts',
  nachbar(MULTICAM, ['src', 'data', 'geraetetypIds.ts'],
    idTabelle({ camera: verknuepfung.camera, lens: verknuepfung.lens, rig: verknuepfung.rig }, 'ts-semi')),
  Object.keys(verknuepfung.camera).length +
    Object.keys(verknuepfung.lens).length +
    Object.keys(verknuepfung.rig).length,
  '—',
])
stand.push([
  'light geraetetypIds.ts',
  nachbar(LIGHT, ['src', 'core', 'geraetetypIds.ts'],
    idTabelle({ fixture: verknuepfung.fixture }, 'ts-semi')),
  Object.keys(verknuepfung.fixture).length,
  '—',
])

let veraltet = false
for (const [name, zustand, anzahl, beleg] of stand) {
  if (zustand === 'VERALTET') veraltet = true
  const nachsatz = beleg === '—' ? 'Ids' : `Eintraege, ${beleg} belegt`
  console.log(`${name.padEnd(26)} ${zustand.padEnd(14)} ${anzahl} ${nachsatz}`)
}
if (NUR_PRUEFEN && veraltet) {
  console.error('\nkatalog:check — die erzeugten Kataloge sind veraltet. `npm run katalog:uebernahme` laufen lassen.')
  process.exit(1)
}

