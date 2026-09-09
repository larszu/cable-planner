import type { GreenGoConfig, GreenGoGroup, GreenGoKey, GreenGoUser } from '../types/greengo'
import type { IntercomChannel } from '../types/intercomExchange'
import type {
  GreenGoVendorBlock,
  IntercomKey,
  IntercomPlan,
  IntercomPlanStation,
} from '../types/intercomPlan'

// ───────────────────────────────────────────────────────────────────────────
// SLOT <-> GREEN-GO, VERLUSTFREI IN BEIDE RICHTUNGEN (E-2, Schritt 1).
//
// Reine Funktionen: keine Uhr, kein Store, kein Datei-IO — dieselbe
// Aufteilung wie `intercomExchange.ts` und `inventoryPortable.ts`.
//
// ═══════════════════════════════════════════════════════════════════════════
// WARUM DAS NICHT `intercomExchange.ts` IST
// ═══════════════════════════════════════════════════════════════════════════
//
// Die beiden Paare sehen sich ähnlich und beantworten verschiedene Fragen.
// `intercomExchange` baut eine DATEI, die das Haus verlässt: sie vergibt beim
// Zurücklesen neue Anlagen-Nummern (das steht in ihrem Kopf und ist dort
// richtig — eine fremde Anlage hat keine) und kennt in Format-Version 1 keine
// Tastenbelegung.
//
// Dieses Paar übersetzt den PROJEKT-SLOT, und der wird bei jedem Öffnen
// gelesen. Neuvergabe der Nummern hiesse: dieselbe Anlage trägt nach dem
// Öffnen andere Nummern als vorher. Auf einem bespielten System ist das kein
// Detail, sondern der Unterschied zwischen „Kamera 3" und „irgendwer".
//
// Wer die beiden Paare zusammenlegen will, holt sich genau diese Neuvergabe
// ins Projekt. Sie stehen deshalb getrennt und sagen hier, warum.
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS DIE AUSTAUSCHDATEI HEUTE NICHT TRÄGT
// ═══════════════════════════════════════════════════════════════════════════
//
// Die Tastenbelegung. `IntercomStation` in `types/intercomExchange.ts` hat
// kein `keys`-Feld, und es dort zu ergänzen hiesse `INTERCOM_FORMAT_VERSION`
// auf 2 zu heben — was `Broadcast-intercom` (dessen `INTERCOM_PLAN_VERSION`
// auf 1 steht und eine zu neue Datei ABLEHNT, statt sie halb zu lesen) bis zu
// seiner eigenen Anhebung aussperrte. Das ist eine Änderung über zwei Repos
// und gehört nicht nebenbei hier hinein; sie steht als eigener Punkt im
// Backlog. Bis dahin sagt der Export es, statt es zu verschweigen (ADR-005:
// verlustfrei oder laut).
// ───────────────────────────────────────────────────────────────────────────

const channelId = (nr: number): string => `ch-${nr}`
const stationId = (nr: number): string => `st-${nr}`

/**
 * Die Anlagen-Nummern für einen Plan.
 *
 * DEKLARIERTE NUMMERN GEWINNEN (ADR-002). Was im `vendor`-Block steht, wird
 * übernommen; nur was dort fehlt, bekommt die niedrigste freie positive Zahl
 * in Listenreihenfolge. Das ist die einzige Stelle, an der eine Nummer
 * erfunden wird — und `withVendorNumbers` schreibt sie sofort danach fest,
 * damit sie beim nächsten Mal nicht wieder erfunden, sondern gelesen wird.
 */
const nummern = (
  ids: string[],
  deklariert: Record<string, number> | undefined,
): Record<string, number> => {
  const out: Record<string, number> = {}
  const vergeben = new Set<number>()
  for (const id of ids) {
    const n = deklariert?.[id]
    if (typeof n === 'number' && Number.isInteger(n) && n > 0 && !vergeben.has(n)) {
      out[id] = n
      vergeben.add(n)
    }
  }
  let naechste = 1
  for (const id of ids) {
    if (out[id] !== undefined) continue
    while (vergeben.has(naechste)) naechste++
    out[id] = naechste
    vergeben.add(naechste)
  }
  return out
}

