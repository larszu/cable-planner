// ───────────────────────────────────────────────────────────────────────────
// Trassenplan und Durchgänge — wo die Kabel das Gebäude durchqueren.
//
// Beim Durchspielen einer Festinstallation („3 PTZ Saal EG → Regie 2. OG")
// fehlte genau das Blatt, das der Elektroplaner und der Brandschutz zuerst
// verlangen: welche Kabel durch welche Raumgrenze, in welchen Schacht und
// durch welche Geschossdecke gehen. Die 3D-Ansicht zeigt den Weg; eine Liste,
// an der man Schotts plant, gab es nicht.
//
// ─── WAS DAS BLATT BEHAUPTET, UND WAS NICHT ─────────────────────────────────
//
// Es rechnet aus DEMSELBEN Modell wie die 3D-Ansicht (`gebaeudeSzene`): Räume
// aus den Rahmen, Etagen aus der Etagenliste, der Schacht aus dem Rahmen mit
// `steigschacht`. Daraus folgen die Übergänge zwingend — ein Kabel vom Saal im
// EG in die Regie im 2. OG über Schacht S1 tritt aus dem Saal in den Schacht,
// durchläuft zwei Geschossdecken und tritt in die Regie. Mehr weiß der Plan
// nicht:
//   * WIE VIELE Wände zwischen zwei Räumen liegen, steht nirgends. Eine
//     `Raumgrenze` ist deshalb EIN Übergang, nicht „eine Wand".
//   * Ob der Schacht an jeder Decke geschottet ist oder als Ganzes als
//     Brandabschnitt gilt, entscheidet der Bau. Das Blatt nennt beide Arten
//     von Übergängen und überlässt die Bewertung dem Brandschutz.
//   * Durchmesser und Querschnitt eines Kabels führt der Plan nicht; eine
//     Belegungsrechnung für das Schott steht deshalb nicht da, statt einer
//     geratenen.
//
// Ein Etagenwechsel OHNE Schacht im Plan wird genannt und nicht erfunden: der
// Weg ist dann nicht bekannt, und genau das steht im Befund.
//
// Kanonisches Deutsch in den Kopfzeilen — die Liste wird gestempelt, und ein
// Fingerabdruck über übersetzten Text wäre sprachabhängig. Die Zeichnung
// (`trassenplanHtml`) geht durch den Übersetzer; sie wird nicht gestempelt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { CablePlannerProject } from '../types/project'
import type { CsvCell, CsvTable } from './csv'
import { DEFAULT_LENGTH_ESTIMATION } from './cableLengthEstimate'
import { gebaeudeSzene, type GebaeudeSzene, type SzeneRaum, type SzeneSchacht } from './gebaeudeSzene'
import { esc, fmt, quelle, vergleich, type Uebersetzen } from './druckblatt'

export type DurchgangArt = 'raumgrenze' | 'schachtzugang' | 'geschossdecke' | 'ohne-weg'

/** Reihenfolge im Blatt: vom Raum nach aussen, das Ungeklärte zuletzt. */
const ART_REIHE: readonly DurchgangArt[] = ['raumgrenze', 'schachtzugang', 'geschossdecke', 'ohne-weg']

/** Kanonisch — geht in den Stempel ein. Die Oberfläche übersetzt über `durchgangArtText`. */
export const DURCHGANG_ART_LABEL: Record<DurchgangArt, string> = {
  raumgrenze: 'Raumgrenze',
  schachtzugang: 'Schachtzugang',
  geschossdecke: 'Geschossdecke im Schacht',
  'ohne-weg': 'Etagenwechsel ohne Schacht',
}

export interface Durchgang {
  /** Stabil über Bearbeitungen — Sortier- und Gruppierschlüssel. */
  schluessel: string
  art: DurchgangArt
  /** Lesbar: „Saal 0.01 | Technik 0.02", „Saal 0.01 ↔ Schacht S1", „Schacht S1: EG / 1. OG". */
  ort: string
  /** Die Etage(n), auf der der Übergang liegt. */
  etage: string
  kabelIds: string[]
  /** Nur bei `ohne-weg`: warum der Weg nicht bekannt ist. */
  grund?: 'etage' | 'schacht'
}

export interface DurchgangsAuswertung {
  durchgaenge: Durchgang[]
  /** Kabel mit mindestens einem Ende ausserhalb jedes Raums — ohne Übergang gezählt. */
  ohneRaum: number
  szene: GebaeudeSzene
}

