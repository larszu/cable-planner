// ───────────────────────────────────────────────────────────────────────────
// #1181 — Eingebauter Steckerkatalog mit Konfektionen, und die Stueckliste
// der Kleinteile daraus.
//
// WENIGE EINTRAEGE MIT BELEG STATT VIELER GESCHAETZTER. Jede Zahl unten steht
// so im genannten Herstellerdatenblatt; wo das Blatt nichts sagt (Preis,
// Farbe), bleibt das Feld leer. Neue Eintraege nur mit Datenblatt.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { Cable } from '../types/cable'
import type { Konfektion, SteckerTeil, SteckerTeilArt, SteckerTyp, SteckerWahl } from '../types/stecker'

// Quelle DT-Familie: TE Connectivity, „Industrial & Commercial Transportation —
// Terminals and Connectors", Abschnitt DT Family (Ordering Information S. 115,
// Wire Sealing Range, Required Components S. 116-117: „DEUTSCH DT style
// electrical connectors require secondary wedgelocks which are sold
// separately", W4P = Wedgelock for 4 way receptacle, W4S = for 4 way plug).
// https://www.farnell.com/datasheets/2794935.pdf
// Kontakte: TE-Produktdatenblaetter 0460-202-16141 („Pin … 16 – 20 AWG Wire
// Size, .5 – 1.5 mm²"), 0460-215-16141 („Pin … 14 AWG Wire Size, 2 mm²",
// Size 16), 0462-201-16141 (Socket, 20 – 16 AWG).
const TE_DT_KATALOG = 'https://www.farnell.com/datasheets/2794935.pdf'
const TE = 'TE Connectivity DEUTSCH'

const pin16_20: SteckerTeil = {
  art: 'contact',
  teilenummer: '0460-202-16141',
  hersteller: TE,
  beschreibung: 'Pin, solid, size 16',
  anzahl: 'perPole',
  awg: [16, 20],
  datenblattUrl: 'https://www.te.com/en/product-0460-202-16141.html',
}
const pin14: SteckerTeil = {
  art: 'contact',
  teilenummer: '0460-215-16141',
  hersteller: TE,
  beschreibung: 'Pin, solid, size 16',
  anzahl: 'perPole',
  awg: [14, 14],
  datenblattUrl: 'https://www.te.com/en/product-0460-215-16141.html',
}
const socket16_20: SteckerTeil = {
  art: 'contact',
  teilenummer: '0462-201-16141',
  hersteller: TE,
  beschreibung: 'Socket, solid, size 16',
  anzahl: 'perPole',
  awg: [16, 20],
  datenblattUrl: 'https://www.te.com/en/product-0462-201-16141.html',
}
const w4p: SteckerTeil = { art: 'lock', teilenummer: 'W4P', hersteller: TE, beschreibung: 'Wedgelock, 4 way receptacle', anzahl: 1, datenblattUrl: TE_DT_KATALOG }
const w4s: SteckerTeil = { art: 'lock', teilenummer: 'W4S', hersteller: TE, beschreibung: 'Wedgelock, 4 way plug', anzahl: 1, datenblattUrl: TE_DT_KATALOG }

// Quelle Neutrik XX-Serie: Produktseiten/Datenblaetter neutrik.com.
// NC3MXX/NC3FXX: 3 pole, Kabel-AD 3,5–8,0 mm, Loetkontakte, max. 2,5 mm².
// NC5MXX/NC5FXX: 5 pole, Kabel-AD 3,5–8,0 mm, Loetkontakte, max. 1,0 mm².
// Einteilig geliefert (Einsatz, Gehaeuse, Spannzange, Tuelle) — daher keine
// Kleinteile, die man getrennt bestellen muesste.
const neutrik = (
  id: string,
  polzahl: number,
  geschlecht: 'male' | 'female',
  beschreibung: string,
): SteckerTyp => ({
  id,
  teilenummer: id.toUpperCase(),
  hersteller: 'Neutrik',
  beschreibung,
  datenblattUrl: `https://www.neutrik.com/en/product/${id}`,
  connectorType: 'XLR',
  polzahl,
  geschlecht,
  kabelOdMm: [3.5, 8],
  konfektionen: [{ id: 'standard', name: 'Solder, one piece', teile: [] }],
})

export const EINGEBAUTE_STECKER: SteckerTyp[] = [
  {
    id: 'te-dt04-4p',
    teilenummer: 'DT04-4P',
    hersteller: TE,
    beschreibung: 'DEUTSCH DT receptacle, 4 position, size 16, for pins',
    datenblattUrl: TE_DT_KATALOG,
    polzahl: 4,
    geschlecht: 'male',
    konfektionen: [
      { id: 'awg16-20', name: '16–20 AWG', teile: [w4p, pin16_20] },
      { id: 'awg14', name: '14 AWG', teile: [w4p, pin14] },
    ],
  },
  {
    id: 'te-dt06-4s',
    teilenummer: 'DT06-4S',
    hersteller: TE,
    beschreibung: 'DEUTSCH DT plug, 4 position, size 16, for sockets',
    datenblattUrl: TE_DT_KATALOG,
    polzahl: 4,
    geschlecht: 'female',
    konfektionen: [{ id: 'awg16-20', name: '16–20 AWG', teile: [w4s, socket16_20] }],
  },
  neutrik('nc3mxx', 3, 'male', 'XLR 3 pole male cable connector, XX series'),
  neutrik('nc3fxx', 3, 'female', 'XLR 3 pole female cable connector, XX series'),
  neutrik('nc5mxx', 5, 'male', 'XLR 5 pole male cable connector, XX series'),
  neutrik('nc5fxx', 5, 'female', 'XLR 5 pole female cable connector, XX series'),
]

