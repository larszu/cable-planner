// ───────────────────────────────────────────────────────────────────────────
// Das Netz-Merkblatt fuer die Crew (Bedarf 77, P2).
//
// Der Bedarf beginnt mit einem Satz, der die ganze Sache begruendet:
//
//   > On large productions the architecture is irrelevant unless the crew can
//   > use it: FOX's World Cup build required that „all the hundreds of
//   > freelancers and staff members understand how to access the network and
//   > prevent problems".
//
// Und er sagt, was heute an der Stelle steht:
//
//   > There is no standard artefact; today it is a verbal briefing plus a
//   > WhatsApp message.
//
// ─── WAS DIESES BLATT ANDERS MACHT ALS EINE NACHRICHT ──────────────────────
//
// Nichts an seinem Inhalt. Alles an seiner Herkunft und an seinem STAND.
//
// Eine WhatsApp-Nachricht ist nicht deshalb schlecht, weil sie kurz ist —
// sie ist genau richtig kurz. Sie ist schlecht, weil niemand danach sagen
// kann, welche Fassung galt: sie hat keinen Bezeichner, keinen Stand und
// keine Quelle. Wenn am Freitag jemand behauptet, VLAN 30 sei fuer Dante,
// gibt es keine Stelle, an der das nachzusehen waere.
//
// Dieses Blatt ist deshalb ein DOKUMENT im Sinn von ADR-004: es traegt einen
// Bezeichner und einen Stand, und beide folgen aus dem Plan. Wer es in der
// Hand hat, kann fragen „gilt das noch?" — und `sheetLookup` (Bedarf 27)
// beantwortet die Frage.
//
// ─── DIE REGEL, DIE DEN INHALT BESTIMMT ────────────────────────────────────
//
// **Was der Plan nicht weiss, steht als Frage drauf, nicht als Luecke.**
// Eine SSID kennt der Plan nicht — es gibt kein Feld dafuer, und eines zu
// erfinden hiesse, eine Zeile zu bauen, die immer leer bleibt. Auf dem Blatt
// steht deshalb „SSID: nicht im Plan — vor Ort erfragen". Eine leere Zeile
// haette der Leser fuer „es gibt keine" gehalten, und dann steckt er ein
// Kabel.
//
// Dieselbe Regel wie ueberall in diesem Repo (Bedarf 65: „jede
// Mengen-Operation sagt, was sie ausgelassen hat"; Bedarf 85: `pending` ist
// ein eigener Zustand). Sie kostet hier eine Zeile und spart einen Anruf.
//
// ─── WAS NICHT DRAUFSTEHT ──────────────────────────────────────────────────
//
// Adressen einzelner Geraete. Dafuer gibt es das Rack-Tuer-Blatt (Bedarf 22)
// und den Adressplan; sie hier zu wiederholen waere die zweite Wahrheit, und
// ein Merkblatt mit zweihundert Zeilen liest niemand. Das Blatt nennt die
// NETZE und die REGELN, nicht den Bestand.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import { befund, satz, type Satz } from './satz'
import type { CablePlannerProject } from '../types/project'
import type { CsvCell, CsvTable } from './csv'
import { kanonisch, spalten } from './kanonisch'
import { allDeviceInterfaces } from './networkInterfaces'
import { buildAddressPlan } from './addressPlan'
import { buildSwitchPortMaps } from './switchPortMap'
import { buildVenueNetworkRequest } from './venueNetworkRequest'
import { mergeVenueAnswers } from './venueAnswers'

/** Woher eine Zeile kommt — dieselbe Trennung wie im Anforderungsblatt. */
export type CrewOrigin =
  /** Aus dem Plan gerechnet. */
  | 'derived'
  /** Der Plan hat dafuer kein Feld. Steht als Frage drauf. */
  | 'ask'
  /** Eine Auskunft des Hauses (Bedarf 85). */
  | 'venue'

export interface CrewLine {
  /** Stabiler Schluessel; die Oberflaeche uebersetzt ihn. */
  key: string
  origin: CrewOrigin
  /** Der Inhalt im Klartext. Bei `ask` der Hinweis, wen man fragt. */
  text: string
  satz?: Satz
}

