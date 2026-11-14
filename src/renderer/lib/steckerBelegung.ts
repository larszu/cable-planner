// ───────────────────────────────────────────────────────────────────────────
// #1179 — Steckerbelegung: welche Ader auf welchen Pin, mit Signalname.
//
// Die Luecke zwischen Plan und Loettisch: der Plan sagt „Kabel X von A nach
// B", aber nicht, welche Ader auf welchen Pin. Hier steht das je Kabel
// (`Cable.belegung`), wahlweise aus einer Standardbelegung uebernommen und
// danach frei abweichend.
//
// STANDARDBELEGUNGEN NUR MIT NORM. Jede Vorlage nennt ihre Quelle im Feld
// `quelle`; was keine Norm oder Herstellerdoku hat, steht nicht hier. Darum
// fehlen z. B. DB25 (Tascam/AES59), HD15 und Hirose 4-pol — sie kommen, wenn
// ihr Beleg vorliegt.
//
// DAS PINBILD IST SCHEMATISCH. Es zeigt Anzahl und Nummerierung; die echte
// Lage der Kontakte steht im Datenblatt des Steckers. Einzige Ausnahme ist
// die Reihe des RJ45 (8 Kontakte nebeneinander, 1 bis 8), die die Norm
// selbst so vorgibt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { BelegungsZeile, Standardbelegung } from '../types/stecker'
import { esc, tabelle, druckblatt, type Uebersetzen } from './druckblatt'
import { konfektionFuer, steckerById, teileEinesSteckers } from './steckerKatalog'

const T568_QUELLE = 'ANSI/TIA-568.2-D, pin/pair assignments T568A and T568B'

const rj45 = (id: string, name: string, farben: string[]): Standardbelegung => ({
  id,
  name,
  connectorType: 'Ethernet/RJ45',
  polzahl: 8,
  anordnung: 'reihe',
  quelle: T568_QUELLE,
  zeilen: farben.map((ader, i) => ({ pin: String(i + 1), ader })),
})

export const STANDARD_BELEGUNGEN: Standardbelegung[] = [
  {
    id: 'xlr3-balanced',
    name: 'XLR 3-pin, balanced audio',
    connectorType: 'XLR',
    polzahl: 3,
    // AES14-1992 (r2004), „AES standard for professional audio equipment —
    // Application of connectors, part 1, XLR-type polarity and gender":
    // Pin 1 Schirm, Pin 2 heiss (+), Pin 3 kalt (−).
    quelle: 'AES14-1992 (r2004): pin 1 shield, pin 2 positive (hot), pin 3 negative (cold)',
    zeilen: [
      { pin: '1', signal: 'Shield' },
      { pin: '2', signal: 'Hot (+)' },
      { pin: '3', signal: 'Cold (−)' },
    ],
  },
  {
    id: 'dmx512-xlr5',
    name: 'DMX512, XLR 5-pin',
    connectorType: 'XLR',
    polzahl: 5,
    // ANSI E1.11-2008 (R2018), USITT DMX512-A, Steckerbelegung XLR 5-pol:
    // 1 Data Link Common, 2 Data 1−, 3 Data 1+, 4 Data 2−, 5 Data 2+.
    quelle: 'ANSI E1.11-2008 (USITT DMX512-A): 1 common, 2 data 1−, 3 data 1+, 4 data 2−, 5 data 2+',
    zeilen: [
      { pin: '1', signal: 'Common' },
      { pin: '2', signal: 'Data 1−' },
      { pin: '3', signal: 'Data 1+' },
      { pin: '4', signal: 'Data 2−' },
      { pin: '5', signal: 'Data 2+' },
    ],
  },
  rj45('rj45-t568b', 'RJ45 T568B', [
    'white/orange', 'orange', 'white/green', 'blue', 'white/blue', 'green', 'white/brown', 'brown',
  ]),
  rj45('rj45-t568a', 'RJ45 T568A', [
    'white/green', 'green', 'white/orange', 'blue', 'white/blue', 'orange', 'white/brown', 'brown',
  ]),
]

export const vorlageById = (id: string | undefined): Standardbelegung | undefined =>
  id ? STANDARD_BELEGUNGEN.find((v) => v.id === id) : undefined

/** Vorlagen fuer einen Plan-Steckertyp und, wenn bekannt, eine Polzahl. */
export const vorlagenFuer = (connectorType: string | undefined, polzahl?: number): Standardbelegung[] =>
  STANDARD_BELEGUNGEN.filter(
    (v) => (!connectorType || v.connectorType === connectorType) && (polzahl === undefined || v.polzahl === polzahl),
  )

/** Die Zeilen einer Vorlage als eigene Kopie — danach darf das Kabel abweichen. */
export const belegungAusVorlage = (v: Standardbelegung): BelegungsZeile[] => v.zeilen.map((z) => ({ ...z }))

/** Weicht die Belegung des Kabels von ihrer Vorlage ab? */
export const weichtAb = (cable: Pick<Cable, 'belegung'>): boolean => {
  const b = cable.belegung
  const v = vorlageById(b?.vorlageId)
  if (!b || !v) return false
  const norm = (z: BelegungsZeile) => `${z.pin}|${z.pinB ?? z.pin}|${z.ader ?? ''}|${z.signal ?? ''}`
  return b.zeilen.map(norm).join('\n') !== v.zeilen.map(norm).join('\n')
}

export interface PinPosition {
  nr: string
  x: number
  y: number
}

