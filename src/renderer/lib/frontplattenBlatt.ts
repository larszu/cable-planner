// ───────────────────────────────────────────────────────────────────────────
// Die Frontplatte auf Papier — 1:1 (#879).
//
// ─── WARUM MILLIMETER UND KEIN MASSSTAB ────────────────────────────────────
//
// Das Blatt wird AUFGELEGT: der Beschriftungsstreifen wird ausgeschnitten und
// in den Halter geschoben, die Bohrschablone auf die Platte gelegt. Beides
// funktioniert nur, wenn ein Millimeter auf dem Papier ein Millimeter ist.
// CSS kann das — `mm` ist eine absolute Einheit —, und deshalb steht hier
// keine Zahl in Pixeln.
//
// Eine Platte, die breiter ist als das Papier, wird NICHT verkleinert. Sie
// bekommt einen Hinweis: ein verkleinerter Streifen sieht aus wie einer, den
// man einkleben kann, und passt dann nicht. Wer eine 483 mm breite Blende
// drucken will, legt quer ein oder klebt zwei Seiten.
//
// ─── WAS DAS BLATT NICHT IST ───────────────────────────────────────────────
//
// Eine Bohrschablone mit Toleranzen. Es zeichnet die Mitte jedes Ausschnitts
// und, wo ein Mass angegeben ist, seinen Kreis. Wo keines angegeben ist,
// steht ein Kreuz und kein geratener Kreis — dieselbe Regel wie in
// `types/frontplatte.ts`.
//
// REIN: keine Uhr, kein Store, kein IO. Das Drucken macht `printHtml`.
// ───────────────────────────────────────────────────────────────────────────
import { mmPosition, streifenReihen, type PlattenMass } from '../types/frontplatte'
import type { Port } from '../types/equipment'

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface FrontplattenBlattOptionen {
  titel: string
  platte: PlattenMass
  ports: readonly Port[]
  /** Hoehe des Beschriftungsstreifens in mm. Fehlt sie, gibt es keinen. */
  streifenHoeheMm?: number
  /** Was auf dem Streifen steht. Vorgabe: der Port-Name. */
  beschriftung?: (p: Port) => string
  /** Breite des Papiers in mm — fuer den Hinweis „passt nicht". A4 hoch: 210. */
  papierBreiteMm?: number
}

/**
 * Ein Blatt mit der Platte in Originalgroesse und, wenn eine Streifenhoehe
 * angegeben ist, dem Beschriftungsstreifen darunter.
 */
export const buildFrontplattenHtml = (o: FrontplattenBlattOptionen): string => {
  const beschriftung = o.beschriftung ?? ((p: Port) => p.name)
  const reihen = o.streifenHoeheMm ? streifenReihen(o.ports, o.platte, beschriftung) : []
  const papier = o.papierBreiteMm ?? 210
  const zuBreit = o.platte.breiteMm > papier - 20

  const loecher = o.ports
    .map((p) => {
      const pos = mmPosition(p, o.platte)
      if (!pos) return ''
      const d = p.ausschnittMm ?? 0
      const marke =
        d > 0
          ? `<div class="loch" style="left:${pos.xMm - d / 2}mm;top:${pos.yMm - d / 2}mm;width:${d}mm;height:${d}mm"></div>`
          : `<div class="kreuz" style="left:${pos.xMm}mm;top:${pos.yMm}mm"></div>`
      return `${marke}<div class="beschr" style="left:${pos.xMm}mm;top:${pos.yMm + (d > 0 ? d / 2 : 0)}mm">${esc(p.name)}</div>`
    })
    .join('\n')

  const streifen =
    o.streifenHoeheMm && reihen.length > 0
      ? `${reihen
          .map(
            (felder, i) => `${reihen.length > 1 ? `<div class="reihe">Row ${i + 1} of ${reihen.length}</div>` : ''}<div class="streifen" style="width:${o.platte.breiteMm}mm;height:${o.streifenHoeheMm}mm">
${felder.map((f) => `<div class="feld" style="left:${f.xMm}mm">${esc(f.text)}</div>`).join('\n')}
</div>`,
          )
          .join('\n')}
<div class="hinweis">Cut along the border and slide into the holder${reihen.length > 1 ? ' of its row' : ''}.</div>`
      : ''

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(o.titel)}</title>
<style>
  @page { margin: 10mm; }
  body { font-family: Inter, Arial, sans-serif; color: #000; background: #fff; margin: 0; }
  h1 { font-size: 11pt; margin: 0 0 4mm; }
  .platte { position: relative; border: 0.3mm solid #000; }
  .loch { position: absolute; border: 0.3mm solid #000; border-radius: 50%; }
  /* No cutout size means a cross and not a circle: a guessed diameter would
     be the figure someone drills to. */
  .kreuz { position: absolute; width: 3mm; height: 3mm; margin: -1.5mm 0 0 -1.5mm;
           background:
             linear-gradient(#000, #000) center/100% 0.3mm no-repeat,
             linear-gradient(#000, #000) center/0.3mm 100% no-repeat; }
  .beschr { position: absolute; transform: translate(-50%, 1mm); font-size: 6pt; white-space: nowrap; }
  .streifen { position: relative; margin-top: 8mm; border: 0.3mm dashed #666; }
  .feld { position: absolute; top: 50%; transform: translate(-50%, -50%); font-size: 7pt;
          white-space: nowrap; }
  .reihe { margin-top: 6mm; font-size: 6pt; color: #444; }
  .reihe + .streifen { margin-top: 1mm; }
  .hinweis { margin-top: 2mm; font-size: 6pt; color: #444; }
  .warnung { margin: 0 0 4mm; padding: 2mm; border: 0.3mm solid #000; font-size: 7pt; }
</style></head>
<body>
<h1>${esc(o.titel)} · ${o.platte.breiteMm} × ${o.platte.hoeheMm} mm · 1:1</h1>
${
  zuBreit
    ? `<div class="warnung">This plate is ${o.platte.breiteMm} mm wide and does not fit the paper at 1:1. It is NOT scaled down - a shrunken strip looks like one you can glue in. Print on wider paper, landscape, or in two parts.</div>`
    : ''
}
<div class="platte" style="width:${o.platte.breiteMm}mm;height:${o.platte.hoeheMm}mm">
${loecher}
</div>
${streifen}
</body></html>`
}
