// ───────────────────────────────────────────────────────────────────────────
// Geräte-Steckbrief — eine Karte je Gerät, zum Ausdrucken und Ablegen.
//
// Das Asset-Register ist eine Zeile je Gerät und für die Buchhaltung gebaut.
// Der Steckbrief ist das Blatt, das der Techniker in die Hand nimmt, wenn er
// VOR dem Gerät steht: wo es steht, was es ist, wie es im Netz hängt, auf
// welchem Mischer-Eingang es liegt, welche Kabel daran gehen und was zuletzt
// daran gemacht wurde. Alles davon steht schon im Plan — verteilt auf fünf
// Listen, und keine davon ist nach Gerät geordnet.
//
// Ein leeres Feld steht als „—" da und wird nicht weggelassen. Das Blatt geht
// an den Betreiber, und eine fehlende Seriennummer ist genau die Lücke, die
// er beim nächsten Austausch vermisst.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem, Port } from '../types/equipment'
import type { InstallStatus, ServiceRecord } from '../types/lifecycle'
import type { CsvCell, CsvTable } from './csv'
import { deriveLabels } from './labelDerivation'
import { equipmentAssetTag } from './docIds'
import { standortText } from './equipmentLocation'
import { portDisplayLabel } from './portLabel'
import { durchBlenden, gegenendenJePort } from './patchPanel'
import { konfigVorgaben, type KonfigZeile } from './konfigVorgaben'
import { installStatusText } from './installStatusText'
import { druckblatt, esc, fmt, quelle, tabelle, vergleich, type Uebersetzen } from './druckblatt'

export interface SteckbriefVerbindung {
  port: string
  kabel: string
  gegenstelle: string
  gegenPort: string
  /**
   * Endet das Kabel an einer Blende, das Gerät dahinter („PTZ 1 · LAN") —
   * gefolgt wie in der Switch-Port-Karte. Die Gegenstelle bleibt die Blende:
   * dort steckt das Kabel, und wer es abzieht, steht dort.
   */
  dahinter?: string
}

export interface Steckbrief {
  id: string
  name: string
  kurzname: string
  kategorie: string
  untertitel: string
  standort: string
  assetTag: string
  serie: string
  firmware: string
  status?: InstallStatus
  garantieBis: string
  intervallTage?: number
  herstellerUrl: string
  web: string
  netz: KonfigZeile[]
  mischerEingaenge: Array<{ mischer: string; eingang: number }>
  verbindungen: SteckbriefVerbindung[]
  /** Jüngster Eintrag zuerst. */
  service: ServiceRecord[]
}

const allePorts = (e: EquipmentItem): Port[] => [...(e.inputs ?? []), ...(e.outputs ?? [])]

const portText = (e: EquipmentItem | undefined, id: string): string => {
  const p = e ? allePorts(e).find((x) => x.id === id) : undefined
  return p ? portDisplayLabel(p) || p.id : id
}