/**
 * Schematisches Pinbild: Reihe (RJ45) oder Kreis. Koordinaten in einer
 * Einheitsflaeche 0..1. Die Nummern kommen aus der Belegung, sonst 1..n.
 */
export const pinbild = (nummern: string[], anordnung: 'reihe' | 'kreis' = 'kreis'): PinPosition[] => {
  const n = nummern.length
  if (n === 0) return []
  if (anordnung === 'reihe' || n === 1) {
    return nummern.map((nr, i) => ({ nr, x: n === 1 ? 0.5 : 0.1 + (0.8 * i) / (n - 1), y: 0.5 }))
  }
  return nummern.map((nr, i) => {
    const w = -Math.PI / 2 + (2 * Math.PI * i) / n
    return { nr, x: 0.5 + 0.38 * Math.cos(w), y: 0.5 + 0.38 * Math.sin(w) }
  })
}

/** Pinbild als SVG-Text (fuer Druck); `markiert` hebt einen Pin hervor. */
export const pinbildSvg = (pins: PinPosition[], markiert?: string, groesse = 120): string => {
  const r = Math.min(0.08, pins.length > 1 ? 0.35 / pins.length + 0.03 : 0.08) * groesse
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${groesse}" height="${groesse}" viewBox="0 0 ${groesse} ${groesse}">
<rect x="1" y="1" width="${groesse - 2}" height="${groesse - 2}" fill="none" stroke="#000" stroke-width="1"/>
${pins
  .map(
    (p) =>
      `<circle cx="${(p.x * groesse).toFixed(1)}" cy="${(p.y * groesse).toFixed(1)}" r="${r.toFixed(1)}" fill="${p.nr === markiert ? '#000' : '#fff'}" stroke="#000"/>` +
      `<text x="${(p.x * groesse).toFixed(1)}" y="${(p.y * groesse + r * 2.4).toFixed(1)}" font-size="${(r * 1.3).toFixed(1)}" text-anchor="middle">${esc(p.nr)}</text>`,
  )
  .join('\n')}
</svg>`
}

export interface KonfektionsblattEingabe {
  cable: Cable
  von: string
  nach: string
}

/**
 * Konfektionsblatt: EIN Blatt je Steckerende, mit Stecker, Teilen,
 * Pinbild und Belegung. Ohne Belegung und ohne Stecker an einem Ende hat
 * dieses Ende kein Blatt.
 */
export const konfektionsblattHtml = (e: KonfektionsblattEingabe, t: Uebersetzen): string => {
  const { cable } = e
  const zeilen = cable.belegung?.zeilen ?? []
  const vorlage = vorlageById(cable.belegung?.vorlageId)
  const blaetter: string[] = []
  for (const seite of ['A', 'B'] as const) {
    const wahl = seite === 'A' ? cable.steckerVon : cable.steckerNach
    const stecker = steckerById(wahl?.steckerId)
    if (!stecker && zeilen.length === 0) continue
    const pinVon = (z: BelegungsZeile) => (seite === 'A' ? z.pin : z.pinB ?? z.pin)
    const ziel = seite === 'A' ? e.von : e.nach
    const teile = stecker && wahl ? teileEinesSteckers(stecker, konfektionFuer(stecker, wahl, cable.aderAwg)) : []
    const pins = pinbild(zeilen.map(pinVon), vorlage?.anordnung ?? 'kreis')
    blaetter.push(`<section style="page-break-after: always">
<h1>${esc(cable.cableNumber || cable.name)} — ${esc(t('belegung.sheet.end', 'End'))} ${seite}</h1>
<p>${esc(ziel)}</p>
${stecker ? `<h2>${esc(t('belegung.sheet.connector', 'Connector'))}</h2><p>${esc(`${stecker.hersteller} ${stecker.teilenummer} — ${stecker.beschreibung}`)}<br><span class="leise">${esc(stecker.datenblattUrl)}</span></p>` : ''}
${teile.length ? tabelle([t('stecker.col.partNumber', 'Part number'), t('stecker.col.description', 'Description'), t('stecker.col.qty', 'Qty')], teile.map((z) => [z.teilenummer, z.beschreibung ?? '', String(z.anzahl)]), '') : ''}
${zeilen.length ? `<h2>${esc(t('belegung.sheet.pinout', 'Pinout'))}</h2>${pinbildSvg(pins)}
<p class="hinweis">${esc(vorlage?.anordnung === 'reihe' ? t('belegung.sheet.row', 'Contacts 1 to n side by side.') : t('belegung.sheet.schematic', 'Schematic: number of pins and numbering. The real position is in the connector datasheet.'))}</p>
${tabelle([t('belegung.col.pin', 'Pin'), t('belegung.col.wire', 'Wire'), t('belegung.col.signal', 'Signal')], zeilen.map((z) => [pinVon(z), z.ader ?? '', z.signal ?? '']), '')}
${vorlage ? `<p class="hinweis">${esc(vorlage.name)}${weichtAb(cable) ? ` — ${esc(t('belegung.deviates', 'modified'))}` : ''} · ${esc(vorlage.quelle)}</p>` : ''}` : ''}
</section>`)
  }
  return druckblatt(
    { titel: `${t('belegung.sheet.title', 'Assembly sheet')} ${cable.cableNumber || cable.name}`, ohneKopf: true },
    blaetter.join('\n') || `<p>${esc(t('belegung.sheet.empty', 'No connector and no pinout set.'))}</p>`,
  )
}
