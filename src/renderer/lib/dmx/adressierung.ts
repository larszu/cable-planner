// ───────────────────────────────────────────────────────────────────────────
// Adressen vergeben — dicht gepackt, in Lesereihenfolge, ohne stilles Rueckem.
//
// ─── DIE VIER ENTSCHEIDUNGEN DES EIGENTUEMERS (2026-09-10) ─────────────────
//
// 1. DICHT PACKEN. Jedes Geraet direkt hinter das vorige. Keine 10er-Sprunge,
//    kein Block je Typ. Das Universe wird ausgenutzt.
// 2. VERGEBEN UND MELDEN, NICHTS STILL VERSCHIEBEN. Die Vergabe weicht einer
//    Kollision NICHT aus. Sie schreibt, was sich ergibt, und meldet den
//    Zusammenstoss mit beiden Geraeten. Ein Werkzeug, das Adressen im
//    Hintergrund verrueckt, erzeugt einen Zettel, der nicht mehr zu dem passt,
//    was jemand von Hand gesetzt hat — und niemand sieht, wann es passierte.
// 3. Der Modus entscheidet den Fussabdruck. Ohne Modus wird NICHT vergeben.
// 4. Das Paket rechnet fuer beide Planer; es kennt keine App.
//
// ─── WAS „NICHT STILL VERSCHIEBEN" GENAU HEISST ────────────────────────────
//
// Zwei Dinge, die man leicht verwechselt:
//
//   * Eine FESTGESETZTE Adresse (`adresseFestgesetzt`) wird nicht angefasst.
//     Sie bleibt, wo sie ist, und die Automatik laeuft um sie herum — nicht
//     indem sie ausweicht, sondern indem sie sie ueberspringt und danach
//     weiterzaehlt, wo sie war.
//   * Eine VERGEBENE Adresse, die auf eine andere trifft, wird trotzdem
//     geschrieben. Der Befund sagt es. Das ist Entscheidung 2 woertlich: der
//     Plan zeigt den Konflikt, statt ihn wegzurechnen.
// ───────────────────────────────────────────────────────────────────────────
import {
  UNIVERSE_GROESSE,
  type Belegung,
  type DmxBefund,
  type DmxGeraet,
  type DmxModus,
  type VergabeErgebnis,
  type VergabeOptionen,
} from './types'

const einsetzen = (vorlage: string, werte: Record<string, string | number>): string =>
  vorlage.replace(/\{(\w+)\}/g, (_, k: string) => (k in werte ? String(werte[k]) : `{${k}}`))

/** Der gewaehlte Modus eines Geraets, oder `undefined`. */
export const modusVon = (g: DmxGeraet): DmxModus | undefined =>
  g.modusId ? g.profil?.modi.find((m) => m.id === g.modusId) : undefined

/**
 * Der Fussabdruck eines Geraets — oder `null`, wenn er NICHT BEKANNT ist.
 *
 * `null` ist hier keine 0 und kein 1: „unbekannt" ist ein eigener Zustand.
 * Wer ihn zu einer Zahl macht, vergibt Adressen auf einer Annahme, und die
 * naechsten Geraete stehen danach alle falsch.
 */
export const fussabdruck = (g: DmxGeraet): number | null => {
  const m = modusVon(g)
  return m && m.kanaele >= 1 ? m.kanaele : null
}

/**
 * Lesereihenfolge: oben nach unten in Reihen von ~1 m, darin links nach
 * rechts. Uebernommen aus `light-planner/src/core/patch.ts`, damit dieselbe
 * Buehne in beiden Planern dieselbe Reihenfolge ergibt.
 *
 * Geraete ohne Position behalten ihre Eingabereihenfolge und stehen hinten:
 * eine erfundene Position waere eine erfundene Reihenfolge.
 */
export const lesereihenfolge = <T extends DmxGeraet>(geraete: readonly T[]): T[] => {
  const mitOrt = geraete.filter((g) => g.x !== undefined && g.y !== undefined)
  const ohneOrt = geraete.filter((g) => g.x === undefined || g.y === undefined)
  const sortiert = [...mitOrt].sort((a, b) => {
    const ra = Math.round(a.y as number)
    const rb = Math.round(b.y as number)
    if (ra !== rb) return ra - rb
    return (a.x as number) - (b.x as number)
  })
  return [...sortiert, ...ohneOrt]
}

