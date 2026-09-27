// ───────────────────────────────────────────────────────────────────────────
// Bedien-Kurzübersicht — das Blatt, das neben dem Mischer liegt.
//
// Wer die Anlage nach der Übergabe bedient, hat drei Fragen, bevor er
// überhaupt etwas drückt: welches Bild liegt auf welcher Taste, wohin geht
// das, was rausgeht, und wen rufe ich an, wenn etwas nicht tut. Alle drei
// beantwortet der Plan — die Eingänge aus derselben Ableitung, die die
// Mischer-Beschriftung schreibt (`deriveLabels`), die Ausgänge aus dem
// Kabelgraphen durch Blenden hindurch, die Kontakte aus den Projekt-Daten.
//
// ─── WAS NICHT DRAUFSTEHT ──────────────────────────────────────────────────
//
// Keine Handgriffe: Einschaltreihenfolge, Makros, Szenen, was bei einem
// Ausfall zu tun ist. Das weiss der Plan nicht, und ein Blatt mit dem Titel
// „Kurzanleitung", das sich solche Schritte ausdenkt, wird befolgt — genau
// deshalb heisst es Übersicht und sagt am Kopf, was fehlt. Der Platz für die
// Handgriffe bleibt frei zum Ausfüllen.
//
// Die Quelle heisst so, wie sie in der Regie gesprochen wird: steht an der
// Kamera eine Rolle („Kamera 1"), dann die Rolle, und der Gerätename
// daneben — die Havarie-Kamera springt ein, die Taste heisst weiter so.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem } from '../types/equipment'
import type { CsvCell, CsvTable } from './csv'
import { deriveLabels } from './labelDerivation'
import { detectDeviceKind } from './deviceKind'
import { durchBlenden, gegenendenJePort } from './patchPanel'
import { portDisplayLabel } from './portLabel'
import { standortText } from './equipmentLocation'
import { druckblatt, esc, fmt, quelle, tabelle, vergleich, type Uebersetzen } from './druckblatt'

export interface EingangsZeile {
  eingang: number
  quelle: string
  geraet: string
  standort: string
}

export interface AusgangsZeile {
  ausgang: string
  ziel: string
  zielPort: string
  standort: string
  via: string[]
}

export interface Senke {
  name: string
  art: 'mischer' | 'router'
  eingaenge: EingangsZeile[]
  ausgaenge: AusgangsZeile[]
}

export interface BedienUebersicht {
  kontakte: { dienstleister: string; notfall: string; standort: string }
  senken: Senke[]
  web: Array<{ geraet: string; adresse: string }>
}

const portName = (e: EquipmentItem | undefined, id: string): string => {
  const p = e ? [...(e.inputs ?? []), ...(e.outputs ?? [])].find((x) => x.id === id) : undefined
  return p ? portDisplayLabel(p) || p.id : id
}

export function bedienUebersicht(project: CablePlannerProject): BedienUebersicht {
  const byId = new Map(project.equipment.map((e) => [e.id, e]))
  const rollen = new Map((project.sourceIdentities ?? []).map((r) => [r.id, r.name]))
  const orte = project.locations ?? []
  const { sources } = deriveLabels({
    equipment: project.equipment,
    cables: project.cables,
    sourceIdentities: project.sourceIdentities ?? [],
  })
  const enden = gegenendenJePort(project.cables)

  const senken: Senke[] = []
  for (const g of [...project.equipment].sort((a, b) => vergleich(a.name, b.name) || vergleich(a.id, b.id))) {
    const kind = detectDeviceKind(g)
    if (kind !== 'atem' && kind !== 'videohub') continue
    const eingaenge = sources
      .filter((s) => s.sinkEquipmentId === g.id)
      .map((s): EingangsZeile => {
        const q = byId.get(s.sourceEquipmentId)
        const rolle = q?.sourceIdentityId ? rollen.get(q.sourceIdentityId) : undefined
        return {
          eingang: s.inputIndex,
          quelle: rolle ?? q?.name ?? s.sourceEquipmentId,
          geraet: rolle && q ? q.name : '',
          standort: q ? standortText(q, orte) : '',
        }
      })
      .sort((a, b) => a.eingang - b.eingang || vergleich(a.quelle, b.quelle))

    const ausgaenge: AusgangsZeile[] = []
    for (const p of g.outputs ?? []) {
      for (const start of enden.get(p.id) ?? []) {
        const { ende, blenden } = durchBlenden(start, byId, enden)
        const ziel = byId.get(ende.equipmentId)
        ausgaenge.push({
          ausgang: portDisplayLabel(p) || p.id,
          ziel: ziel?.name ?? ende.equipmentId,
          zielPort: portName(ziel, ende.portId),
          standort: ziel ? standortText(ziel, orte) : '',
          via: blenden.map((id) => byId.get(id)?.name ?? id),
        })
      }
    }
    ausgaenge.sort((a, b) => vergleich(a.ausgang, b.ausgang) || vergleich(a.ziel, b.ziel) || vergleich(a.zielPort, b.zielPort))
    if (eingaenge.length || ausgaenge.length) senken.push({ name: g.name, art: kind === 'atem' ? 'mischer' : 'router', eingaenge, ausgaenge })
  }

  const m = project.metadata
  return {
    kontakte: { dienstleister: m.serviceProvider ?? '', notfall: m.emergencyContact ?? '', standort: m.siteAddress ?? '' },
    senken,
    web: project.equipment
      .filter((e) => e.mgmtUrl)
      .map((e) => ({ geraet: e.name, adresse: e.mgmtUrl! }))
      .sort((a, b) => vergleich(a.geraet, b.geraet) || vergleich(a.adresse, b.adresse)),
  }
}

