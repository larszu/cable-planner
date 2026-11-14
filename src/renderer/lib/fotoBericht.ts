// ───────────────────────────────────────────────────────────────────────────
// Fotodokumentation (#1187) — die Fotos des Plans als Blatt.
//
// Bei einer Bestandsaufnahme fotografiert man Rackrückseite, Typenschild,
// Verkabelung und Deckendurchbruch und findet die Bilder zwei Wochen später
// nicht wieder. Dieses Blatt stellt sie nach dem auf, worauf sie zeigen —
// Raum, Gerät, Kabel, Gerätetyp, Projekt —, jedes mit Bildunterschrift und
// Datum. Es geht in die Übergabe (Dokumentations-Dialog) und ist der
// Bestandsbericht der Bestandsaufnahme.
//
// Der Stand (`fotoBerichtTable`) führt, was gedruckt wird, ohne die
// Bilddaten selbst: Größe und Id stehen für das Bild, und ein Fingerabdruck
// über mehrere Megabyte Base64 bei jeder Registerabfrage wäre teuer.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../types/project'
import type { Foto } from '../types/foto'
import type { CsvTable } from './csv'
import { fotoDatum } from './fotoMasse'
import { druckblatt, esc, quelle, vergleich, type Uebersetzen } from './druckblatt'
import { spalten } from './kanonisch'

export type FotoGruppenArt = 'raum' | 'geraet' | 'kabel' | 'typ' | 'projekt'

export interface FotoGruppe {
  art: FotoGruppenArt
  /** Name des Ziels; beim Projekt leer. */
  name: string
  fotos: Foto[]
}

const REIHENFOLGE: FotoGruppenArt[] = ['raum', 'geraet', 'kabel', 'typ', 'projekt']

/**
 * Die Fotos nach Ziel gruppiert. Ein Foto mit Gerät UND Typ steht beim Gerät
 * (dort wurde es aufgenommen), eines mit Gerät und Raum ebenfalls — einmal
 * im Blatt, nicht zweimal.
 */
export const fotoGruppen = (project: CablePlannerProject): FotoGruppe[] => {
  const geraete = new Map(project.equipment.map((e) => [e.id, e]))
  const kabel = new Map(project.cables.map((c) => [c.id, c]))
  const raeume = new Map((project.locations ?? []).map((l) => [l.id, l]))
  const gruppen = new Map<string, FotoGruppe>()
  const rein = (art: FotoGruppenArt, name: string, f: Foto) => {
    const k = `${art}|${name}`
    const g = gruppen.get(k) ?? { art, name, fotos: [] }
    g.fotos.push(f)
    gruppen.set(k, g)
  }
  for (const f of project.fotos ?? []) {
    const z = f.zeigtAuf
    const eq = z?.equipmentId ? geraete.get(z.equipmentId) : undefined
    const ca = z?.cableId ? kabel.get(z.cableId) : undefined
    const ra = z?.locationId ? raeume.get(z.locationId) : undefined
    if (eq) rein('geraet', eq.name, f)
    else if (ca) rein('kabel', ca.name || ca.id, f)
    else if (ra) rein('raum', ra.name, f)
    else if (z?.deviceTypeId) {
      const bsp = project.equipment.find((e) => e.deviceTypeId === z.deviceTypeId)
      rein('typ', bsp ? (bsp.subtitle || bsp.name) : z.deviceTypeId, f)
    } else rein('projekt', '', f)
  }
  const liste = [...gruppen.values()]
  for (const g of liste) g.fotos.sort((a, b) => vergleich(fotoDatum(a), fotoDatum(b)) || vergleich(a.id, b.id))
  return liste.sort(
    (a, b) => REIHENFOLGE.indexOf(a.art) - REIHENFOLGE.indexOf(b.art) || vergleich(a.name, b.name),
  )
}

/** Der Stand: was gedruckt wird, ohne die Bilddaten. */
export const fotoBerichtTable = (project: CablePlannerProject): CsvTable => ({
  headers: spalten(['Group', 'Target', 'Photo', 'Caption', 'Date', 'Size', 'Mark in plan']),
  rows: fotoGruppen(project).flatMap((g) =>
    g.fotos.map((f) => [
      g.art,
      g.name,
      f.id,
      f.notiz ?? '',
      fotoDatum(f),
      `${f.breite}x${f.hoehe}`,
      f.zeigtAuf?.punkt ? `${Math.round(f.zeigtAuf.punkt.x)},${Math.round(f.zeigtAuf.punkt.y)}` : '',
    ]),
  ),
})

export interface FotoBerichtOptionen {
  titel: string
  stempel?: string
  t?: Uebersetzen
}

const gruppenTitel = (g: FotoGruppe, t: Uebersetzen): string => {
  switch (g.art) {
    case 'raum':
      return `${t('fotoReport.room', 'Room')}: ${g.name}`
    case 'geraet':
      return `${t('fotoReport.device', 'Device')}: ${g.name}`
    case 'kabel':
      return `${t('fotoReport.cable', 'Cable')}: ${g.name}`
    case 'typ':
      return `${t('fotoReport.type', 'Device type')}: ${g.name}`
    case 'projekt':
      return t('fotoReport.project', 'Project')
  }
}

export function fotoBerichtHtml(project: CablePlannerProject, o: FotoBerichtOptionen): string {
  const t = o.t ?? quelle
  const gruppen = fotoGruppen(project)
  const figur = (f: Foto): string => {
    const unter = [f.notiz, fotoDatum(f), f.zeigtAuf?.punkt ? t('fotoReport.marked', 'marked in the plan') : '']
      .filter(Boolean)
      .join(' · ')
    const bild = f.dataUri
      ? `<img src="${esc(f.dataUri)}" alt="${esc(f.notiz ?? '')}">`
      : `<div class="leer">${esc(t('foto.missing', 'image not loaded'))}</div>`
    return `<figure>${bild}<figcaption>${esc(unter)}</figcaption></figure>`
  }
  const inhalt = gruppen.length
    ? gruppen
        .map((g) => `<section><h2>${esc(gruppenTitel(g, t))}</h2><div class="raster">${g.fotos.map(figur).join('')}</div></section>`)
        .join('\n')
    : `<p class="leise">${esc(t('fotoReport.none', 'The plan has no photo.'))}</p>`
  return druckblatt(
    {
      titel: o.titel,
      ...(o.stempel ? { stempel: o.stempel } : {}),
      css: `  section { break-inside: avoid-page; }
  .raster { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm; }
  figure { margin: 0; break-inside: avoid; }
  figure img { display: block; max-width: 100%; max-height: 90mm; object-fit: contain; }
  figure .leer { height: 40mm; border: 0.3mm dashed #999; display: flex; align-items: center; justify-content: center; color: #555; }
  figcaption { font-size: 8pt; color: #333; margin-top: 1mm; }`,
    },
    inhalt,
  )
}