const befund = (
  art: DmxBefund['art'],
  geraetId: string,
  schwere: DmxBefund['schwere'],
  schluessel: string,
  vorlage: string,
  werte: Record<string, string | number>,
  anderesGeraetId?: string,
): DmxBefund => ({
  art,
  geraetId,
  ...(anderesGeraetId ? { anderesGeraetId } : {}),
  schwere,
  schluessel,
  werte,
  text: einsetzen(vorlage, werte),
})

/**
 * Was an einem einzelnen Geraet nicht stimmt, BEVOR ueberhaupt adressiert
 * wird. Getrennt gehalten, weil die Oberflaeche das je Geraet zeigen will —
 * ohne den ganzen Plan durchzurechnen.
 */
export const geraetBefunde = (g: DmxGeraet): DmxBefund[] => {
  const b: DmxBefund[] = []
  if (!g.profil || g.profil.modi.length === 0) {
    b.push(
      befund('profil-ohne-modi', g.id, 'hinweis', 'dmx.noModes',
        'No DMX modes are stated for {name}. Without a mode the footprint is unknown, so no address is assigned.',
        { name: g.name }),
    )
    return b
  }
  if (!g.modusId) {
    b.push(
      befund('modus-fehlt', g.id, 'warnung', 'dmx.modeMissing',
        '{name}: no mode chosen. The profile knows {n}; pick one so the plan can count channels.',
        { name: g.name, n: g.profil.modi.length }),
    )
    return b
  }
  const m = modusVon(g)
  if (!m) {
    b.push(
      befund('modus-unbekannt', g.id, 'fehler', 'dmx.modeUnknown',
        '{name} is set to a mode the profile no longer knows ({mode}). It was renamed or removed.',
        { name: g.name, mode: g.modusId }),
    )
    return b
  }
  if (m.kanaele > UNIVERSE_GROESSE) {
    b.push(
      befund('modus-zu-gross', g.id, 'fehler', 'dmx.modeTooLarge',
        '{name} in mode {mode} needs {ch} channels — more than one universe holds ({max}).',
        { name: g.name, mode: m.name, ch: m.kanaele, max: UNIVERSE_GROESSE }),
    )
  }
  if (m.herkunft === 'geschaetzt') {
    b.push(
      befund('herkunft-geschaetzt', g.id, 'hinweis', 'dmx.modeEstimated',
        'The channel count for {name} in mode {mode} is an estimate, not a reading. Every address after it moves if the real figure differs.',
        { name: g.name, mode: m.name }),
    )
  }
  return b
}

const ueberschneidungen = (belegungen: readonly Belegung[], geraete: Map<string, DmxGeraet>): DmxBefund[] => {
  const befunde: DmxBefund[] = []
  const nachUniverse = new Map<number, Belegung[]>()
  for (const b of belegungen) {
    const liste = nachUniverse.get(b.universe) ?? []
    liste.push(b)
    nachUniverse.set(b.universe, liste)
  }
  for (const [universe, liste] of nachUniverse) {
    const sortiert = [...liste].sort((a, b) => a.von - b.von)
    for (let i = 1; i < sortiert.length; i += 1) {
      const vorher = sortiert[i - 1]
      const jetzt = sortiert[i]
      if (jetzt.von > vorher.bis) continue
      const a = geraete.get(vorher.geraetId)
      const c = geraete.get(jetzt.geraetId)
      befunde.push(
        befund('ueberschneidung', jetzt.geraetId, 'fehler', 'dmx.overlap',
          '{a} ({aFrom}-{aTo}) and {b} ({bFrom}-{bTo}) overlap in universe {u}. Both react to the same channels.',
          {
            a: a?.name ?? vorher.geraetId,
            aFrom: vorher.von,
            aTo: vorher.bis,
            b: c?.name ?? jetzt.geraetId,
            bFrom: jetzt.von,
            bTo: jetzt.bis,
            u: universe,
          },
          vorher.geraetId),
      )
    }
  }
  return befunde
}

/**
 * Adressen vergeben.
 *
 * Geraete mit `adresseFestgesetzt` behalten ihre Adresse und zaehlen fuer die
 * Ueberschneidungspruefung mit; die Automatik laeuft an ihnen vorbei, ohne
 * ihretwegen zu springen (Entscheidung 2).
 */