export function steckbriefe(project: CablePlannerProject): Steckbrief[] {
  const byId = new Map(project.equipment.map((e) => [e.id, e]))
  const netz = new Map<string, KonfigZeile[]>()
  for (const z of konfigVorgaben(project)) netz.set(z.geraetId, [...(netz.get(z.geraetId) ?? []), z])

  const enden = gegenendenJePort(project.cables)
  const { sources } = deriveLabels({
    equipment: project.equipment,
    cables: project.cables,
    sourceIdentities: project.sourceIdentities ?? [],
  })

  return [...project.equipment]
    .sort((a, b) => vergleich(a.name, b.name) || vergleich(a.id, b.id))
    .map((e): Steckbrief => {
      const verbindungen: SteckbriefVerbindung[] = []
      for (const c of project.cables) {
        const seiten: Array<[string, string, string, string]> = [
          [c.fromEquipmentId, c.fromPortId, c.toEquipmentId, c.toPortId],
          [c.toEquipmentId, c.toPortId, c.fromEquipmentId, c.fromPortId],
        ]
        for (const [hier, hierPort, dort, dortPort] of seiten) {
          if (hier !== e.id) continue
          const gegen = byId.get(dort)
          const { ende, blenden } = durchBlenden({ equipmentId: dort, portId: dortPort }, byId, enden)
          const hinten = blenden.length > 0 && ende.equipmentId !== e.id ? byId.get(ende.equipmentId) : undefined
          verbindungen.push({
            port: portText(e, hierPort),
            kabel: c.cableNumber || c.name || c.id,
            gegenstelle: gegen?.name ?? dort,
            gegenPort: portText(gegen, dortPort),
            ...(hinten ? { dahinter: `${hinten.name} · ${portText(hinten, ende.portId)}` } : {}),
          })
        }
      }
      verbindungen.sort((a, b) => vergleich(a.port, b.port) || vergleich(a.kabel, b.kabel))

      const mischerEingaenge = sources
        .filter((s) => s.sinkKind === 'atem' && s.sourceEquipmentId === e.id)
        .map((s) => ({ mischer: byId.get(s.sinkEquipmentId)?.name ?? s.sinkEquipmentId, eingang: s.inputIndex }))
        .sort((a, b) => vergleich(a.mischer, b.mischer) || a.eingang - b.eingang)

      return {
        id: e.id,
        name: e.name,
        kurzname: e.shortName ?? '',
        kategorie: e.category ?? '',
        untertitel: e.subtitle ?? '',
        standort: standortText(e, project.locations ?? []),
        assetTag: equipmentAssetTag(e),
        serie: e.serialNumber ?? '',
        firmware: e.firmware ?? '',
        ...(e.installStatus ? { status: e.installStatus } : {}),
        garantieBis: e.warrantyUntil ?? '',
        ...(typeof e.maintenanceIntervalDays === 'number' ? { intervallTage: e.maintenanceIntervalDays } : {}),
        herstellerUrl: e.manufacturerUrl ?? '',
        web: e.mgmtUrl ?? '',
        netz: netz.get(e.id) ?? [],
        mischerEingaenge,
        verbindungen,
        service: [...(e.serviceHistory ?? [])].sort((a, b) => vergleich(b.date, a.date) || vergleich(a.id, b.id)),
      }
    })
}

/**
 * Alles, was auf den Karten steht, als Tabelle — für den Stand.
 *
 * Nicht Asset-Register plus Konfig-Liste: die Karten zeigen auch Verbindungen,
 * Mischer-Eingänge und jeden Service-Eintrag, und was gedruckt wird, geht in
 * den Fingerabdruck.
 */
export const steckbriefStandTable = (project: CablePlannerProject): CsvTable => {
  const rows: CsvCell[][] = []
  for (const s of steckbriefe(project)) {
    const feld = (k: string, v: CsvCell) => rows.push([s.name, k, v])
    feld('Kurzname', s.kurzname)
    feld('Kategorie', s.kategorie)
    feld('Untertitel', s.untertitel)
    feld('Standort', s.standort)
    feld('Asset-Tag', s.assetTag)
    feld('Serien-Nr.', s.serie)
    feld('Firmware', s.firmware)
    feld('Status', s.status ?? '')
    feld('Garantie bis', s.garantieBis)
    feld('Wartungsintervall (Tage)', s.intervallTage ?? '')
    feld('Hersteller-Seite', s.herstellerUrl)
    feld('Web-Oberfläche', s.web)
    for (const n of s.netz) {
      feld('Netz', [n.schnittstelle, n.ip, n.maske, n.gateway, n.vlan ?? '', n.switchName, n.port].join(' | '))
    }
    for (const m of s.mischerEingaenge) feld('Mischer-Eingang', `${m.mischer} ${m.eingang}`)
    for (const v of s.verbindungen) {
      feld('Verbindung', `${v.port} | ${v.kabel} | ${v.gegenstelle} | ${v.gegenPort} | ${v.dahinter ?? ''}`)
    }
    for (const r of s.service) feld('Service', `${r.date} | ${r.kind} | ${r.summary} | ${r.author}`)
  }
  return { headers: ['Gerät', 'Feld', 'Wert'], rows }
}

// ─── DAS BLATT ─────────────────────────────────────────────────────────────

export interface SteckbriefOptionen {
  titel: string
  stempel?: string
  t?: Uebersetzen
}

const serviceArt = (k: ServiceRecord['kind'], t: Uebersetzen): string => {
  switch (k) {
    case 'install':
      return t('lifecycle.kind.install', 'Installation')
    case 'inspection':
      return t('lifecycle.kind.inspection', 'Inspection')
    case 'repair':
      return t('lifecycle.kind.repair', 'Repair')
    case 'replacement':
      return t('lifecycle.kind.replacement', 'Replacement')
    case 'note':
      return t('lifecycle.kind.note', 'Note')
  }
}

