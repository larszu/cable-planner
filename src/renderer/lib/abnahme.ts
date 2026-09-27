// ───────────────────────────────────────────────────────────────────────────
// Abnahmeprotokoll mit Mängelliste.
//
// Das Übergabe-Dokument (`handoverPackage.ts`) sagt, WAS übergeben wird. Das
// Abnahmeprotokoll ist das Blatt, auf dem beide Seiten unterschreiben, dass
// es übergeben wurde — und mit welchen offenen Punkten. Ohne die Liste der
// offenen Punkte ist eine Unterschrift eine Abnahme ohne Vorbehalt, und genau
// die will am Tag der Übergabe niemand leisten, der die Anlage nicht kennt.
//
// ─── WOHER DIE PUNKTE KOMMEN ───────────────────────────────────────────────
//
// Nur aus dem, was der Plan tatsächlich weiss:
//
//   Störung      ein Gerät oder Kabel steht auf Betriebs-Status „Störung"
//   Messung      eine Kabelmessung ist als nicht bestanden eingetragen
//   Meldung      eine Feld-Meldung vom Telefon (Art „Problem"), die am
//                Desktop weder übernommen noch verworfen wurde
//   Restpunkt    ein Gerät oder Kabel steht noch auf „Geplant"
//
// Ein Kabel OHNE Status oder OHNE Messung ist kein Mangel: der Plan weiss
// nicht, ob es fehlt oder ob nur niemand es eingetragen hat. Es wird im
// Umfang gezählt und steht dort als „ohne Angabe" — eine erfundene Zeile in
// der Mängelliste wäre ein Vorwurf an den Errichter, den niemand erhoben hat.
//
// Die Entscheidung über die Abnahme trifft das Blatt NICHT. Die drei Kästchen
// bleiben leer, auch wenn die Liste leer ist: „keine Mängel im Plan" heisst
// nicht „keine Mängel", und das Kreuz setzt, wer unterschreibt.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { InstallStatus } from '../types/lifecycle'
import type { CsvCell, CsvTable } from './csv'
import { druckblatt, esc, fmt, quelle, tabelle, vergleich, type Uebersetzen } from './druckblatt'
import { installStatusText } from './installStatusText'

export type MangelArt = 'stoerung' | 'messung' | 'meldung' | 'restpunkt'

const ART_REIHENFOLGE: MangelArt[] = ['stoerung', 'messung', 'meldung', 'restpunkt']

export interface Mangel {
  art: MangelArt
  /** Kabelnummer oder Gerätename. */
  betrifft: string
  /** Ausgangswerte der Beschreibung — Text entsteht erst beim Schreiben. */
  beschreibung:
    | { typ: 'status' }
    | { typ: 'messung'; standard?: string; margeDb?: number }
    | { typ: 'meldung'; text: string }
  /** ISO-Datum (nur der Tag). */
  gemeldet: string
  von: string
  /** Für die stabile Reihenfolge — nie gedruckt. */
  schluessel: string
}

const tag = (iso?: string): string => (iso ? iso.slice(0, 10) : '')

const kabelName = (c: { cableNumber?: string; name?: string; id: string }): string =>
  c.cableNumber || c.name || c.id