export interface CrewSection {
  key: 'netze' | 'reserviert' | 'ports' | 'haus' | 'kontakt'
  lines: CrewLine[]
}

export interface CrewSheet {
  sections: CrewSection[]
  /** Wie viele Zeilen der Plan nicht beantworten kann. */
  askCount: number
}

const nichtLeer = (v: string | undefined): string | undefined => {
  const s = v?.trim()
  return s ? s : undefined
}

/**
 * Das Merkblatt aus dem ganzen Projekt.
 *
 * Nimmt das PROJEKT und nicht Geraete plus Kabel, weil es aus vier Quellen
 * schoepft, die sonst einzeln durchgereicht werden muessten: Geraete, Kabel,
 * die Kontaktfelder und die Antworten des Hauses.
 */
export function buildCrewSheet(project: CablePlannerProject): CrewSheet {
  const { equipment, cables, metadata } = project
  const sections: CrewSection[] = []

  // ─── Netze ───────────────────────────────────────────────────────────────
  const byVlan = new Map<number, Set<string>>()
  for (const { equipment: e, nic } of allDeviceInterfaces(equipment)) {
    if (nic.vlanId === undefined) continue
    const s = byVlan.get(nic.vlanId) ?? new Set<string>()
    s.add(e.name)
    byVlan.set(nic.vlanId, s)
  }
  const netze: CrewLine[] = [...byVlan.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, namen]) => ({
      key: `vlan-${id}`,
      origin: 'derived' as const,
      // Bewusst die ANZAHL und drei Beispiele statt aller Namen: das Blatt
      // soll auf eine Seite passen. Wer alle braucht, nimmt die VLAN-Tabelle.
      ...befund(
        namen.size
          ? satz('crew.text.vlanWith', 'VLAN {id} — {n} devices (incl. {beispiele})', {
              id,
              n: namen.size,
              beispiele: [...namen].slice(0, 3).join(', '),
            })
          : satz('crew.text.vlan', 'VLAN {id} — {n} devices', { id, n: namen.size }),
      ),
    }))
  netze.push({
    key: 'ssid',
    origin: 'ask',
    // Der Plan hat kein SSID-Feld, und eines zu erfinden hiesse, eine Zeile
    // zu bauen, die immer leer bleibt.
    ...befund(satz('crew.text.ssid', 'Wi-Fi name and password: not in the plan — ask on site.')),
  })
  sections.push({ key: 'netze', lines: netze })

  // ─── Reservierte Bereiche ────────────────────────────────────────────────
  const plan = buildAddressPlan(equipment)
  const cidrs = [...new Set(plan.rows.map((r) => r.cidr).filter(Boolean))].sort() as string[]
  const reserviert: CrewLine[] = cidrs.map((c) => ({
    key: `cidr-${c}`,
    origin: 'derived',
    ...befund(
      satz('crew.text.cidr', '{cidr} is taken — do not plug in anything of your own, do not assign anything in it.', {
        cidr: c,
      }),
    ),
  }))
  if (!cidrs.length) {
    reserviert.push({
      key: 'no-cidr',
      origin: 'ask',
      ...befund(
        satz(
          'crew.text.noCidr',
          'The plan names no subnet (addresses or masks are missing). Which ranges are taken must be clarified on site.',
        ),
      ),
    })
  }
  sections.push({ key: 'reserviert', lines: reserviert })

  // ─── Switch-Ports ────────────────────────────────────────────────────────
  // Das ist die Stelle, an der die Crew tatsaechlich Schaden anrichtet: ein
  // freier Port sieht aus wie eine Einladung. Der Plan weiss, welche belegt
  // sind und wem sie gehoeren — also sagt er es.
  const ports: CrewLine[] = buildSwitchPortMaps([...equipment], [...cables]).map((m) => ({
    key: `switch-${m.switchId}`,
    origin: 'derived',
    ...befund(
      satz(
        'crew.text.switch',
        '{switch}: {belegt} of {n} ports in use. Free ports are not released — ask before plugging in.',
        { switch: m.switchName, belegt: m.usedCount, n: m.rows.length },
      ),
    ),
  }))
  sections.push({ key: 'ports', lines: ports })

  // ─── Was das Haus gesagt hat ─────────────────────────────────────────────
  // Bedarf 85 haelt die Antwort fest. Sie gehoert auf dieses Blatt, weil die
  // Crew diejenige ist, die sie verletzt: „ich haeng mich schnell ans
  // Gaeste-WLAN" ist genau der Satz, den eine Auflage verbietet.
  const answers = mergeVenueAnswers({
    request: buildVenueNetworkRequest([...equipment], [...cables]),
    answers: metadata.venueAnswers ?? [],
    ...(nichtLeer(metadata.siteAddress) ? { venue: metadata.siteAddress! } : {}),
  })
  const haus: CrewLine[] = answers
    .filter((r) => r.state === 'refused' || r.state === 'partial')
    .map((r) => ({
      key: `haus-${r.key}`,
      origin: 'venue' as const,
      ...befund(
        r.state === 'refused'
          ? r.note
            ? satz('crew.text.refusedNote', '{punkt}: refused by the venue — {notiz}', { punkt: r.key, notiz: r.note })
            : satz('crew.text.refused', '{punkt}: refused by the venue', { punkt: r.key })
          : r.note
            ? satz('crew.text.conditionNote', '{punkt}: only with a condition — {notiz}', { punkt: r.key, notiz: r.note })
            : satz('crew.text.condition', '{punkt}: only with a condition (condition not noted)', { punkt: r.key }),
      ),
    }))
  sections.push({ key: 'haus', lines: haus })

  // ─── Wen man anruft ──────────────────────────────────────────────────────
  const kontakt: CrewLine[] = []
  const notfall = nichtLeer(metadata.emergencyContact)
  const dienst = nichtLeer(metadata.serviceProvider)
  if (notfall) kontakt.push({ key: 'emergency', origin: 'derived', text: notfall })
  if (dienst) kontakt.push({ key: 'provider', origin: 'derived', text: dienst })
  if (!kontakt.length) {
    // Ein Merkblatt ohne Telefonnummer ist der Zettel, den jemand am Freitag
    // um 23 Uhr in der Hand haelt und wegwirft.
    kontakt.push({
      key: 'no-contact',
      origin: 'ask',
      ...befund(satz('crew.text.noContact', 'No emergency and no service provider contact stored in the project.')),
    })
  }
  sections.push({ key: 'kontakt', lines: kontakt })

  const askCount = sections.reduce(
    (n, s) => n + s.lines.filter((l) => l.origin === 'ask').length,
    0,
  )
  return { sections, askCount }
}

