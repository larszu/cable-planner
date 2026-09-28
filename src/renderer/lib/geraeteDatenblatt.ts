// ───────────────────────────────────────────────────────────────────────────
// Geräte-Datenblatt — eine A4-Seite für EIN Gerät, mit Foto (#919).
//
// „Zur Dokumentation der einzelnen Geräte einzelne A4-Seiten als PDF und
// direkt Druck inkl. Doku-Foto und Eigenschaften, die man anklickt. Pro Gerät
// soll eine Eigenschaften-Liste exportiert werden. Vorausgewählt sollen alle
// ausgefüllten Eigenschaften sein."
//
// Der Steckbrief (`lib/steckbrief.ts`) ist das Gegenstück für die ganze
// Anlage: alle Geräte, jedes Feld, Lücken als „—" — für den Betreiber, dem
// eine fehlende Seriennummer auffallen soll. Das Datenblatt ist das Blatt,
// das man für EIN Gerät in den Koffer legt oder an den Kunden schickt; wer
// es macht, entscheidet, was darauf steht. Deshalb eine Auswahl, und
// deshalb stehen leere Felder nur darauf, wenn man sie ausdrücklich ankreuzt.
//
// Die Werte kommen aus dem Steckbrief, wo er sie schon rechnet (Standort,
// Netz durch Blenden, Mischer-Eingang, Verbindungen) — eine Antwort auf
// „wo steht das Gerät", nicht zwei.
//
// Zugangsdaten (`username`/`password`) sind absichtlich KEINE Eigenschaft:
// ein Datenblatt wird weitergegeben, und ein Kästchen, das ein Passwort auf
// Papier bringt, ist ein Kästchen zu viel.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem, Port } from '../types/equipment'
import type { Foto } from '../types/foto'
import type { Lang } from './categoryTranslations'
import { schemaForCategory } from './categorySchemas'
import { steckbriefe, type Steckbrief } from './steckbrief'
import { streamDirectionText } from './streamEndpoints'
import { installStatusText } from './installStatusText'
import { portDisplayLabel } from './portLabel'
import { druckblatt, esc, fmt, quelle, tabelle, type Uebersetzen } from './druckblatt'

export type DatenblattGruppe = 'general' | 'technical' | 'category' | 'operation' | 'tables'

export interface DatenblattFeld {
  key: string
  gruppe: DatenblattGruppe
  label: string
  /** Leer heisst „nicht ausgefüllt" — dann nicht vorausgewählt. */
  wert: string
  /** Tabellen-Blöcke tragen ihr HTML selbst; `wert` ist dann die Kurzform. */
  html?: string
}

const zahl = (v: number | undefined, einheit: string): string =>
  typeof v === 'number' && Number.isFinite(v) ? `${v} ${einheit}`.trim() : ''

const masse = (e: EquipmentItem): string => {
  const teile = [e.widthMm, e.heightMm, e.depthMm]
  if (!teile.some((v) => typeof v === 'number' && v > 0)) return ''
  return `${teile.map((v) => (typeof v === 'number' && v > 0 ? String(v) : '?')).join(' × ')} mm`
}

const eigentum = (e: EquipmentItem, t: Uebersetzen): string => {
  switch (e.ownership) {
    case 'owned':
      return t('datasheet.ownership.owned', 'Owned')
    case 'rented':
      return t('datasheet.ownership.rented', 'Rented')
    case 'subhire':
      return t('datasheet.ownership.subhire', 'Sub-hire')
    default:
      return ''
  }
}

const kategorieWert = (
  v: string | number | boolean | undefined,
  f: ReturnType<typeof schemaForCategory>[number],
  lang: Lang,
  t: Uebersetzen,
): string => {
  if (v === undefined || v === '' || v === false) return ''
  if (f.type === 'boolean') return t('datasheet.yes', 'yes')
  if ((f.type === 'select' || f.type === 'polar-pattern') && f.options) {
    return f.options.find((o) => o.value === String(v))?.label[lang] ?? String(v)
  }
  return `${String(v)}${f.unit ? ` ${f.unit}` : ''}`
}

