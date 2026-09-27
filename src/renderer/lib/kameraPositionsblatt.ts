// ───────────────────────────────────────────────────────────────────────────
// Kamera-Positionsblatt — je Kamera: wo sie steht, wohin sie schaut, mit
// welcher Optik, auf welchem Mischer-Eingang, und ihre PTZ-Presets.
//
// Ein Preset lebt im Kamerakopf. Nach einem Tausch, einem Werksreset oder
// dem ersten „kurz nachgestellt" ist es weg oder falsch, und niemand weiss
// mehr, was Preset 3 war. Das Blatt ist die Stelle, an der es nachzulesen
// ist — in der Übergabe, neben dem Plan.
//
// ─── WOHER DIE ANGABEN KOMMEN ──────────────────────────────────────────────
//
// Aus dem Kameraplan (MultiCam, `camera-list` v3): Höhe, Ausrichtung,
// Optik, Presets mit dem Tag, an dem sie gespeichert wurden. Aus diesem Plan:
// der Raum und der Mischer-Eingang (dieselbe Ableitung wie die
// Mischer-Beschriftung, `deriveLabels`).
//
// Ob der Kamerakopf die Presets heute noch so hält, prüft das Blatt NICHT:
// dieses Programm spricht kein Kamera-Protokoll. Es sagt das am Kopf, statt
// mit einer Tabelle den Eindruck eines Abgleichs zu machen.
//
// Die Canvas-Position steht nicht darauf. Sie stammt zwar beim ersten Import
// aus den Venue-Metern, aber danach schiebt jemand die Kamera im Schaltplan
// dorthin, wo sie gut zu verkabeln ist — als Maß wäre sie eine Behauptung.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem, KameraPreset } from '../types/equipment'
import type { CsvCell, CsvTable } from './csv'
import { deriveLabels } from './labelDerivation'
import { standortText } from './equipmentLocation'
import { objektivName, zoombereich } from './kameraOptik'
import { druckblatt, esc, fmt, quelle, tabelle, vergleich, type Uebersetzen } from './druckblatt'

export interface KameraPosition {
  id: string
  name: string
  rolle: string
  standort: string
  hoeheM?: number
  panGrad?: number
  neigungGrad?: number
  objektiv: string
  zoombereich: string
  brennweiteMm?: number
  extender?: number
  mischerEingaenge: Array<{ mischer: string; eingang: number }>
  presets: KameraPreset[]
  ausDemKameraplanEntfernt: boolean
}

/** Eine Kamera im Sinn dieses Blatts: sie kommt aus dem Kameraplan oder trägt dessen Angaben. */
const istKamera = (e: EquipmentItem): boolean =>
  e.multicamId !== undefined || e.optik !== undefined || (e.kameraPresets?.length ?? 0) > 0

export function kameraPositionen(project: CablePlannerProject): KameraPosition[] {
  const byId = new Map(project.equipment.map((e) => [e.id, e]))
  const rollen = new Map((project.sourceIdentities ?? []).map((r) => [r.id, r.name]))
  const { sources } = deriveLabels({
    equipment: project.equipment,
    cables: project.cables,
    sourceIdentities: project.sourceIdentities ?? [],
  })
  return project.equipment
    .filter(istKamera)
    .sort((a, b) => vergleich(a.name, b.name) || vergleich(a.id, b.id))
    .map((e): KameraPosition => {
      const o = e.optik ?? {}
      return {
        id: e.id,
        name: e.name,
        rolle: e.sourceIdentityId ? rollen.get(e.sourceIdentityId) ?? '' : '',
        standort: standortText(e, project.locations ?? []),
        ...(o.hoeheM !== undefined ? { hoeheM: o.hoeheM } : {}),
        ...(o.panGrad !== undefined ? { panGrad: o.panGrad } : {}),
        ...(o.neigungGrad !== undefined ? { neigungGrad: o.neigungGrad } : {}),
        objektiv: objektivName(o) ?? '',
        zoombereich: zoombereich(o) ?? '',
        ...(o.brennweiteMm !== undefined ? { brennweiteMm: o.brennweiteMm } : {}),
        ...(o.extender !== undefined ? { extender: o.extender } : {}),
        mischerEingaenge: sources
          .filter((s) => s.sinkKind === 'atem' && s.sourceEquipmentId === e.id)
          .map((s) => ({ mischer: byId.get(s.sinkEquipmentId)?.name ?? s.sinkEquipmentId, eingang: s.inputIndex }))
          .sort((a, b) => vergleich(a.mischer, b.mischer) || a.eingang - b.eingang),
        presets: [...(e.kameraPresets ?? [])].sort((a, b) => a.nummer - b.nummer),
        ausDemKameraplanEntfernt: e.multicamRemoved === true,
      }
    })
}