/**
 * Den Plan mit festgeschriebenen Anlagen-Nummern zurückgeben.
 *
 * Wird vom Store aufgerufen, wenn ein Plan gesetzt wird. Was `nummern` einmal
 * erfunden hat, steht danach da — die nächste Sitzung liest es, statt erneut
 * zu raten, und eine später eingefügte Sprechstelle verschiebt keine
 * bestehende Nummer mehr.
 */
export const withVendorNumbers = (plan: IntercomPlan): IntercomPlan => {
  const alt = plan.vendor?.greengo
  const greengo: GreenGoVendorBlock = {
    multicastAddress: alt?.multicastAddress ?? '239.1.160.1',
    sampleRate: alt?.sampleRate === 48000 ? 48000 : 32000,
    stationNumbers: nummern(
      plan.stations.map((s) => s.id),
      alt?.stationNumbers,
    ),
    channelNumbers: nummern(
      plan.channels.map((c) => c.id),
      alt?.channelNumbers,
    ),
    ...(alt?.stationColors ? { stationColors: alt.stationColors } : {}),
    ...(alt?.channelColors ? { channelColors: alt.channelColors } : {}),
    ...(alt?.basePreset ? { basePreset: alt.basePreset } : {}),
  }
  return { ...plan, vendor: { ...plan.vendor, greengo } }
}

/**
 * Aus einer Green-GO-Konfiguration den Slot bauen.
 *
 * Das ist die Migration ALTER Projekte und der Rückweg des Editors — beides
 * derselbe Code, weil es dieselbe Frage ist.
 *
 * VERLUSTFREI, mit einer benannten Ausnahme: eine Zugehörigkeit oder eine
 * Taste, die auf eine Gruppe zeigt, die es in der Konfiguration nicht gibt,
 * wird nicht übernommen. Sie wäre im Slot ein Verweis ins Leere, und die
 * Gruppe zu ERFINDEN hiesse, ihr einen Namen auszudenken. Dieselbe Regel, die
 * `toIntercomExchange` für die Zugehörigkeiten schon anwendet.
 *
 * `displayName` wird IMMER übernommen, auch wenn er den Namen wiederholt. Die
 * Austauschdatei lässt ihn in dem Fall weg — dort ist das richtig, eine
 * Kurzform, die nichts kürzt, ist keine. Hier wäre es ein Verlust: beim
 * nächsten Export stünde `DisplayName: ''` auf der Anlage, wo vorher etwas
 * stand.
 */
export const planFromGreengo = (cfg: GreenGoConfig): IntercomPlan => {
  const bekannt = new Set(cfg.groups.map((g) => g.id))
  const channels: IntercomChannel[] = cfg.groups.map((g) => ({
    id: channelId(g.id),
    name: g.name,
  }))

  const stations: IntercomPlanStation[] = cfg.users.map((u) => {
    const keys: IntercomKey[] | undefined = u.keys?.
      filter((k) => bekannt.has(k.groupId)).
      map((k) => ({ page: k.page, button: k.button, channelId: channelId(k.groupId) }))
    return {
      id: stationId(u.id),
      name: u.name,
      ...(u.displayName ? { shortName: u.displayName } : {}),
      memberships: u.groupIds
        .filter((gid) => bekannt.has(gid))
        .map((gid) => ({ channelId: channelId(gid), talk: true, listen: true })),
      ...(keys ? { keys } : {}),
      ...(u.equipmentId ? { equipmentId: u.equipmentId } : {}),
    }
  })

  /** Farbindizes einsammeln — leer heisst „keine gepflegt", nicht „alle 0". */
  const farben = (
    roh: { id: number; color?: number }[],
    schluessel: (nr: number) => string,
  ): Record<string, number> | undefined => {
    const out: Record<string, number> = {}
    for (const e of roh) if (typeof e.color === 'number') out[schluessel(e.id)] = e.color
    return Object.keys(out).length > 0 ? out : undefined
  }

  const stationColors = farben(cfg.users, stationId)
  const channelColors = farben(cfg.groups, channelId)

  return withVendorNumbers({
    systemName: cfg.systemName,
    description: cfg.description ?? '',
    channels,
    stations,
    vendor: {
      greengo: {
        multicastAddress: cfg.multicastAddress,
        sampleRate: cfg.sampleRate,
        stationNumbers: Object.fromEntries(cfg.users.map((u) => [stationId(u.id), u.id])),
        channelNumbers: Object.fromEntries(cfg.groups.map((g) => [channelId(g.id), g.id])),
        ...(stationColors ? { stationColors } : {}),
        ...(channelColors ? { channelColors } : {}),
        ...(cfg.basePreset ? { basePreset: cfg.basePreset } : {}),
      },
    },
  })
}