/** Die Geschosshöhe fürs Stapeln der Etagen ohne Höhenangabe — nur für die Reihenfolge. */
const GESCHOSS_M = 4

/**
 * Die Szene für Blatt und Liste: der GANZE Plan, nichts ausgeblendet. Was in
 * der Ansicht verborgen ist, liegt trotzdem im Gebäude.
 */
export const trassenSzene = (project: CablePlannerProject): GebaeudeSzene =>
  gebaeudeSzene(
    {
      equipment: project.equipment,
      cables: project.cables,
      locations: project.locations ?? [],
      floors: project.floors ?? [],
    },
    {
      metersPer100px: project.metadata.lengthEstimation?.metersPer100px ?? DEFAULT_LENGTH_ESTIMATION.metersPer100px,
      geschosshoeheM: GESCHOSS_M,
    },
  )

export function durchgaenge(project: CablePlannerProject): DurchgangsAuswertung {
  const szene = trassenSzene(project)
  const raumById = new Map(szene.raeume.map((r) => [r.id, r]))
  const schachtById = new Map(szene.schaechte.map((s) => [s.id, s]))
  const geraetById = new Map(szene.geraete.map((g) => [g.id, g]))
  const kabelById = new Map(project.cables.map((c) => [c.id, c]))

  // Etagen nach Höhe — die Reihenfolge, in der ein Schacht sie durchläuft.
  const etagenNachHoehe = [...szene.etagen].sort((a, b) => a.y - b.y || vergleich(a.name, b.name))
  const etagenRang = new Map(etagenNachHoehe.map((e, i) => [e.name, i]))

  const sammel = new Map<string, Durchgang>()
  const nimm = (d: Omit<Durchgang, 'kabelIds'>, kabelId: string) => {
    const da = sammel.get(d.schluessel)
    if (da) {
      if (!da.kabelIds.includes(kabelId)) da.kabelIds.push(kabelId)
    } else sammel.set(d.schluessel, { ...d, kabelIds: [kabelId] })
  }

  let ohneRaum = 0
  for (const k of szene.kabel) {
    const c = kabelById.get(k.id)
    if (!c) continue
    const a = raumById.get(geraetById.get(c.fromEquipmentId)?.raumId ?? '')
    const b = raumById.get(geraetById.get(c.toEquipmentId)?.raumId ?? '')
    if (!a || !b) {
      ohneRaum += 1
      continue
    }
    if (a.id === b.id) continue
    const [r1, r2] = [a, b].sort((x, y) => vergleich(x.name, y.name) || vergleich(x.id, y.id))

    // Dieselbe Etage — oder ein Plan ganz ohne Etagen: eine Raumgrenze.
    if ((a.etage ?? '') === (b.etage ?? '')) {
      nimm(
        {
          schluessel: `raumgrenze\u0000${r1.id}\u0000${r2.id}`,
          art: 'raumgrenze',
          ort: `${r1.name} | ${r2.name}`,
          etage: a.etage ?? '',
        },
        c.id,
      )
      continue
    }

    const schacht = k.schachtId ? schachtById.get(k.schachtId) : undefined
    const rangA = a.etage !== undefined ? etagenRang.get(a.etage) : undefined
    const rangB = b.etage !== undefined ? etagenRang.get(b.etage) : undefined
    if (!schacht || rangA === undefined || rangB === undefined) {
      nimm(
        {
          schluessel: `ohne-weg\u0000${r1.id}\u0000${r2.id}`,
          art: 'ohne-weg',
          ort: `${r1.name} → ${r2.name}`,
          etage: [r1.etage ?? '?', r2.etage ?? '?'].join(' / '),
          grund: rangA === undefined || rangB === undefined ? 'etage' : 'schacht',
        },
        c.id,
      )
      continue
    }

    for (const r of [a, b]) {
      nimm(
        {
          schluessel: `schachtzugang\u0000${schacht.id}\u0000${r.id}`,
          art: 'schachtzugang',
          ort: `${r.name} ↔ ${schacht.name}`,
          etage: r.etage ?? '',
        },
        c.id,
      )
    }
    const [von, bis] = rangA < rangB ? [rangA, rangB] : [rangB, rangA]
    for (let i = von; i < bis; i++) {
      const unten = etagenNachHoehe[i].name
      const oben = etagenNachHoehe[i + 1].name
      nimm(
        {
          schluessel: `geschossdecke\u0000${schacht.id}\u0000${String(i).padStart(4, '0')}`,
          art: 'geschossdecke',
          ort: `${schacht.name}: ${unten} / ${oben}`,
          etage: `${unten} / ${oben}`,
        },
        c.id,
      )
    }
  }

  const liste = [...sammel.values()].sort(
    (x, y) => ART_REIHE.indexOf(x.art) - ART_REIHE.indexOf(y.art) || vergleich(x.schluessel, y.schluessel),
  )
  for (const d of liste) {
    d.kabelIds.sort((x, y) => vergleich(kabelName(kabelById.get(x)), kabelName(kabelById.get(y))) || vergleich(x, y))
  }
  return { durchgaenge: liste, ohneRaum, szene }
}

