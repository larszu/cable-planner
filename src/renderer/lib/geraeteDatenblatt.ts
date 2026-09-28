// ───────────────────────────────────────────────────────────────────────────
// Geräte-Datenblatt (#919) — welche Eigenschaften ein Gerät HAT.
//
// ─── WOZU ──────────────────────────────────────────────────────────────────
//
// „Zur Dokumentation der einzelnen Geräte einzelne A4 Seiten als PDF und
// direkt Druck inkl. Doku-Foto und Eigenschaften die man anklickt ...
// Vorausgewählt sollen es alle ausgefüllten Eigenschaften sein."
//
// Dieses Modul beantwortet nur die Frage davor: welche Eigenschaften sind an
// diesem Gerät ausgefüllt, wie heissen sie und was steht darin. Die Seite
// selbst zeichnet `exportDevicePdf.ts` — im selben Seitenrahmen wie das
// Patch-Sheet (#74), damit zwei Blätter desselben Geräts gleich aussehen.
//
// ─── WARUM NICHT DER STECKBRIEF ────────────────────────────────────────────
//
// `lib/steckbrief.ts` ist das Übergabe-Blatt für den Betreiber: ein festes
// Formular, in dem ein LEERES Feld als „—" stehen bleibt, weil die Lücke dort
// die Information ist. Das Datenblatt hier ist das Gegenteil: es zeigt, was
// da ist, und der Nutzer wählt aus. Leere Felder tauchen in der Auswahl gar
// nicht erst auf — eine Checkbox für ein leeres Feld ist eine Frage, auf die
// es keine sinnvolle Antwort gibt. Die Beschriftungen, die beide Blätter
// teilen, teilen auch den Schlüssel (`steckbrief.*`).
//
// ─── WAS NIE AUF DAS BLATT KOMMT ───────────────────────────────────────────
//
// `password`. Das Blatt klebt am Gerät und liegt im Case; das Passwort
// gehört in den Credential-Store, nicht auf Papier. Es erscheint deshalb
// auch nicht als abwählbare Option — eine Vorauswahl „alle ausgefüllten"
// hätte es sonst mitgedruckt.
//
// Kein Import von `lib/i18n`: der Übersetzer kommt als Parameter (wie in
// `druckblatt.ts`), damit der Test ohne Wörterbuch die englische Quelle misst.
// ───────────────────────────────────────────────────────────────────────────

import type { EquipmentItem } from '../types/equipment'
import type { Foto } from '../types/foto'
import type { LocationFrame } from '../types/location'
import { schemaForCategory } from './categorySchemas'
import { standortText } from './equipmentLocation'
import { fotosZu } from './fotoMasse'
import { installStatusText } from './installStatusText'
import { fmt, quelle, type Uebersetzen } from './druckblatt'

/** Abschnitte des Blatts, in dieser Reihenfolge. */
export type DatenblattGruppe =
  | 'identity'
  | 'network'
  | 'power'
  | 'physical'
  | 'category'
  | 'lifecycle'
  | 'notes'

export const DATENBLATT_GRUPPEN: readonly DatenblattGruppe[] = [
  'identity',
  'network',
  'power',
  'physical',
  'category',
  'lifecycle',
  'notes',
]

export interface DatenblattEigenschaft {
  /** Stabiler Schlüssel — über Geräte hinweg gleich (für die Mehrfachauswahl). */
  key: string
  gruppe: DatenblattGruppe
  label: string
  wert: string
}

export interface DatenblattKontext {
  t?: Uebersetzen
  /** Sprache der Kategorie-Felder (`categorySchemas` führt de + en). */
  lang?: 'de' | 'en'
  locations?: readonly LocationFrame[]
}

export const gruppenTitel = (g: DatenblattGruppe, t: Uebersetzen = quelle): string => {
  switch (g) {
    case 'identity':
      return t('datasheet.group.identity', 'Identity')
    case 'network':
      return t('steckbrief.network', 'Network')
    case 'power':
      return t('datasheet.group.power', 'Power')
    case 'physical':
      return t('datasheet.group.physical', 'Dimensions & display')
    case 'category':
      return t('datasheet.group.category', 'Category details')
    case 'lifecycle':
      return t('datasheet.group.lifecycle', 'Lifecycle & inventory')
    case 'notes':
      return t('datasheet.group.notes', 'Notes')
  }
}