export function maengel(project: CablePlannerProject): Mangel[] {
  const liste: Mangel[] = []
  const status = (s: InstallStatus | undefined, betrifft: string, id: string) => {
    if (s === 'fault') liste.push({ art: 'stoerung', betrifft, beschreibung: { typ: 'status' }, gemeldet: '', von: '', schluessel: id })
    if (s === 'planned') liste.push({ art: 'restpunkt', betrifft, beschreibung: { typ: 'status' }, gemeldet: '', von: '', schluessel: id })
  }
  for (const e of project.equipment) status(e.installStatus, e.name, `e:${e.id}`)
  for (const c of project.cables) {
    status(c.installStatus, kabelName(c), `c:${c.id}`)
    const m = c.testResult
    if (m?.result === 'fail') {
      liste.push({
        art: 'messung',
        betrifft: kabelName(c),
        beschreibung: {
          typ: 'messung',
          ...(m.standard ? { standard: m.standard } : {}),
          ...(typeof m.marginDb === 'number' ? { margeDb: m.marginDb } : {}),
        },
        gemeldet: tag(m.testedAt),
        von: m.testedBy ?? '',
        schluessel: `c:${c.id}`,
      })
    }
  }
  const eqName = new Map(project.equipment.map((e) => [e.id, e.name]))
  const kabel = new Map(project.cables.map((c) => [c.id, c]))
  for (const p of project.pendingChanges ?? []) {
    if (p.kind !== 'issue') continue
    const ziel = p.target
    const betrifft = !ziel
      ? ''
      : ziel.type === 'cable'
        ? (ziel.id && kabel.has(ziel.id) ? kabelName(kabel.get(ziel.id)!) : ziel.name ?? '')
        : (ziel.id && eqName.get(ziel.id)) || ziel.name || ''
    liste.push({
      art: 'meldung',
      betrifft,
      beschreibung: { typ: 'meldung', text: p.summary },
      gemeldet: tag(p.ts),
      von: p.author,
      schluessel: `p:${p.id}`,
    })
  }
  return liste.sort(
    (a, b) =>
      ART_REIHENFOLGE.indexOf(a.art) - ART_REIHENFOLGE.indexOf(b.art) ||
      vergleich(a.betrifft, b.betrifft) ||
      vergleich(a.gemeldet, b.gemeldet) ||
      vergleich(a.schluessel, b.schluessel),
  )
}

interface Worte {
  art: Record<MangelArt, string>
  status: (m: Mangel) => string
  messung: (standard?: string, margeDb?: number) => string
}

/** Kanonisch deutsch — fürs gestempelte CSV, dessen Stand nicht von der Sprache abhängen darf. */
const KANONISCH: Worte = {
  art: { stoerung: 'Störung', messung: 'Messung nicht bestanden', meldung: 'Feld-Meldung', restpunkt: 'Restpunkt' },
  status: (m) => (m.art === 'stoerung' ? 'Status „Störung"' : 'Status „Geplant" — noch nicht installiert'),
  messung: (standard, marge) =>
    ['Messung FAIL', standard, typeof marge === 'number' ? `Marge ${marge} dB` : ''].filter(Boolean).join(' · '),
}

const uebersetzteWorte = (t: Uebersetzen): Worte => ({
  art: {
    stoerung: t('abnahme.kind.fault', 'Fault'),
    messung: t('abnahme.kind.testFail', 'Test failed'),
    meldung: t('abnahme.kind.report', 'Field report'),
    restpunkt: t('abnahme.kind.open', 'Open item'),
  },
  status: (m) =>
    m.art === 'stoerung'
      ? fmt(t('abnahme.desc.status', 'Status "{status}"'), { status: installStatusText('fault', t) })
      : fmt(t('abnahme.desc.planned', 'Status "{status}" — not yet installed'), { status: installStatusText('planned', t) }),
  messung: (standard, marge) =>
    [
      t('abnahme.desc.testFail', 'Test FAIL'),
      standard,
      typeof marge === 'number' ? fmt(t('abnahme.desc.margin', 'margin {db} dB'), { db: marge }) : '',
    ]
      .filter(Boolean)
      .join(' · '),
})

const beschreibung = (m: Mangel, w: Worte): string =>
  m.beschreibung.typ === 'status'
    ? w.status(m)
    : m.beschreibung.typ === 'messung'
      ? w.messung(m.beschreibung.standard, m.beschreibung.margeDb)
      : m.beschreibung.text

const zeilen = (liste: Mangel[], w: Worte): CsvCell[][] =>
  liste.map((m, i) => [i + 1, w.art[m.art], m.betrifft, beschreibung(m, w), m.gemeldet, m.von])

export const maengelTable = (project: CablePlannerProject): CsvTable => ({
  headers: ['Nr.', 'Art', 'Betrifft', 'Beschreibung', 'Gemeldet', 'Gemeldet von'],
  rows: zeilen(maengel(project), KANONISCH),
})

// ─── UMFANG ────────────────────────────────────────────────────────────────

interface Umfang {
  geraete: number
  kabel: number
  gemessen: number
  bestanden: number
  nichtBestanden: number
  /** Status je Art, sortiert; `null` = ohne Angabe. */
  status: Array<[InstallStatus | null, number]>
}

const STATUS_REIHENFOLGE: InstallStatus[] = ['planned', 'installed', 'tested', 'operational', 'fault', 'retired']

