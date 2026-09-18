// ───────────────────────────────────────────────────────────────────────────
// Die Frontplatten als Liste (#879).
//
// ─── WOZU EINE EIGENE LISTE ────────────────────────────────────────────────
//
// Weil die Platte auf der Baustelle jemand anderes in der Hand hat als den
// Plan: der Elektriker bohrt die Wanddose, bevor ein Kabel liegt. Er braucht
// Mass, Lage und Ausschnitt je Stecker — und zwar auf Papier.
//
// Sie geht durch `berichtsQuellen` und damit durch den Berichts-Editor
// (#880): Spalten, Gruppierung nach Platte, Filter und Vorlagen gelten hier
// wie fuer jede andere Liste. Eine eigene Ansicht dafuer waere eine zweite
// Fassung derselben Tabelle.
//
// ─── WAS IN DEN ZELLEN STEHT, WENN NICHTS ANGEGEBEN IST ────────────────────
//
// Nichts. Keine 0 bei einem fehlenden Ausschnittmass, kein „0 / 0" bei einer
// fehlenden Lage: beides saehe auf einer Bohrliste aus wie eine Angabe, und
// danach sitzt das Loch in der Ecke.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { mmPosition } from '../types/frontplatte'
import type { CsvCell, CsvTable } from './csv'
import type { CablePlannerProject } from '../types/project'

export const frontplattenTable = (project: CablePlannerProject): CsvTable => {
  const rows: CsvCell[][] = []
  for (const geraet of project.equipment) {
    if (!geraet.frontplatte) continue
    const platte = { breiteMm: geraet.widthMm ?? 0, hoeheMm: geraet.heightMm ?? 0 }
    for (const port of [...geraet.inputs, ...geraet.outputs]) {
      const pos = platte.breiteMm > 0 && platte.hoeheMm > 0 ? mmPosition(port, platte) : undefined
      rows.push([
        geraet.name,
        geraet.frontplatte.art,
        platte.breiteMm || '',
        platte.hoeheMm || '',
        port.name,
        port.connectorType,
        pos ? Math.round(pos.xMm) : '',
        pos ? Math.round(pos.yMm) : '',
        port.ausschnittMm ?? '',
        port.gender ?? '',
      ])
    }
  }
  return {
    headers: [
      'Plate',
      'Kind',
      'Width (mm)',
      'Height (mm)',
      'Connector',
      'Type',
      'X (mm)',
      'Y (mm)',
      'Cutout (mm)',
      'Gender',
    ],
    rows,
  }
}