export const steckerById = (id: string | undefined, katalog: SteckerTyp[] = EINGEBAUTE_STECKER): SteckerTyp | undefined =>
  id ? katalog.find((s) => s.id === id) : undefined

/** Steckertypen, die zum Plan-Steckertyp passen; ohne Treffer der ganze Katalog. */
export const steckerFuerTyp = (connectorType: string | undefined, katalog: SteckerTyp[] = EINGEBAUTE_STECKER): SteckerTyp[] => {
  const passend = katalog.filter((s) => s.connectorType && s.connectorType === connectorType)
  return passend.length > 0 ? passend : katalog
}

/** Passt eine Konfektion zum Aderquerschnitt? Ohne AWG-Angabe an den Kontakten: ja. */
const konfektionPasst = (k: Konfektion, awg: number): boolean =>
  k.teile.every((t) => !t.awg || (awg >= t.awg[0] && awg <= t.awg[1]))

/**
 * Vorschlag nach Aderquerschnitt. Ohne AWG oder ohne passende Konfektion die
 * erste — das ist die, die der Katalog als Normalfall fuehrt.
 */
export const konfektionVorschlag = (stecker: SteckerTyp, awg?: number): Konfektion | undefined => {
  if (awg !== undefined) {
    const k = stecker.konfektionen.find((x) => konfektionPasst(x, awg))
    if (k) return k
  }
  return stecker.konfektionen[0]
}

/** Die Konfektion, die fuer diese Wahl gilt (gewaehlt, sonst Vorschlag). */
export const konfektionFuer = (stecker: SteckerTyp, wahl: SteckerWahl, awg?: number): Konfektion | undefined =>
  stecker.konfektionen.find((k) => k.id === wahl.konfektionId) ?? konfektionVorschlag(stecker, awg)

export interface SteckerStuecklistenZeile {
  /** 'connector' fuer das Gehaeuse selbst, sonst die Teilart. */
  art: SteckerTeilArt | 'connector'
  teilenummer: string
  hersteller?: string
  beschreibung?: string
  anzahl: number
  preis?: number
  /** anzahl × preis, nur wenn ein Preis vorliegt. */
  summe?: number
}

/** Teile EINES Steckers samt Konfektion, Stueckzahl schon aufgeloest. */
export const teileEinesSteckers = (stecker: SteckerTyp, konfektion: Konfektion | undefined): SteckerStuecklistenZeile[] => {
  const zeilen: SteckerStuecklistenZeile[] = [
    {
      art: 'connector',
      teilenummer: stecker.teilenummer,
      hersteller: stecker.hersteller,
      beschreibung: stecker.beschreibung,
      anzahl: 1,
      ...(stecker.preis !== undefined ? { preis: stecker.preis } : {}),
    },
  ]
  for (const t of konfektion?.teile ?? []) {
    zeilen.push({
      art: t.art,
      teilenummer: t.teilenummer,
      hersteller: t.hersteller,
      beschreibung: t.beschreibung,
      anzahl: t.anzahl === 'perPole' ? stecker.polzahl : t.anzahl,
      ...(t.preis !== undefined ? { preis: t.preis } : {}),
    })
  }
  return zeilen
}

/** Preis eines Steckers samt Konfektion — nur, wenn JEDES Teil einen Preis hat. */
export const konfektionsPreis = (stecker: SteckerTyp, konfektion: Konfektion | undefined): number | undefined => {
  let summe = 0
  for (const z of teileEinesSteckers(stecker, konfektion)) {
    if (z.preis === undefined) return undefined
    summe += z.preis * z.anzahl
  }
  return Math.round(summe * 100) / 100
}

/**
 * Die Kleinteil-Stueckliste ueber alle Kabelenden mit gewaehltem Stecker,
 * zusammengefasst nach Hersteller + Teilenummer.
 */
export const steckerStueckliste = (
  cables: Pick<Cable, 'steckerVon' | 'steckerNach' | 'aderAwg'>[],
  katalog: SteckerTyp[] = EINGEBAUTE_STECKER,
): SteckerStuecklistenZeile[] => {
  const map = new Map<string, SteckerStuecklistenZeile>()
  for (const c of cables) {
    for (const wahl of [c.steckerVon, c.steckerNach]) {
      if (!wahl) continue
      const stecker = steckerById(wahl.steckerId, katalog)
      if (!stecker) continue
      for (const z of teileEinesSteckers(stecker, konfektionFuer(stecker, wahl, c.aderAwg))) {
        const key = `${z.hersteller ?? ''}|${z.teilenummer}`
        const vorhanden = map.get(key)
        if (vorhanden) vorhanden.anzahl += z.anzahl
        else map.set(key, { ...z })
      }
    }
  }
  const reihenfolge: (SteckerTeilArt | 'connector')[] = ['connector', 'contact', 'lock', 'seal', 'backshell', 'other']
  return [...map.values()]
    .map((z) => (z.preis !== undefined ? { ...z, summe: Math.round(z.preis * z.anzahl * 100) / 100 } : z))
    .sort((a, b) => reihenfolge.indexOf(a.art) - reihenfolge.indexOf(b.art) || a.teilenummer.localeCompare(b.teilenummer))
}
