// #1182 — Ablauf mit Plan-Check und das Regie-Blatt. Getrennt von
// `ablaufPruefung.ts`, weil der Plan-Check nicht ins Dokument-Register (und
// damit nicht in die Mobil-Ansicht) gehoert.
import type { Cable } from '../types/cable'
import type { EquipmentItem } from '../types/equipment'
import type { RundownPlan } from '../types/rundown'
import { ablaufPruefung, type AblaufPunkt } from './ablaufPruefung'
import { runDrawingChecks } from './drawingChecks'
import { druckblatt, esc, quelle, tabelle, type Uebersetzen } from './druckblatt'

/**
 * Fuer das Dokument-Register und die Ausgabe: dieselbe Pruefung aus dem
 * Projekt allein, mit dem Plan-Check ueber Geraete und Kabel.
 */
export const ablaufFuerProjekt = (project: {
  rundown?: RundownPlan
  equipment: EquipmentItem[]
  cables: Cable[]
}): AblaufPunkt[] =>
  ablaufPruefung({
    rundown: project.rundown,
    equipment: project.equipment,
    cables: project.cables,
    befunde: runDrawingChecks({ equipment: project.equipment, cables: project.cables }).findings,
  })


/** Das Regie-Blatt als HTML zum Drucken: Punkt, Abschnitt, Geraete, Wege, Pruefung. */
export const regieBlattHtml = (
  project: Parameters<typeof ablaufFuerProjekt>[0],
  o: { titel: string; stempel?: string; t?: Uebersetzen },
): string => {
  const t = o.t ?? quelle
  const punkte = ablaufFuerProjekt(project)
  const kopf = [
    t('runOfShow.col.no', 'No.'),
    t('runOfShow.col.segment', 'Segment'),
    t('runOfShow.col.devices', 'Devices'),
    t('runOfShow.col.paths', 'Paths'),
    t('runOfShow.col.check', 'Check'),
  ]
  const zeilen = punkte.map((p) => [
    p.segment.number ?? '',
    p.segment.note ? `${p.segment.title} — ${p.segment.note}` : p.segment.title,
    p.geraete.join(', '),
    p.wege.join(', '),
    p.ok === undefined ? '' : p.ok ? 'OK' : `${p.befunde.length} ${t('runOfShow.findings', 'finding(s)')}`,
  ])
  const quelleZeile = project.rundown
    ? `<p class="hinweis">${esc(project.rundown.source)}${project.rundown.revision ? ` · ${esc(project.rundown.revision)}` : ''}</p>`
    : ''
  return druckblatt(
    { titel: o.titel, ...(o.stempel ? { stempel: o.stempel } : {}), quer: true },
    quelleZeile + tabelle(kopf, zeilen, t('runOfShow.empty', 'No rundown read in.')),
  )
}