/** Alles, was auf dem Blatt steht, als Tabelle — für den Stand. */
export const kameraPositionsblattStandTable = (project: CablePlannerProject): CsvTable => {
  const rows: CsvCell[][] = []
  for (const k of kameraPositionen(project)) {
    const feld = (f: string, w: CsvCell) => rows.push([k.name, f, w])
    feld('Rolle', k.rolle)
    feld('Standort', k.standort)
    feld('Höhe', k.hoeheM ?? '')
    feld('Pan', k.panGrad ?? '')
    feld('Tilt', k.neigungGrad ?? '')
    feld('Objektiv', k.objektiv)
    feld('Zoombereich', k.zoombereich)
    feld('Brennweite', k.brennweiteMm ?? '')
    feld('Extender', k.extender ?? '')
    feld('Entfernt', k.ausDemKameraplanEntfernt ? 'ja' : '')
    for (const m of k.mischerEingaenge) feld('Mischer-Eingang', `${m.mischer} ${m.eingang}`)
    for (const p of k.presets) {
      feld(
        'Preset',
        [p.nummer, p.name, p.segment ?? '', p.panGrad, p.neigungGrad, p.brennweiteMm, p.fokusM, p.gespeichertAm].join(' | '),
      )
    }
  }
  return { headers: ['Gerät', 'Feld', 'Wert'], rows }
}

// ─── DAS BLATT ─────────────────────────────────────────────────────────────

export interface PositionsblattOptionen {
  titel: string
  stempel?: string
  t?: Uebersetzen
}

const zahl = (n: number): string => String(Math.round(n * 10) / 10)

export function kameraPositionsblattHtml(project: CablePlannerProject, o: PositionsblattOptionen): string {
  const t = o.t ?? quelle
  const dash = '—'
  const karte = (k: KameraPosition): string => {
    const felder: Array<[string, string]> = [
      [t('kamerapos.role', 'Role'), k.rolle],
      [t('kamerapos.location', 'Location'), k.standort],
      [t('kamerapos.height', 'Height'), k.hoeheM !== undefined ? `${zahl(k.hoeheM)} m` : ''],
      [
        t('kamerapos.aim', 'Aim'),
        k.panGrad !== undefined || k.neigungGrad !== undefined
          ? fmt(t('kamerapos.aimValue', 'pan {pan}°, tilt {tilt}°'), {
              pan: k.panGrad !== undefined ? zahl(k.panGrad) : dash,
              tilt: k.neigungGrad !== undefined ? zahl(k.neigungGrad) : dash,
            })
          : '',
      ],
      [t('kamerapos.lens', 'Lens'), [k.objektiv, k.zoombereich].filter(Boolean).join(', ')],
      [
        t('kamerapos.focal', 'Set focal length'),
        k.brennweiteMm !== undefined
          ? `${zahl(k.brennweiteMm)} mm${k.extender !== undefined ? ` · ${zahl(k.extender)}x` : ''}`
          : '',
      ],
      [
        t('kamerapos.switcherInput', 'Switcher input'),
        k.mischerEingaenge
          .map((m) => fmt(t('kamerapos.switcherInputValue', '{switcher}, input {n}'), { switcher: m.mischer, n: m.eingang }))
          .join('; '),
      ],
    ]
    const presets = tabelle(
      [
        t('kamerapos.col.no', 'No.'),
        t('kamerapos.col.shot', 'Shot'),
        t('kamerapos.col.segment', 'Segment'),
        t('kamerapos.col.pan', 'Pan'),
        t('kamerapos.col.tilt', 'Tilt'),
        t('kamerapos.col.focal', 'Focal length'),
        t('kamerapos.col.focus', 'Focus'),
        t('kamerapos.col.saved', 'Saved'),
      ],
      k.presets.map((p) => [
        String(p.nummer),
        p.name || t('kamerapos.unnamed', '(unnamed)'),
        p.segment ?? '',
        `${zahl(p.panGrad)}°`,
        `${zahl(p.neigungGrad)}°`,
        `${zahl(p.brennweiteMm)} mm`,
        `${zahl(p.fokusM)} m`,
        p.gespeichertAm.slice(0, 10),
      ]),
      t('kamerapos.noPresets', 'No preset in the camera plan.'),
    )
    return `<article class="karte">
<h2>${esc(k.name)}</h2>
${k.ausDemKameraplanEntfernt ? `<p class="hinweis">${esc(t('kamerapos.removed', 'No longer in the MultiCam plan — the values are from the last import.'))}</p>` : ''}
<dl>${felder.map(([f, w]) => `<dt>${esc(f)}</dt><dd>${esc(w || dash)}</dd>`).join('')}</dl>
<h3>${esc(t('kamerapos.presets', 'PTZ presets'))}</h3>
${presets}
</article>`
  }

  const liste = kameraPositionen(project)
  const inhalt = `<p class="hinweis">${esc(
    t(
      'kamerapos.note',
      'Height, aim, optics and presets as set in the MultiCam plan, each preset with the day it was saved. Whether the camera head still holds them is not checked — this program speaks no camera protocol.',
    ),
  )}</p>
${
  liste.length
    ? liste.map(karte).join('\n')
    : `<p class="leise">${esc(t('kamerapos.none', 'The plan has no camera from a camera plan.'))}</p>`
}`
  return druckblatt(
    {
      titel: o.titel,
      ...(o.stempel ? { stempel: o.stempel } : {}),
      css: `  .karte { break-inside: avoid; border-top: 0.6mm solid #000; padding-top: 2mm; margin-top: 6mm; }
  .karte h2 { border: 0; margin-top: 0; }`,
    },
    inhalt,
  )
}