/**
 * Aus dem Slot die Green-GO-Konfiguration bauen — die Ausgabe-Projektion.
 *
 * WAS GREEN-GO NICHT AUSDRÜCKEN KANN, UND WAS DAMIT PASSIERT. Der Slot trennt
 * talk und listen; `GreenGoUser.groupIds` ist EINE Liste. Eine Stelle, die nur
 * mithört, und eine, die auch spricht, stehen dort gleich. Das ist ein
 * Verlust der Projektion und kein Fehler des Slots — `nurHoerend` sagt, wo er
 * eintritt, damit die Oberfläche es zeigen kann, statt ihn zu verschweigen
 * (ADR-005).
 */
export const greengoFromPlan = (plan: IntercomPlan): GreenGoConfig => {
  const v = plan.vendor?.greengo
  const stNr = nummern(
    plan.stations.map((s) => s.id),
    v?.stationNumbers,
  )
  const chNr = nummern(
    plan.channels.map((c) => c.id),
    v?.channelNumbers,
  )

  const groups: GreenGoGroup[] = plan.channels.map((c) => {
    const farbe = v?.channelColors?.[c.id]
    return {
      id: chNr[c.id],
      name: c.name,
      ...(typeof farbe === 'number' ? { color: farbe } : {}),
    }
  })

  const users: GreenGoUser[] = plan.stations.map((s) => {
    const farbe = v?.stationColors?.[s.id]
    const keys: GreenGoKey[] | undefined = s.keys?.
      filter((k) => chNr[k.channelId] !== undefined).
      map((k) => ({ page: k.page, button: k.button, groupId: chNr[k.channelId] }))
    return {
      id: stNr[s.id],
      name: s.name,
      ...(s.shortName ? { displayName: s.shortName } : {}),
      ...(typeof farbe === 'number' ? { color: farbe } : {}),
      groupIds: s.memberships
        .filter((m) => m.talk || m.listen)
        .map((m) => chNr[m.channelId])
        .filter((n): n is number => typeof n === 'number'),
      ...(keys ? { keys } : {}),
      ...(s.equipmentId ? { equipmentId: s.equipmentId } : {}),
    }
  })

  return {
    systemName: plan.systemName,
    description: plan.description ?? '',
    multicastAddress: v?.multicastAddress ?? '239.1.160.1',
    sampleRate: v?.sampleRate === 48000 ? 48000 : 32000,
    users,
    groups,
    ...(v?.basePreset ? { basePreset: v.basePreset } : {}),
  }
}

/**
 * Die Zugehörigkeiten, die die Green-GO-Projektion nicht ausdrücken kann.
 *
 * Eine Stelle, die auf einem Kanal NUR hört (oder nur spricht), landet in
 * `groupIds` wie eine, die beides darf. Wer den Plan nach Green-GO ausgibt,
 * soll das sehen — nicht als Fehler, sondern als das, was das Zielsystem
 * hergibt.
 */
export const nurHoerend = (
  plan: IntercomPlan,
): { stationName: string; channelName: string; talk: boolean; listen: boolean }[] => {
  const name = new Map(plan.channels.map((c) => [c.id, c.name]))
  const out: { stationName: string; channelName: string; talk: boolean; listen: boolean }[] = []
  for (const s of plan.stations) {
    for (const m of s.memberships) {
      if (m.talk && m.listen) continue
      if (!m.talk && !m.listen) continue
      const kanal = name.get(m.channelId)
      if (kanal === undefined) continue
      out.push({ stationName: s.name, channelName: kanal, talk: m.talk, listen: m.listen })
    }
  }
  return out
}