/** Was auf dem Blatt steht, als Tabelle — für den Stand. */
export const bedienUebersichtStandTable = (project: CablePlannerProject): CsvTable => {
  const u = bedienUebersicht(project)
  const rows: CsvCell[][] = [
    ['Wartender Dienstleister', u.kontakte.dienstleister],
    ['Notfallkontakt', u.kontakte.notfall],
    ['Standort', u.kontakte.standort],
  ]
  for (const s of u.senken) {
    for (const e of s.eingaenge) rows.push([`${s.name} Eingang ${e.eingang}`, [e.quelle, e.geraet, e.standort].join(' | ')])
    for (const a of s.ausgaenge) rows.push([`${s.name} Ausgang ${a.ausgang}`, [a.ziel, a.zielPort, a.standort, a.via.join(' → ')].join(' | ')])
  }
  for (const w of u.web) rows.push([`Web ${w.geraet}`, w.adresse])
  return { headers: ['Feld', 'Wert'], rows }
}

// ─── DAS BLATT ─────────────────────────────────────────────────────────────

export interface BedienOptionen {
  titel: string
  stempel?: string
  t?: Uebersetzen
}

export function bedienUebersichtHtml(project: CablePlannerProject, o: BedienOptionen): string {
  const t = o.t ?? quelle
  const u = bedienUebersicht(project)
  const dash = '—'

  const kontakte = `<dl>
<dt>${esc(t('bedien.contact.service', 'Maintaining service provider'))}</dt><dd>${esc(u.kontakte.dienstleister || dash)}</dd>
<dt>${esc(t('bedien.contact.emergency', 'Emergency contact'))}</dt><dd>${esc(u.kontakte.notfall || dash)}</dd>
<dt>${esc(t('bedien.contact.site', 'Address'))}</dt><dd>${esc(u.kontakte.standort || dash)}</dd>
</dl>`

  const senke = (s: Senke): string => {
    const titel =
      s.art === 'mischer'
        ? fmt(t('bedien.switcher', 'Switcher {name}'), { name: s.name })
        : fmt(t('bedien.router', 'Router {name}'), { name: s.name })
    const ein = tabelle(
      [t('bedien.col.input', 'Input'), t('bedien.col.source', 'Source'), t('bedien.col.device', 'Device'), t('bedien.col.location', 'Location')],
      s.eingaenge.map((e) => [String(e.eingang), e.quelle, e.geraet, e.standort]),
      t('bedien.noInput', 'No input is wired in the plan.'),
    )
    const aus = tabelle(
      [t('bedien.col.output', 'Output'), t('bedien.col.target', 'Goes to'), t('bedien.col.location', 'Location'), t('bedien.col.via', 'Via')],
      s.ausgaenge.map((a) => [a.ausgang, `${a.ziel} · ${a.zielPort}`, a.standort, a.via.join(' → ')]),
      t('bedien.noOutput', 'No output is wired in the plan.'),
    )
    return `<section class="zusammen">
<h2>${esc(titel)}</h2>
<h3>${esc(t('bedien.inputs', 'Inputs'))}</h3>
${ein}
<h3>${esc(t('bedien.outputs', 'Outputs'))}</h3>
${aus}
</section>`
  }

  const web = u.web.length
    ? `<section>
<h2>${esc(t('bedien.web', 'Web interfaces'))}</h2>
${tabelle(
  [t('bedien.col.device', 'Device'), t('bedien.col.address', 'Address')],
  u.web.map((w) => [w.geraet, w.adresse]),
  '',
)}
</section>`
    : ''

  const inhalt = `<p class="hinweis">${esc(
    t(
      'bedien.note.scope',
      'What the plan knows: which source lies on which input, where the outputs go, whom to call. Operating steps — power-on order, macros, what to do on a failure — are not in the plan and are not made up here. Write them in the box at the end.',
    ),
  )}</p>
<section>
<h2>${esc(t('bedien.contacts', 'Contacts'))}</h2>
${kontakte}
</section>
${u.senken.length ? u.senken.map(senke).join('\n') : `<p class="leise">${esc(t('bedien.noSwitcher', 'The plan has no switcher or router with a wired input or output.'))}</p>`}
${web}
<section class="zusammen">
<h2>${esc(t('bedien.steps', 'Operating steps (to be filled in)'))}</h2>
<div class="frei"></div>
</section>`

  return druckblatt(
    {
      titel: o.titel,
      ...(o.stempel ? { stempel: o.stempel } : {}),
      css: `  .zusammen { break-inside: avoid; }
  .frei { border: 0.2mm solid #999; height: 60mm; }`,
    },
    inhalt,
  )
}