const portZeilen = (e: EquipmentItem, t: Uebersetzen): string[][] => {
  const zeile = (p: Port, richtung: string) => [
    portDisplayLabel(p) || p.id,
    richtung,
    p.connectorType ?? '',
    p.standard ?? p.type ?? '',
  ]
  return [
    ...(e.inputs ?? []).map((p) => zeile(p, t('datasheet.dir.in', 'In'))),
    ...(e.outputs ?? []).map((p) => zeile(p, t('datasheet.dir.out', 'Out'))),
  ]
}

/**
 * Alle Eigenschaften eines Geräts, die aufs Blatt können — in Blattreihenfolge.
 * `undefined`, wenn es das Gerät nicht gibt.
 */
export function datenblattFelder(
  project: CablePlannerProject,
  equipmentId: string,
  opt: { t?: Uebersetzen; lang?: Lang } = {},
): DatenblattFeld[] | undefined {
  const t = opt.t ?? quelle
  const lang = opt.lang ?? 'en'
  const e = project.equipment.find((x) => x.id === equipmentId)
  if (!e) return undefined
  const s: Steckbrief | undefined = steckbriefe(project).find((x) => x.id === equipmentId)
  const dash = '—'

  const felder: DatenblattFeld[] = []
  const feld = (gruppe: DatenblattGruppe, key: string, label: string, wert: string) =>
    felder.push({ key, gruppe, label, wert: wert.trim() })

  feld('general', 'shortName', t('datasheet.shortName', 'Short name'), e.shortName ?? '')
  feld('general', 'category', t('datasheet.category', 'Category'), e.category ?? '')
  feld('general', 'subtitle', t('datasheet.subtitle', 'Type (as entered)'), e.subtitle ?? '')
  feld('general', 'location', t('datasheet.location', 'Location'), s?.standort ?? '')
  feld('general', 'assetTag', t('datasheet.assetTag', 'Asset tag'), s?.assetTag ?? e.assetTag ?? '')
  feld('general', 'serial', t('datasheet.serial', 'Serial no.'), e.serialNumber ?? '')
  feld('general', 'firmware', t('datasheet.firmware', 'Firmware'), e.firmware ?? '')
  feld('general', 'manufacturerUrl', t('datasheet.manufacturer', 'Manufacturer page'), e.manufacturerUrl ?? '')
  feld('general', 'notes', t('datasheet.notes', 'Notes'), e.notes ?? '')

  feld('technical', 'dimensions', t('datasheet.dimensions', 'Dimensions (W × H × D)'), masse(e))
  feld('technical', 'rackUnits', t('datasheet.rackUnits', 'Rack units'), zahl(e.rackUnits, t('datasheet.unitRu', 'U')))
  feld('technical', 'weight', t('datasheet.weight', 'Weight'), zahl(e.weightKg, 'kg'))
  feld('technical', 'power', t('datasheet.power', 'Power consumption'), zahl(e.powerConsumptionWatts ?? e.powerWatts, 'W'))
  feld('technical', 'voltage', t('datasheet.voltage', 'Voltage'), zahl(e.voltage, 'V'))
  feld('technical', 'current', t('datasheet.current', 'Current'), zahl(e.currentAmps, 'A'))
  feld('technical', 'phases', t('datasheet.phases', 'Phases'), e.powerPhase ? String(e.powerPhase) : '')
  feld('technical', 'resolution', t('datasheet.resolution', 'Resolution'), e.resolution ?? '')
  feld('technical', 'displaySize', t('datasheet.displaySize', 'Screen size'), zahl(e.displaySizeInch, '"').replace(' "', '"'))

  for (const f of schemaForCategory(e.category)) {
    feld('category', `cat.${f.key}`, f.label[lang], kategorieWert(e.categoryProps?.[f.key], f, lang, t))
  }

  feld('operation', 'status', t('datasheet.status', 'Status'), e.installStatus ? installStatusText(e.installStatus, t) : '')
  feld('operation', 'ownership', t('datasheet.ownershipLabel', 'Ownership'), eigentum(e, t))
  feld('operation', 'supplier', t('datasheet.supplier', 'Supplier'), e.supplier ?? '')
  feld('operation', 'purchaseDate', t('datasheet.purchaseDate', 'Purchase date'), e.purchaseDate ?? '')
  feld('operation', 'warranty', t('datasheet.warranty', 'Warranty until'), e.warrantyUntil ?? '')
  feld(
    'operation',
    'interval',
    t('datasheet.interval', 'Maintenance interval'),
    typeof e.maintenanceIntervalDays === 'number' ? fmt(t('datasheet.days', '{n} days'), { n: e.maintenanceIntervalDays }) : '',
  )
  feld('operation', 'web', t('datasheet.web', 'Web interface'), e.mgmtUrl ?? '')
  feld(
    'operation',
    'switcherInput',
    t('datasheet.switcherInput', 'Switcher input'),
    (s?.mischerEingaenge ?? [])
      .map((m) => fmt(t('datasheet.switcherInputValue', '{switcher}, input {n}'), { switcher: m.mischer, n: m.eingang }))
      .join('; '),
  )

  const block = (key: string, label: string, anzahl: number, html: string) =>
    felder.push({ key, gruppe: 'tables', label, wert: anzahl > 0 ? String(anzahl) : '', html })

  const ports = portZeilen(e, t)
  block(
    'ports',
    t('datasheet.ports', 'Ports'),
    ports.length,
    tabelle(
      [t('datasheet.col.port', 'Port'), t('datasheet.col.direction', 'Direction'), t('datasheet.col.connector', 'Connector'), t('datasheet.col.signal', 'Signal')],
      ports.map((r) => r.map((z) => z || dash)),
      t('datasheet.noPorts', 'No port.'),
    ),
  )
  const netz = s?.netz ?? []
  block(
    'network',
    t('datasheet.network', 'Network'),
    netz.length,
    tabelle(
      [t('datasheet.col.interface', 'Interface'), 'IP', t('datasheet.col.mask', 'Mask'), 'Gateway', 'VLAN', 'Switch', t('datasheet.col.port', 'Port')],
      netz.map((n) => [n.schnittstelle || dash, n.ip || dash, n.maske || dash, n.gateway || dash, n.vlan !== undefined ? String(n.vlan) : dash, n.switchName || dash, n.port || dash]),
      t('datasheet.noNetwork', 'No network interface.'),
    ),
  )
  // #946 — Streams. Zugangsdaten stehen nicht im Plan, also auch nicht hier.
  const streams = s?.streams ?? []
  block(
    'streams',
    t('datasheet.streams', 'Streams'),
    streams.length,
    tabelle(
      [
        t('datasheet.col.direction', 'Direction'),
        t('datasheet.col.protocol', 'Protocol'),
        t('datasheet.col.address', 'Address'),
        'VLAN',
        t('datasheet.col.codec', 'Codec / format'),
      ],
      streams.map((r) => [
        streamDirectionText(r.stream.direction, t),
        [r.protokoll, r.stream.label].filter(Boolean).join(' '),
        r.adresse || dash,
        r.vlanId !== undefined ? String(r.vlanId) : dash,
        [r.stream.codec, r.stream.format].filter(Boolean).join(' · ') || dash,
      ]),
      t('datasheet.noStreams', 'No stream.'),
    ),
  )
  const verb = s?.verbindungen ?? []
  block(
    'connections',
    t('datasheet.connections', 'Connections'),
    verb.length,
    tabelle(
      [t('datasheet.col.port', 'Port'), t('datasheet.col.cable', 'Cable'), t('datasheet.col.otherEnd', 'Other end'), t('datasheet.col.behind', 'Behind the panels')],
      verb.map((v) => [v.port, v.kabel, `${v.gegenstelle} · ${v.gegenPort}`, v.dahinter ?? '']),
      t('datasheet.noCables', 'No cable in the plan.'),
    ),
  )
  const service = s?.service ?? []
  block(
    'service',
    t('datasheet.service', 'Service history'),
    service.length,
    tabelle(
      [t('datasheet.col.date', 'Date'), t('datasheet.col.summary', 'Summary'), t('datasheet.col.by', 'By')],
      service.map((r) => [r.date.slice(0, 10), r.summary, r.author]),
      t('datasheet.noService', 'No service entry.'),
    ),
  )
  return felder
}