const kabelName = (c: Cable | undefined): string => (c ? c.cableNumber || c.name || c.id : '')

export type { Uebersetzen }

/**
 * Die Texte einer Zeile — einmal kanonisch fürs gestempelte CSV, einmal
 * übersetzt für die Zeichnung. Dieselbe Rechnung, zwei Sprachen: sonst
 * stünde auf dem Blatt eine andere Liste als in der Datei.
 */
interface Worte {
  art: (a: DurchgangArt) => string
  ohneAngabe: string
  mantelFehlt: (n: number) => string
  grund: (g: 'etage' | 'schacht') => string
}

const KANONISCH: Worte = {
  art: (a) => DURCHGANG_ART_LABEL[a],
  ohneAngabe: 'ohne Angabe',
  mantelFehlt: (n) => `Mantel/Brandklasse fehlt bei ${n} Kabel${n === 1 ? '' : 'n'}`,
  grund: (g) =>
    g === 'etage'
      ? 'Etage eines Raums nicht angegeben'
      : 'Kein Steigschacht im Plan — der Weg zwischen den Etagen ist nicht bekannt',
}

const uebersetzteWorte = (t: Uebersetzen): Worte => ({
  art: (a) =>
    a === 'raumgrenze'
      ? t('trassenplan.kind.room', 'Room boundary')
      : a === 'schachtzugang'
        ? t('trassenplan.kind.riserEntry', 'Riser entry')
        : a === 'geschossdecke'
          ? t('trassenplan.kind.slab', 'Floor slab in riser')
          : t('trassenplan.kind.noRoute', 'Floor change without riser'),
  ohneAngabe: t('trassenplan.jacket.none', 'not given'),
  mantelFehlt: (n) => fmt(t('trassenplan.finding.jacket', 'Jacket/fire rating missing on {n} cable(s)'), { n }),
  grund: (g) =>
    g === 'etage'
      ? t('trassenplan.finding.floor', 'Floor of a room not given')
      : t('trassenplan.finding.noRiser', 'No riser in the plan — the route between the floors is unknown'),
})

/**
 * „LSZH ×6, ohne Angabe ×2" — die Mäntel, die durch den Übergang gehen.
 * Ohne Angabe steht hinten und wird gezählt, nicht verschwiegen: genau diese
 * Kabel fragt der Brandschutz nach.
 */
const mantelText = (kabel: readonly Cable[], w: Worte): { text: string; ohne: number } => {
  const zaehl = new Map<string, number>()
  let ohne = 0
  for (const c of kabel) {
    const m = c.jacketRating?.trim()
    if (m) zaehl.set(m, (zaehl.get(m) ?? 0) + 1)
    else ohne += 1
  }
  const teile = [...zaehl.entries()].sort((a, b) => vergleich(a[0], b[0])).map(([m, n]) => `${m} ×${n}`)
  if (ohne > 0) teile.push(`${w.ohneAngabe} ×${ohne}`)
  return { text: teile.join(', '), ohne }
}

const zeilen = (project: CablePlannerProject, liste: readonly Durchgang[], w: Worte): CsvCell[][] => {
  const kabelById = new Map(project.cables.map((c) => [c.id, c]))
  return liste.map((d) => {
    const kabel = d.kabelIds.map((id) => kabelById.get(id)).filter((c): c is Cable => !!c)
    const mantel = mantelText(kabel, w)
    const pfade = [...new Set(kabel.map((c) => c.pathway?.trim()).filter((p): p is string => !!p))].sort(vergleich)
    const befund = [
      ...(d.grund ? [w.grund(d.grund)] : []),
      ...(mantel.ohne > 0 ? [w.mantelFehlt(mantel.ohne)] : []),
    ]
    return [
      d.ort,
      w.art(d.art),
      d.etage,
      kabel.map(kabelName).join(', '),
      kabel.length,
      mantel.text,
      pfade.join(', '),
      befund.join('; '),
    ]
  })
}