/** Ausgefüllt heisst: es steht etwas Sichtbares darin. */
const text = (v: unknown): string => {
  if (v === undefined || v === null) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return ''
  return String(v).trim()
}

const mitEinheit = (v: unknown, einheit: string): string => {
  const s = text(v)
  return s ? `${s} ${einheit}` : ''
}

const ownershipText = (o: NonNullable<EquipmentItem['ownership']>, t: Uebersetzen): string => {
  switch (o) {
    case 'owned':
      return t('datasheet.ownership.owned', 'Owned')
    case 'rented':
      return t('datasheet.ownership.rented', 'Rented')
    case 'subhire':
      return t('datasheet.ownership.subhire', 'Sub-hire')
  }
}

/**
 * Alle AUSGEFÜLLTEN Eigenschaften eines Geräts, in Blatt-Reihenfolge.
 *
 * Leere Felder fehlen in der Liste — das ist die ganze Vorauswahl-Regel des
 * Issues: was hier steht, ist vorausgewählt.
 */
export function datenblattEigenschaften(
  e: EquipmentItem,
  ctx: DatenblattKontext = {},
): DatenblattEigenschaft[] {
  const t = ctx.t ?? quelle
  const lang = ctx.lang ?? 'en'
  const out: DatenblattEigenschaft[] = []
  const add = (gruppe: DatenblattGruppe, key: string, label: string, wert: string) => {
    if (wert) out.push({ key, gruppe, label, wert })
  }

  // ── Identität ────────────────────────────────────────────────────────────
  add('identity', 'shortName', t('datasheet.field.shortName', 'Short name'), text(e.shortName))
  add('identity', 'category', t('steckbrief.category', 'Category'), text(e.category))
  add('identity', 'subtitle', t('steckbrief.subtitle', 'Type (as entered)'), text(e.subtitle))
  add('identity', 'location', t('steckbrief.location', 'Location'), standortText(e, ctx.locations ?? []))
  add('identity', 'serialNumber', t('steckbrief.serial', 'Serial no.'), text(e.serialNumber))
  add('identity', 'assetTag', t('steckbrief.assetTag', 'Asset tag'), text(e.assetTag))
  add('identity', 'qrId', t('datasheet.field.qrId', 'QR ID'), text(e.qrId))
  add('identity', 'firmware', t('steckbrief.firmware', 'Firmware'), text(e.firmware))
  add('identity', 'manufacturerUrl', t('steckbrief.manufacturer', 'Manufacturer page'), text(e.manufacturerUrl))
  const ins = e.inputs?.length ?? 0
  const outs = e.outputs?.length ?? 0
  add(
    'identity',
    'ports',
    t('datasheet.field.ports', 'Ports'),
    ins + outs > 0 ? fmt(t('datasheet.field.portsValue', '{in} in / {out} out'), { in: ins, out: outs }) : '',
  )
  if (e.isRackDevice) {
    add('identity', 'rackUnits', t('datasheet.field.rackUnits', 'Rack units'), mitEinheit(e.rackUnits, t('datasheet.unit.rackUnit', 'U')))
  }
  add('identity', 'rack', t('datasheet.field.rack', 'Rack'), text(e.rackInstanceLabel))

  // ── Netz ─────────────────────────────────────────────────────────────────
  add('network', 'ipAddress', t('steckbrief.col.ip', 'IP'), text(e.ipAddress))
  add('network', 'subnetMask', t('steckbrief.col.mask', 'Mask'), text(e.subnetMask))
  add('network', 'gateway', t('steckbrief.col.gateway', 'Gateway'), text(e.gateway))
  add('network', 'dnsServers', t('datasheet.field.dns', 'DNS'), text(e.dnsServers))
  add('network', 'macAddress', t('datasheet.field.mac', 'MAC address'), text(e.macAddress))
  add(
    'network',
    'managementVlanId',
    t('datasheet.field.mgmtVlan', 'Management VLAN'),
    text(e.managementVlanId),
  )
  add('network', 'mgmtUrl', t('steckbrief.web', 'Web interface'), text(e.mgmtUrl))
  add('network', 'username', t('datasheet.field.username', 'Username'), text(e.username))
  // Weitere Schnittstellen — eine Zeile je Schnittstelle mit Adresse.
  for (const nic of e.networkInterfaces ?? []) {
    const wert = [text(nic.ipAddress), text(nic.macAddress), nic.vlanId != null ? `VLAN ${nic.vlanId}` : '']
      .filter(Boolean)
      .join(' · ')
    add('network', `nic:${nic.id}`, text(nic.label) || nic.role, wert)
  }

  // ── Strom ────────────────────────────────────────────────────────────────
  add(
    'power',
    'powerConsumptionWatts',
    t('datasheet.field.power', 'Power consumption'),
    mitEinheit(e.powerConsumptionWatts, 'W'),
  )
  add('power', 'powerWatts', t('datasheet.field.powerCatalogue', 'Power (catalogue)'), mitEinheit(e.powerWatts, 'W'))
  add('power', 'voltage', t('datasheet.field.voltage', 'Voltage'), mitEinheit(e.voltage, 'V'))
  add('power', 'currentAmps', t('datasheet.field.current', 'Current'), mitEinheit(e.currentAmps, 'A'))
  add('power', 'powerPhase', t('datasheet.field.phase', 'Phase'), e.powerPhase ? `L${e.powerPhase}` : '')

  // ── Maße & Anzeige ───────────────────────────────────────────────────────
  add('physical', 'widthMm', t('datasheet.field.width', 'Width'), mitEinheit(e.widthMm, 'mm'))
  add('physical', 'heightMm', t('datasheet.field.height', 'Height'), mitEinheit(e.heightMm, 'mm'))
  add('physical', 'depthMm', t('datasheet.field.depth', 'Depth'), mitEinheit(e.depthMm, 'mm'))
  add('physical', 'weightKg', t('datasheet.field.weight', 'Weight'), mitEinheit(e.weightKg, 'kg'))
  add('physical', 'resolution', t('datasheet.field.resolution', 'Resolution'), text(e.resolution))
  add('physical', 'displaySizeInch', t('datasheet.field.displaySize', 'Screen size'), mitEinheit(e.displaySizeInch, '"'))

  // ── Kategorie-Fachfelder (#373) ──────────────────────────────────────────
  // Dieselbe Auflösung wie `formatCategoryProps` (Label, Option, Einheit),
  // aber je Feld eine Zeile — nur so lässt es sich einzeln abwählen.
  const props = e.categoryProps ?? {}
  for (const f of schemaForCategory(e.category)) {
    const v = props[f.key]
    if (v === undefined || v === '' || v === false) continue
    let wert: string
    if (f.type === 'boolean') wert = t('datasheet.yes', 'yes')
    else if ((f.type === 'select' || f.type === 'polar-pattern') && f.options) {
      wert = f.options.find((o) => o.value === String(v))?.label[lang] ?? String(v)
    } else wert = text(v)
    add('category', `cat:${f.key}`, f.label[lang], wert && f.unit ? `${wert} ${f.unit}` : wert)
  }

  // ── Lebenszyklus & Inventar ──────────────────────────────────────────────
  add('lifecycle', 'installStatus', t('steckbrief.status', 'Status'), e.installStatus ? installStatusText(e.installStatus, t) : '')
  add('lifecycle', 'warrantyUntil', t('steckbrief.warranty', 'Warranty until'), text(e.warrantyUntil))
  add(
    'lifecycle',
    'maintenanceIntervalDays',
    t('steckbrief.interval', 'Maintenance interval'),
    typeof e.maintenanceIntervalDays === 'number'
      ? fmt(t('steckbrief.days', '{n} days'), { n: e.maintenanceIntervalDays })
      : '',
  )
  const letzter = [...(e.serviceHistory ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0]
  add(
    'lifecycle',
    'lastService',
    t('datasheet.field.lastService', 'Last service'),
    letzter ? `${letzter.date.slice(0, 10)} · ${letzter.summary}` : '',
  )
  add('lifecycle', 'ownership', t('datasheet.field.ownership', 'Ownership'), e.ownership ? ownershipText(e.ownership, t) : '')
  add('lifecycle', 'supplier', t('datasheet.field.supplier', 'Supplier'), text(e.supplier))
  add('lifecycle', 'purchaseDate', t('datasheet.field.purchaseDate', 'Purchase date'), text(e.purchaseDate))
  add('lifecycle', 'stockLocation', t('datasheet.field.stockLocation', 'Storage location'), text(e.stockLocation))
  add('lifecycle', 'priceEUR', t('datasheet.field.price', 'Price'), mitEinheit(e.priceEUR, 'EUR'))
  add(
    'lifecycle',
    'rentPricePerDay',
    t('datasheet.field.rentPerDay', 'Rent per day'),
    mitEinheit(e.rentPricePerDay, text(e.rentCurrency) || 'EUR'),
  )

  // ── Notizen ──────────────────────────────────────────────────────────────
  add('notes', 'notes', t('datasheet.field.notes', 'Notes'), text(e.notes))

  return out
}

/** Die Vorauswahl: alles, was ausgefüllt ist — also alles aus der Liste. */
export const vorauswahl = (eigenschaften: readonly DatenblattEigenschaft[]): Set<string> =>
  new Set(eigenschaften.map((p) => p.key))

export interface DatenblattAuswahlZeile {
  key: string
  gruppe: DatenblattGruppe
  label: string
  /** An wie vielen der gewählten Geräte die Eigenschaft ausgefüllt ist. */
  anzahl: number
  /** Der Wert, wenn es genau ein Gerät ist — sonst leer. */
  wert: string
}

/**
 * Die Checkliste für EIN oder MEHRERE Geräte: die Vereinigung aller
 * ausgefüllten Eigenschaften, je Schlüssel einmal, in Blatt-Reihenfolge.
 * Eine Auswahl gilt dann für alle Seiten — wer „Seriennummer" abwählt, will
 * sie auf keinem Blatt.
 */
export function auswahlZeilen(listen: readonly (readonly DatenblattEigenschaft[])[]): DatenblattAuswahlZeile[] {
  const zeilen = new Map<string, DatenblattAuswahlZeile>()
  for (const liste of listen) {
    for (const p of liste) {
      const z = zeilen.get(p.key)
      if (z) z.anzahl += 1
      else zeilen.set(p.key, { key: p.key, gruppe: p.gruppe, label: p.label, anzahl: 1, wert: p.wert })
    }
  }
  const alle = [...zeilen.values()]
  if (listen.length !== 1) for (const z of alle) z.wert = ''
  // Stabile Sortierung nach Gruppe; innerhalb der Gruppe bleibt die
  // Reihenfolge des ersten Auftretens (= Blatt-Reihenfolge).
  const rang = (g: DatenblattGruppe) => DATENBLATT_GRUPPEN.indexOf(g)
  return alle.map((z, i) => ({ z, i })).sort((a, b) => rang(a.z.gruppe) - rang(b.z.gruppe) || a.i - b.i).map((x) => x.z)
}

/** Nur die gewählten Eigenschaften, Reihenfolge unverändert. */
export const gewaehlt = (
  eigenschaften: readonly DatenblattEigenschaft[],
  auswahl: ReadonlySet<string>,
): DatenblattEigenschaft[] => eigenschaften.filter((p) => auswahl.has(p.key))

// ─── BILDER ────────────────────────────────────────────────────────────────

/** Schlüssel der beiden Bild-Optionen in derselben Auswahl-Menge. */
export const BILD_FOTOS = 'img:photos'
export const BILD_REFERENZ = 'img:reference'

export interface DatenblattBild {
  dataUri: string
  /** Bildunterschrift — die Notiz des Fotos, falls eine da ist. */
  unterschrift: string
}

export interface DatenblattBilder {
  /** Doku-Fotos (#884), die auf das Gerät zeigen und GELADEN sind. */
  fotos: DatenblattBild[]
  /** Das Referenzbild des Typs (`imageUrl`), falls gesetzt. */
  referenz?: DatenblattBild
}

/**
 * Die Bilder eines Geräts. Ein Foto ohne Bilddaten (nach einer
 * Wiederherstellung, bevor die Ablage nachliefert) zählt nicht: auf Papier
 * wäre es ein leerer Rahmen.
 */
export function datenblattBilder(e: EquipmentItem, fotos: readonly Foto[] | undefined): DatenblattBilder {
  const eigene = fotosZu(fotos, { equipmentId: e.id })
    .filter((f) => !!f.dataUri)
    .map((f) => ({ dataUri: f.dataUri, unterschrift: text(f.notiz) }))
  const ref = text(e.imageUrl)
  return ref.startsWith('data:image/') ? { fotos: eigene, referenz: { dataUri: ref, unterschrift: '' } } : { fotos: eigene }
}

/** Die Bilder, die bei dieser Auswahl auf das Blatt kommen. */
export const gewaehlteBilder = (b: DatenblattBilder, auswahl: ReadonlySet<string>): DatenblattBild[] => [
  ...(auswahl.has(BILD_FOTOS) ? b.fotos : []),
  ...(auswahl.has(BILD_REFERENZ) && b.referenz ? [b.referenz] : []),
]