/** Vorauswahl nach #919: jede ausgefüllte Eigenschaft. */
export const vorauswahl = (felder: readonly DatenblattFeld[]): Set<string> =>
  new Set(felder.filter((f) => f.wert !== '').map((f) => f.key))

/** Die Fotos, die auf dieses Gerät zeigen — in der Reihenfolge des Plans. */
export const geraeteFotos = (project: CablePlannerProject, equipmentId: string): Foto[] =>
  (project.fotos ?? []).filter((f) => f.zeigtAuf?.equipmentId === equipmentId)

export interface DatenblattOptionen {
  auswahl: ReadonlySet<string>
  /** Ids der Fotos, die aufs Blatt sollen. Ein Foto ohne geladene Bilddaten fällt weg. */
  fotoIds?: readonly string[]
  stempel?: string
  t?: Uebersetzen
  lang?: Lang
}

const GRUPPEN: Array<[DatenblattGruppe, string, string]> = [
  ['general', 'datasheet.group.general', 'General'],
  ['technical', 'datasheet.group.technical', 'Technical data'],
  ['category', 'datasheet.group.category', 'Category data'],
  ['operation', 'datasheet.group.operation', 'Operation'],
]

/** Titel und Inhalt EINER Geraeteseite, ohne Dokumentrahmen. */
function datenblattSeite(project: CablePlannerProject, equipmentId: string, o: DatenblattOptionen): { titel: string; body: string } {
  const t = o.t ?? quelle
  const e = project.equipment.find((x) => x.id === equipmentId)
  const felder = datenblattFelder(project, equipmentId, { t, ...(o.lang ? { lang: o.lang } : {}) }) ?? []
  const gewaehlt = felder.filter((f) => o.auswahl.has(f.key))
  const dash = '—'

  const fotos = geraeteFotos(project, equipmentId).filter((f) => (o.fotoIds ?? []).includes(f.id) && f.dataUri)
  const fotoHtml = fotos.length
    ? `<div class="fotos">${fotos
        .map(
          (f) =>
            `<figure><img src="${esc(f.dataUri)}" alt="${esc(f.notiz ?? e?.name ?? '')}">${f.notiz ? `<figcaption>${esc(f.notiz)}</figcaption>` : ''}</figure>`,
        )
        .join('')}</div>`
    : ''

  const abschnitte = GRUPPEN.map(([g, key, fb]) => {
    const zeilen = gewaehlt.filter((f) => f.gruppe === g)
    if (!zeilen.length) return ''
    return `<h2>${esc(t(key, fb))}</h2><dl>${zeilen.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(f.wert || dash)}</dd>`).join('')}</dl>`
  }).join('\n')
  const tabellen = gewaehlt
    .filter((f) => f.gruppe === 'tables')
    .map((f) => `<h2>${esc(f.label)}</h2>${f.html ?? ''}`)
    .join('\n')

  const leer = !gewaehlt.length && !fotos.length ? `<p class="leise">${esc(t('datasheet.nothingSelected', 'No property selected.'))}</p>` : ''

  return {
    titel: e ? (e.shortName ? `${e.name} (${e.shortName})` : e.name) : equipmentId,
    body: `<div class="oben"><div class="felder">${abschnitte}</div>${fotoHtml}</div>\n${tabellen}\n${leer}`,
  }
}

// Fotos rechts neben den Feldern statt darüber: so bleibt ein Gerät mit Foto,
// Feldern und Verbindungen auf einer A4-Seite.
const SEITEN_CSS = `  h2 { margin: 3mm 0 1.5mm; }
  .oben { display: flex; gap: 5mm; align-items: flex-start; }
  .felder { flex: 1 1 auto; min-width: 0; }
  .felder > h2:first-child { margin-top: 0; }
  .fotos { flex: 0 0 70mm; display: flex; flex-direction: column; gap: 2mm; }
  .fotos figure { margin: 0; }
  .fotos img { display: block; max-width: 100%; max-height: 60mm; object-fit: contain; }
  .fotos figcaption { font-size: 7pt; color: #555; margin-top: 1mm; }
  dd { overflow-wrap: anywhere; }`

export function datenblattHtml(project: CablePlannerProject, equipmentId: string, o: DatenblattOptionen): string {
  const { titel, body } = datenblattSeite(project, equipmentId, o)
  return druckblatt({ titel, ...(o.stempel ? { stempel: o.stempel } : {}), css: SEITEN_CSS }, body)
}

/**
 * Mehrere Geraete in EINEM Dokument, eine Seite je Geraet — ein Druckauftrag,
 * eine PDF-Datei. Die Auswahl der Eigenschaften gilt fuer alle; was ein Geraet
 * nicht hat, steht bei ihm als Strich, wenn es angekreuzt ist (dieselbe Regel
 * wie beim einzelnen Blatt). Fotos je Geraet ueber `fotoIdsJeGeraet`.
 */
export function datenblaetterHtml(
  project: CablePlannerProject,
  equipmentIds: readonly string[],
  o: Omit<DatenblattOptionen, 'fotoIds'> & { fotoIdsJeGeraet?: Readonly<Record<string, readonly string[]>> },
): string {
  if (equipmentIds.length === 1) {
    return datenblattHtml(project, equipmentIds[0], { ...o, fotoIds: o.fotoIdsJeGeraet?.[equipmentIds[0]] ?? [] })
  }
  const seiten = equipmentIds.map((id) => {
    const { titel, body } = datenblattSeite(project, id, { ...o, fotoIds: o.fotoIdsJeGeraet?.[id] ?? [] })
    return `<section class="seite"><h1>${esc(titel)}</h1>${body}${o.stempel ? `<footer>${esc(o.stempel)}</footer>` : ''}</section>`
  })
  const t = o.t ?? quelle
  return druckblatt(
    {
      titel: t('datasheet.titleMany', 'Device datasheets'),
      ohneKopf: true,
      css: `${SEITEN_CSS}
  .seite { break-after: page; }
  .seite:last-child { break-after: auto; }`,
    },
    seiten.join('\n'),
  )
}

/** Ein Feld der gemeinsamen Liste fuer mehrere Geraete. */
export interface DatenblattFeldMehrere {
  key: string
  gruppe: DatenblattGruppe
  label: string
  /** Bei wie vielen der Geraete das Feld ausgefuellt ist. */
  gefuellt: number
  gesamt: number
}

/**
 * Die Vereinigung der Felder mehrerer Geraete, in der Reihenfolge ihres
 * ersten Auftretens. Vorausgewaehlt (`vorauswahlMehrere`) ist, was bei
 * mindestens einem Geraet ausgefuellt ist — „alle ausgefuellten" aus #919,
 * ueber die Auswahl gelesen.
 */
export function datenblattFelderMehrere(
  project: CablePlannerProject,
  equipmentIds: readonly string[],
  o: { t?: Uebersetzen; lang?: Lang } = {},
): DatenblattFeldMehrere[] {
  const nachKey = new Map<string, DatenblattFeldMehrere>()
  for (const id of equipmentIds) {
    for (const f of datenblattFelder(project, id, o) ?? []) {
      const alt = nachKey.get(f.key)
      if (alt) alt.gefuellt += f.wert !== '' ? 1 : 0
      else nachKey.set(f.key, { key: f.key, gruppe: f.gruppe, label: f.label, gefuellt: f.wert !== '' ? 1 : 0, gesamt: equipmentIds.length })
    }
  }
  return [...nachKey.values()]
}

export const vorauswahlMehrere = (felder: readonly DatenblattFeldMehrere[]): Set<string> =>
  new Set(felder.filter((f) => f.gefuellt > 0).map((f) => f.key))