export function steckbriefHtml(project: CablePlannerProject, o: SteckbriefOptionen): string {
  const t = o.t ?? quelle
  const dash = '—'
  const karte = (s: Steckbrief): string => {
    const felder: Array<[string, string]> = [
      [t('steckbrief.category', 'Category'), s.kategorie],
      [t('steckbrief.subtitle', 'Type (as entered)'), s.untertitel],
      [t('steckbrief.location', 'Location'), s.standort],
      [t('steckbrief.assetTag', 'Asset tag'), s.assetTag],
      [t('steckbrief.serial', 'Serial no.'), s.serie],
      [t('steckbrief.firmware', 'Firmware'), s.firmware],
      [t('steckbrief.status', 'Status'), s.status ? installStatusText(s.status, t) : ''],
      [t('steckbrief.warranty', 'Warranty until'), s.garantieBis],
      [
        t('steckbrief.interval', 'Maintenance interval'),
        s.intervallTage !== undefined ? fmt(t('steckbrief.days', '{n} days'), { n: s.intervallTage }) : '',
      ],
      [t('steckbrief.manufacturer', 'Manufacturer page'), s.herstellerUrl],
      [t('steckbrief.web', 'Web interface'), s.web],
      [
        t('steckbrief.switcherInput', 'Switcher input'),
        s.mischerEingaenge
          .map((m) => fmt(t('steckbrief.switcherInputValue', '{switcher}, input {n}'), { switcher: m.mischer, n: m.eingang }))
          .join('; '),
      ],
    ]
    const netz = s.netz.length
      ? tabelle(
          [
            t('steckbrief.col.interface', 'Interface'),
            t('steckbrief.col.ip', 'IP'),
            t('steckbrief.col.mask', 'Mask'),
            t('steckbrief.col.gateway', 'Gateway'),
            t('steckbrief.col.vlan', 'VLAN'),
            t('steckbrief.col.switch', 'Switch'),
            t('steckbrief.col.port', 'Port'),
          ],
          s.netz.map((n) => [n.schnittstelle || dash, n.ip || dash, n.maske || dash, n.gateway || dash, n.vlan !== undefined ? String(n.vlan) : dash, n.switchName || dash, n.port || dash]),
          '',
        )
      : ''
    const verbindungen = tabelle(
      [
        t('steckbrief.col.port', 'Port'),
        t('steckbrief.col.cable', 'Cable'),
        t('steckbrief.col.otherEnd', 'Other end'),
        t('steckbrief.col.behind', 'Behind the panels'),
      ],
      s.verbindungen.map((v) => [v.port, v.kabel, `${v.gegenstelle} · ${v.gegenPort}`, v.dahinter ?? '']),
      t('steckbrief.noCables', 'No cable in the plan.'),
    )
    const service = s.service.length
      ? tabelle(
          [t('steckbrief.col.date', 'Date'), t('steckbrief.col.kind', 'Kind'), t('steckbrief.col.summary', 'Summary'), t('steckbrief.col.by', 'By')],
          s.service.map((r) => [r.date.slice(0, 10), serviceArt(r.kind, t), r.summary, r.author]),
          '',
        )
      : `<p class="leise">${esc(t('steckbrief.noService', 'No service entry.'))}</p>`
    return `<article class="karte">
<h2>${esc(s.name)}${s.kurzname ? ` <span class="leise">(${esc(s.kurzname)})</span>` : ''}</h2>
<dl>${felder.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v || dash)}</dd>`).join('')}</dl>
${netz ? `<h3>${esc(t('steckbrief.network', 'Network'))}</h3>${netz}` : ''}
<h3>${esc(t('steckbrief.connections', 'Connections'))}</h3>
${verbindungen}
<h3>${esc(t('steckbrief.service', 'Service history'))}</h3>
${service}
</article>`
  }

  const liste = steckbriefe(project)
  return druckblatt(
    {
      titel: o.titel,
      ...(o.stempel ? { stempel: o.stempel } : {}),
      css: `  .karte { break-inside: avoid; border-top: 0.6mm solid #000; padding-top: 2mm; margin-top: 6mm; }
  .karte h2 { border: 0; margin-top: 0; }`,
    },
    liste.length ? liste.map(karte).join('\n') : `<p class="leise">${esc(t('steckbrief.none', 'The plan has no device.'))}</p>`,
  )
}