export const CREW_SECTION_LABEL: Record<CrewSection['key'], string> = {
  netze: 'Networks',
  reserviert: 'Reserved ranges',
  ports: 'Switch ports',
  haus: 'What the venue said',
  kontakt: 'Who to call',
}

export const CREW_ORIGIN_LABEL: Record<CrewOrigin, string> = {
  derived: 'from the plan',
  ask: 'clarify on site',
  venue: 'venue information',
}


/**
 * Das Blatt als Tabelle — kanonisches Deutsch, wie jedes Dokument im
 * Register. Der Stand haengt am Inhalt, und der Inhalt darf deshalb nicht an
 * der Anzeigesprache haengen (ADR-004, siehe `stamp:parity`).
 */
export function crewSheetTable(sheet: CrewSheet): CsvTable {
  const rows: CsvCell[][] = []
  for (const s of sheet.sections) {
    for (const l of s.lines) {
      rows.push([
        kanonisch(`crewSheet.section.${s.key}`, CREW_SECTION_LABEL[s.key]),
        kanonisch(`crewSheet.origin.${l.origin}`, CREW_ORIGIN_LABEL[l.origin]),
        l.text,
      ])
    }
  }
  return { headers: spalten(['Section', 'Origin', 'What applies']), rows }
}

/** Fuer das Dokument-Register: das Blatt direkt aus dem Projekt. */
export const crewSheetTableForProject = (project: CablePlannerProject): CsvTable =>
  crewSheetTable(buildCrewSheet(project))