export const vergibAdressen = (
  geraete: readonly DmxGeraet[],
  opt: VergabeOptionen,
): VergabeErgebnis => {
  const nachId = new Map(geraete.map((g) => [g.id, g]))
  const vergeben = new Map<string, { universe: number; adresse: number }>()
  const belegungen: Belegung[] = []
  const befunde: DmxBefund[] = []

  // Festgesetzte zuerst eintragen — sie sind da, bevor die Automatik laeuft.
  for (const g of geraete) {
    befunde.push(...geraetBefunde(g))
    const fp = fussabdruck(g)
    if (fp === null || fp > UNIVERSE_GROESSE) continue
    if (g.adresseFestgesetzt && g.universe !== undefined && g.adresse !== undefined) {
      vergeben.set(g.id, { universe: g.universe, adresse: g.adresse })
      belegungen.push({ geraetId: g.id, universe: g.universe, von: g.adresse, bis: g.adresse + fp - 1 })
    }
  }

  let universe = Math.max(1, Math.floor(opt.startUniverse))
  let adresse = Math.min(Math.max(1, Math.floor(opt.startAdresse)), UNIVERSE_GROESSE)
  const grenzeAchten = opt.universeGrenzeAchten !== false

  for (const g of lesereihenfolge(geraete)) {
    if (g.adresseFestgesetzt) continue
    const fp = fussabdruck(g)
    if (fp === null || fp > UNIVERSE_GROESSE) continue

    if (grenzeAchten && adresse + fp - 1 > UNIVERSE_GROESSE) {
      // Kein Geraet liegt ueber einer Universe-Grenze. Das ist das Protokoll,
      // keine Vorliebe: die zweite Haelfte kaeme in einem anderen Datenpaket
      // an, das dieses Geraet nie erreicht.
      befunde.push(
        befund('universe-voll', g.id, 'hinweis', 'dmx.universeFull',
          'Universe {u} has {rest} channels left, {name} needs {ch}. It starts universe {next} at address 1.',
          { u: universe, rest: UNIVERSE_GROESSE - adresse + 1, name: g.name, ch: fp, next: universe + 1 }),
      )
      universe += 1
      adresse = 1
    }

    vergeben.set(g.id, { universe, adresse })
    belegungen.push({ geraetId: g.id, universe, von: adresse, bis: adresse + fp - 1 })
    adresse += fp
    if (!grenzeAchten && adresse > UNIVERSE_GROESSE) {
      universe += 1
      adresse -= UNIVERSE_GROESSE
    }
  }

  befunde.push(...ueberschneidungen(belegungen, nachId))
  return { vergeben, belegungen, befunde }
}

/**
 * Nur pruefen, nichts vergeben — fuer den Plan-Check.
 *
 * Nimmt die Adressen, die im Plan STEHEN, und sagt, was daran nicht stimmt.
 * Getrennt von `vergibAdressen`, weil ein Werkzeug, das beim Pruefen
 * nebenbei etwas aendert, keine Pruefung ist.
 */
export const pruefeAdressen = (geraete: readonly DmxGeraet[]): DmxBefund[] => {
  const nachId = new Map(geraete.map((g) => [g.id, g]))
  const belegungen: Belegung[] = []
  const befunde: DmxBefund[] = []
  for (const g of geraete) {
    befunde.push(...geraetBefunde(g))
    const fp = fussabdruck(g)
    if (fp === null || g.universe === undefined || g.adresse === undefined) continue
    if (fp > UNIVERSE_GROESSE) continue
    if (g.adresse + fp - 1 > UNIVERSE_GROESSE) {
      befunde.push(
        befund('universe-voll', g.id, 'fehler', 'dmx.runsPastEnd',
          '{name} starts at {addr} in universe {u} and needs {ch} channels — that runs past channel {max}.',
          { name: g.name, addr: g.adresse, u: g.universe, ch: fp, max: UNIVERSE_GROESSE }),
      )
      continue
    }
    belegungen.push({ geraetId: g.id, universe: g.universe, von: g.adresse, bis: g.adresse + fp - 1 })
  }
  befunde.push(...ueberschneidungen(belegungen, nachId))
  return befunde
}