const umfang = (project: CablePlannerProject): Umfang => {
  const zaehler = new Map<InstallStatus | null, number>()
  for (const x of [...project.equipment, ...project.cables]) {
    const s = x.installStatus ?? null
    zaehler.set(s, (zaehler.get(s) ?? 0) + 1)
  }
  const gemessen = project.cables.filter((c) => c.testResult)
  return {
    geraete: project.equipment.length,
    kabel: project.cables.length,
    gemessen: gemessen.length,
    bestanden: gemessen.filter((c) => c.testResult!.result === 'pass').length,
    nichtBestanden: gemessen.filter((c) => c.testResult!.result === 'fail').length,
    status: [...STATUS_REIHENFOLGE, null]
      .filter((s) => zaehler.has(s))
      .map((s): [InstallStatus | null, number] => [s, zaehler.get(s)!]),
  }
}

/**
 * Was auf dem Blatt steht, als eine Tabelle — für den Stand.
 *
 * Dieselbe Regel wie beim Übergabe-Dokument: was gedruckt wird, geht in den
 * Fingerabdruck. Kopf, Umfang und jede Zeile der Mängelliste.
 */
export const abnahmeStandTable = (project: CablePlannerProject): CsvTable => {
  const m = project.metadata
  const u = umfang(project)
  const liste = maengelTable(project)
  return {
    headers: ['Feld', 'Wert', ...liste.headers],
    rows: [
      ['Anlage', m.name ?? ''],
      ['Standort', m.siteAddress ?? ''],
      ['Kunde', m.client ?? ''],
      ['Errichter', m.contractor ?? m.author ?? ''],
      ['Projekt-Nr.', m.projectNumber ?? ''],
      ['Übergabe-Datum', m.handoverDate ?? ''],
      ['Wartender Dienstleister', m.serviceProvider ?? ''],
      ['Notfallkontakt', m.emergencyContact ?? ''],
      ['Geräte', u.geraete],
      ['Kabel', u.kabel],
      ['Gemessen', u.gemessen],
      ['PASS', u.bestanden],
      ['FAIL', u.nichtBestanden],
      ...u.status.map(([s, n]): CsvCell[] => [`Status ${s ?? 'ohne'}`, n]),
      ...liste.rows,
    ],
  }
}

// ─── DAS BLATT ─────────────────────────────────────────────────────────────

export interface AbnahmeOptionen {
  titel: string
  stempel?: string
  t?: Uebersetzen
}

/** Leere Zeilen am Ende der Liste — für Punkte, die erst bei der Begehung auffallen. */
const HANDZEILEN = 4