export const durchgaengeTable = (project: CablePlannerProject): CsvTable => ({
  headers: ['Durchgang', 'Art', 'Etage', 'Kabel', 'Anzahl', 'Mantel/Brandklasse', 'Trasse/Pfad', 'Befund'],
  rows: zeilen(project, durchgaenge(project).durchgaenge, KANONISCH),
})

/**
 * Der Stand des Trassenplan-BLATTS: die Durchgänge UND die Lage der Räume und
 * Schächte. Ein verschobener Raum ändert die Zeichnung, ohne eine Zeile der
 * Liste zu ändern — ohne die Lage im Fingerabdruck stünde ein veraltetes Blatt
 * als aktuell im Register. Wird nie als Datei ausgegeben; die Spalten sind die
 * der Liste, die Lage steht in zusätzlichen Zeilen.
 */
export const trassenplanStandTable = (project: CablePlannerProject): CsvTable => {
  const liste = durchgaengeTable(project)
  const szene = trassenSzene(project)
  const r1 = (n: number) => Math.round(n * 10) / 10
  const lage: CsvCell[][] = [
    ...szene.raeume.map((r) => [r.name, 'Raum', r.etage ?? '', `${r1(r.x)} ${r1(r.z)}`, `${r1(r.breite)} × ${r1(r.tiefe)}`, '', '', '']),
    ...szene.schaechte.map((s) => [s.name, 'Schacht', '', `${r1(s.x)} ${r1(s.z)}`, `${r1(s.breite)} × ${r1(s.tiefe)}`, '', '', '']),
  ].sort((a, b) => vergleich(String(a[0]), String(b[0])) || vergleich(String(a[1]), String(b[1])))
  return { headers: liste.headers, rows: [...liste.rows, ...lage] }
}

// ─── DIE ZEICHNUNG ─────────────────────────────────────────────────────────

const zahl = (n: number) => String(Math.round(n * 100) / 100)

export interface TrassenplanOptionen {
  titel: string
  /** Stempelzeile (`stampLine`) für den Fuss — optional. */
  stempel?: string
  t?: Uebersetzen
}

interface Strich {
  ort: string
  von: { x: number; z: number }
  nach: { x: number; z: number }
  kabelIds: string[]
  text: string
}

/**
 * Ein druckbares Blatt: je Etage die Draufsicht mit Räumen, Schacht und den
 * Verbindungen Raum–Raum bzw. Raum–Schacht, darunter die Durchgangsliste.
 *
 * Alle Etagen im SELBEN Ausschnitt und Massstab, damit ein Schacht auf jedem
 * Blatt an derselben Stelle steht und man die Seiten übereinanderlegen kann.
 */
export function trassenplanHtml(project: CablePlannerProject, o: TrassenplanOptionen): string {
  const t = o.t ?? quelle
  const { durchgaenge: liste, ohneRaum, szene } = durchgaenge(project)
  const kabelById = new Map(project.cables.map((c) => [c.id, c]))
  const raumById = new Map(szene.raeume.map((r) => [r.id, r]))
  const schachtById = new Map(szene.schaechte.map((s) => [s.id, s]))
  const mitte = (r: SzeneRaum | SzeneSchacht) =>
    'hoehe' in r ? { x: r.x + r.breite / 2, z: r.z + r.tiefe / 2 } : { x: r.x, z: r.z }

  // Ausschnitt über ALLE Etagen.
  const flaechen = [
    ...szene.raeume.map((r) => ({ x0: r.x, z0: r.z, x1: r.x + r.breite, z1: r.z + r.tiefe })),
    ...szene.schaechte.map((s) => ({ x0: s.x - s.breite / 2, z0: s.z - s.tiefe / 2, x1: s.x + s.breite / 2, z1: s.z + s.tiefe / 2 })),
  ]
  const rand = 1
  const box =
    flaechen.length > 0
      ? {
          x0: Math.min(...flaechen.map((f) => f.x0)) - rand,
          z0: Math.min(...flaechen.map((f) => f.z0)) - rand,
          x1: Math.max(...flaechen.map((f) => f.x1)) + rand,
          z1: Math.max(...flaechen.map((f) => f.z1)) + rand,
        }
      : { x0: 0, z0: 0, x1: 10, z1: 10 }
  const breite = box.x1 - box.x0
  const tiefe = box.z1 - box.z0
  const schrift = Math.max(0.25, Math.min(breite, tiefe) / 45)

  // Die Etagen in Höhen-Reihenfolge; ohne Etagenliste EIN Blatt für alles.
  // Räume ohne Etage bekommen ein eigenes Blatt, statt still zu fehlen.
  const etagen = [...szene.etagen].sort((a, b) => a.y - b.y || vergleich(a.name, b.name)).map((e) => e.name)
  const OHNE = '\u0000ohne'
  const blaetter: (string | undefined)[] =
    etagen.length === 0
      ? [undefined]
      : [...etagen, ...(szene.raeume.some((r) => r.etage === undefined) ? [OHNE] : [])]
  const aufBlatt = (e: string | undefined, raumEtage: string | undefined) =>
    e === undefined || (e === OHNE ? raumEtage === undefined : raumEtage === e)

  const kabelText = (ids: readonly string[]) =>
    fmt(t('trassenplan.cables', '{n} cables'), { n: ids.length })

  const blatt = (etage: string | undefined): string => {
    const raeume = szene.raeume.filter((r) => aufBlatt(etage, r.etage))
    const striche = new Map<string, Strich>()
    for (const d of liste) {
      if (d.art === 'raumgrenze' && aufBlatt(etage, d.etage || undefined)) {
        const [, a, b] = d.schluessel.split('\u0000')
        const ra = raumById.get(a)
        const rb = raumById.get(b)
        if (ra && rb) striche.set(d.schluessel, { ort: d.ort, von: mitte(ra), nach: mitte(rb), kabelIds: d.kabelIds, text: kabelText(d.kabelIds) })
      }
      if (d.art === 'schachtzugang' && aufBlatt(etage, d.etage || undefined)) {
        const [, s, r] = d.schluessel.split('\u0000')
        const sch = schachtById.get(s)
        const raum = raumById.get(r)
        if (sch && raum) striche.set(d.schluessel, { ort: d.ort, von: mitte(raum), nach: mitte(sch), kabelIds: d.kabelIds, text: kabelText(d.kabelIds) })
      }
    }
    const svgRaeume = raeume
      .map(
        (r) => `<rect x="${zahl(r.x)}" y="${zahl(r.z)}" width="${zahl(r.breite)}" height="${zahl(r.tiefe)}" class="raum" />
<text x="${zahl(r.x + schrift * 0.5)}" y="${zahl(r.z + schrift * 1.3)}" font-size="${zahl(schrift)}" class="raumname">${esc(r.name)}</text>`,
      )
      .join('\n')
    const svgSchaechte = szene.schaechte
      .map(
        (s) => `<rect x="${zahl(s.x - s.breite / 2)}" y="${zahl(s.z - s.tiefe / 2)}" width="${zahl(s.breite)}" height="${zahl(s.tiefe)}" class="schacht" />
<text x="${zahl(s.x)}" y="${zahl(s.z + s.tiefe / 2 + schrift * 1.2)}" font-size="${zahl(schrift)}" text-anchor="middle" class="schachtname">${esc(s.name)}</text>`,
      )
      .join('\n')
    const svgStriche = [...striche.values()]
      .map((s) => {
        const mx = (s.von.x + s.nach.x) / 2
        const mz = (s.von.z + s.nach.z) / 2
        return `<line x1="${zahl(s.von.x)}" y1="${zahl(s.von.z)}" x2="${zahl(s.nach.x)}" y2="${zahl(s.nach.z)}" class="weg" stroke-width="${zahl(schrift * 0.18)}" />
<text x="${zahl(mx)}" y="${zahl(mz - schrift * 0.3)}" font-size="${zahl(schrift * 0.85)}" text-anchor="middle" class="wegtext">${esc(s.text)}</text>`
      })
      .join('\n')
    const zeilen = [...striche.values()]
      .map((s) => {
        const kabel = s.kabelIds.map((id) => kabelName(kabelById.get(id)))
        return `<tr><td>${esc(s.ort)}</td><td>${s.kabelIds.length}</td><td>${esc(kabel.join(', '))}</td></tr>`
      })
      .join('\n')
    const kopf =
      etage === undefined
        ? t('trassenplan.allFloors', 'All rooms')
        : etage === OHNE
          ? t('trassenplan.noFloor', 'Rooms without a floor')
          : etage
    return `<section class="etage">
<h2>${esc(kopf)}</h2>
<svg viewBox="${zahl(box.x0)} ${zahl(box.z0)} ${zahl(breite)} ${zahl(tiefe)}" preserveAspectRatio="xMidYMid meet">
${svgRaeume}
${svgSchaechte}
${svgStriche}
</svg>
${
  zeilen
    ? `<table class="klein"><thead><tr><th>${esc(t('trassenplan.connection', 'Connection'))}</th><th>${esc(t('trassenplan.col.count', 'Count'))}</th><th>${esc(t('trassenplan.cableList', 'Cables'))}</th></tr></thead><tbody>
${zeilen}
</tbody></table>`
    : `<p class="leise">${esc(t('trassenplan.noCrossing', 'No cable leaves a room on this floor.'))}</p>`
}
</section>`
  }

  const kopfzeile = [
    t('trassenplan.col.crossing', 'Crossing'),
    t('trassenplan.col.kind', 'Kind'),
    t('trassenplan.col.floor', 'Floor'),
    t('trassenplan.col.cables', 'Cables'),
    t('trassenplan.col.count', 'Count'),
    t('trassenplan.col.jacket', 'Jacket/fire rating'),
    t('trassenplan.col.pathway', 'Pathway'),
    t('trassenplan.col.finding', 'Finding'),
  ]
  const liste2 = zeilen(project, liste, uebersetzteWorte(t))
    .map((r) => `<tr>${r.map((z) => `<td>${esc(String(z ?? ''))}</td>`).join('')}</tr>`)
    .join('\n')

  const hinweise = [
    t(
      'trassenplan.note.schematic',
      'Rooms and the riser come from the frames in the signal plan, at the scale of the length estimate. A line joins two rooms, or a room and the riser; it does not show where the tray runs inside the room.',
    ),
    ...(szene.schaechte.length === 0
      ? [t('trassenplan.note.noRiser', 'No frame is marked as riser. Cables between floors are listed, but their route is unknown.')]
      : []),
    ...(ohneRaum > 0
      ? [fmt(t('trassenplan.note.outside', '{n} cables have an end outside every room and are not listed.'), { n: ohneRaum })]
      : []),
  ]

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(o.titel)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Inter, Arial, sans-serif; color: #000; background: #fff; margin: 0; font-size: 9pt; }
  h1 { font-size: 13pt; margin: 0 0 3mm; }
  h2 { font-size: 11pt; margin: 0 0 2mm; border-bottom: 0.3mm solid #000; padding-bottom: 1mm; }
  .etage { page-break-after: always; margin-top: 6mm; }
  svg { width: 100%; height: 125mm; border: 0.2mm solid #999; }
  .raum { fill: #f2f2f2; stroke: #000; stroke-width: 0.05; }
  .schacht { fill: #fff; stroke: #000; stroke-width: 0.08; stroke-dasharray: 0.3 0.15; }
  .weg { stroke: #000; }
  .raumname, .schachtname { font-weight: 600; }
  .wegtext { fill: #000; paint-order: stroke; stroke: #fff; stroke-width: 0.12; }
  table { border-collapse: collapse; width: 100%; margin-top: 3mm; }
  th, td { border: 0.2mm solid #999; padding: 1mm 1.5mm; text-align: left; vertical-align: top; }
  th { background: #eee; }
  table.klein { font-size: 8pt; }
  .leise { color: #555; }
  .hinweis { font-size: 8pt; color: #333; margin: 0 0 1.5mm; }
  footer { margin-top: 4mm; font-size: 7pt; color: #555; }
</style></head>
<body>
<h1>${esc(o.titel)}</h1>
${hinweise.map((h) => `<p class="hinweis">${esc(h)}</p>`).join('\n')}
${blaetter.map(blatt).join('\n')}
<section>
<h2>${esc(t('trassenplan.crossings', 'Crossings'))}</h2>
<p class="hinweis">${esc(
    t(
      'trassenplan.note.crossings',
      'One row per crossing: room boundary, entry into the riser, floor slab inside the riser. How many walls lie between two rooms, and whether the riser is sealed at every slab, the plan does not say — that is for fire protection to judge.',
    ),
  )}</p>
<table><thead><tr>${kopfzeile.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
${liste2 || `<tr><td colspan="${kopfzeile.length}">${esc(t('trassenplan.none', 'No cable crosses a room boundary.'))}</td></tr>`}
</tbody></table>
</section>
${o.stempel ? `<footer>${esc(o.stempel)}</footer>` : ''}
</body></html>`
}