export function abnahmeprotokollHtml(project: CablePlannerProject, o: AbnahmeOptionen): string {
  const t = o.t ?? quelle
  const m = project.metadata
  const u = umfang(project)
  const liste = maengel(project)
  const w = uebersetzteWorte(t)
  const dash = '—'

  const kopf: Array<[string, string | undefined]> = [
    [t('abnahme.field.site', 'Installation'), m.name],
    [t('abnahme.field.address', 'Address'), m.siteAddress],
    [t('abnahme.field.client', 'Client'), m.client],
    [t('abnahme.field.contractor', 'Contractor'), m.contractor ?? m.author],
    [t('abnahme.field.projectNo', 'Project no.'), m.projectNumber],
    [t('abnahme.field.handover', 'Handover date'), m.handoverDate ? tag(m.handoverDate) : undefined],
    [t('abnahme.field.service', 'Maintaining service provider'), m.serviceProvider],
    [t('abnahme.field.emergency', 'Emergency contact'), m.emergencyContact],
  ]

  const umfangZeilen: string[][] = [
    [t('abnahme.scope.devices', 'Devices'), String(u.geraete)],
    [t('abnahme.scope.cables', 'Cables'), String(u.kabel)],
    [
      t('abnahme.scope.tested', 'Cables with a test result'),
      fmt(t('abnahme.scope.testedValue', '{n} (pass {pass}, fail {fail})'), {
        n: u.gemessen,
        pass: u.bestanden,
        fail: u.nichtBestanden,
      }),
    ],
    ...u.status.map(([s, n]) => [
      s ? installStatusText(s, t) : t('abnahme.scope.noStatus', 'Without status'),
      String(n),
    ]),
  ]

  const mangelKopf = [
    t('abnahme.col.no', 'No.'),
    t('abnahme.col.kind', 'Kind'),
    t('abnahme.col.concerns', 'Concerns'),
    t('abnahme.col.description', 'Description'),
    t('abnahme.col.reported', 'Reported'),
    t('abnahme.col.by', 'By'),
    t('abnahme.col.deadline', 'Deadline'),
    t('abnahme.col.done', 'Done'),
  ]
  const mangelZeilen = [
    ...liste.map((x, i) => [String(i + 1), w.art[x.art], x.betrifft, beschreibung(x, w), x.gemeldet, x.von, '', '']),
    ...Array.from({ length: HANDZEILEN }, (_, i) => [String(liste.length + i + 1), '', '', '', '', '', '', '']),
  ]

  const kaestchen = (text: string) => `<p class="kreuz"><span class="kasten"></span>${esc(text)}</p>`
  const unterschrift = (rolle: string, wer: string | undefined) => `<div class="unterschrift">
<h3>${esc(rolle)}</h3>
<p class="leise">${esc(wer || dash)}</p>
<p class="linie">${esc(t('abnahme.sign.name', 'Name'))}</p>
<p class="linie">${esc(t('abnahme.sign.placeDate', 'Place, date'))}</p>
<p class="linie">${esc(t('abnahme.sign.signature', 'Signature'))}</p>
</div>`

  const inhalt = `<section>
<h2>${esc(t('abnahme.section.site', '1 · Installation'))}</h2>
<dl>${kopf.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v || dash)}</dd>`).join('')}</dl>
</section>
<section>
<h2>${esc(t('abnahme.section.scope', '2 · Scope and tests'))}</h2>
${tabelle([t('abnahme.col.item', 'Item'), t('abnahme.col.value', 'Value')], umfangZeilen, '')}
<p class="hinweis">${esc(
    t(
      'abnahme.note.scope',
      'A cable without a status or without a test result is counted here, not listed as a defect: the plan does not know whether the work is missing or only its entry.',
    ),
  )}</p>
</section>
<section>
<h2>${esc(t('abnahme.section.defects', '3 · Defects and open items'))}</h2>
<p class="hinweis">${esc(
    t(
      'abnahme.note.defects',
      'Taken from the plan: devices and cables marked as fault or still planned, failed cable tests, and field reports that were neither applied nor rejected. Points found during the walk-through go into the empty rows.',
    ),
  )}</p>
${liste.length === 0 ? `<p class="hinweis">${esc(t('abnahme.none', 'The plan records no defect. That does not mean there is none.'))}</p>` : ''}
${tabelle(mangelKopf, mangelZeilen, '')}
</section>
<section class="zusammen">
<h2>${esc(t('abnahme.section.result', '4 · Result'))}</h2>
${kaestchen(t('abnahme.result.accepted', 'Accepted without defects'))}
${kaestchen(t('abnahme.result.withDefects', 'Accepted with the defects listed under 3, to be remedied by the deadlines stated'))}
${kaestchen(t('abnahme.result.rejected', 'Not accepted'))}
<p class="hinweis">${esc(t('abnahme.note.result', 'Ticked by hand. The plan does not decide the acceptance.'))}</p>
</section>
<section class="zusammen">
<h2>${esc(t('abnahme.section.signatures', '5 · Signatures'))}</h2>
<div class="unterschriften">
${unterschrift(t('abnahme.sign.client', 'Client'), m.client)}
${unterschrift(t('abnahme.sign.contractor', 'Contractor'), m.contractor ?? m.author)}
</div>
</section>`

  return druckblatt(
    {
      titel: o.titel,
      ...(o.stempel ? { stempel: o.stempel } : {}),
      css: `  .kreuz { margin: 1.5mm 0; }
  .kasten { display: inline-block; width: 3.5mm; height: 3.5mm; border: 0.3mm solid #000; margin-right: 2mm; vertical-align: middle; }
  .unterschriften { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
  .linie { border-top: 0.2mm solid #000; margin: 10mm 0 0; padding-top: 0.8mm; font-size: 8pt; color: #444; }
  .zusammen { break-inside: avoid; }
  td:nth-child(n+7) { width: 18mm; }`,
    },
    inhalt,
  )
}
