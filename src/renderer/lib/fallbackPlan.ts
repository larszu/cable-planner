// ───────────────────────────────────────────────────────────────────────────
// Das Sicherheitsnetz (Bedarf 89, P2). Was passieren SOLL, wenn ein Ziel
// schwaechelt — und die Pruefung, ob das ueberhaupt passieren KANN.
//
//   > Scene names exist in the OBS scene collection, again in hand-edited
//   > NOALBS JSON, and again in the operator's memory during the show; the
//   > safety net's characteristic failure is parking the show on a slate while
//   > the stream is fine.
//
// Die Bedarfs-Datenbank sagt auch, wie: „Record the intended fallback
// behaviour (thresholds, scene names, which destination it protects) as part
// of the plan and emit it as a NOALBS skeleton; name-consistency checking
// between plan and exported config is a cheap win."
//
// ─── DIE BILLIGE PRUEFUNG, DIE NIEMAND MACHT ───────────────────────────────
//
// Ein Szenenname ist eine Zeichenkette, die an drei Stellen steht und an genau
// einer stimmt. Der Waechter schaltet auf „BRB", der Encoder kennt „Be Right
// Back", und niemand merkt es — bis zu dem Moment, in dem es darauf ankommt.
// Der Vergleich kostet nichts und faellt trotzdem aus, weil die Szenenliste
// nirgends neben der Regel steht. Hier steht sie.
//
// Solange die Szenenliste LEER ist, laeuft die Pruefung nicht — und genau das
// wird gesagt (`scenes-unknown`). Ein stiller Durchlauf saehe aus wie
// „geprueft", und das ist der teuerste Zustand von allen.
//
// ─── `localhost` IST KEINE ADRESSE, SONDERN EINE ANNAHME ───────────────────
//
// NOALBS #178: der Waechter erreicht `http://localhost/stat` nicht, obwohl
// dieselbe URL im Browser antwortet — der Browser lief auf einer anderen
// Maschine. Folge: dauerhaftes Umschalten auf die Offline-Szene bei laufendem
// RTMP. Der Plan weiss, auf welchem Geraet der Waechter laeuft und auf welchem
// der Encoder steht; er kann die Annahme also benennen. Ob die URL antwortet,
// weiss er nicht — das ist eine Messung an der Maschine, und eine geratene
// Antwort saehe wie eine aus.
//
// ─── WAS DER EXPORT IST UND WAS NICHT ──────────────────────────────────────
//
// `fallbackSkeleton` ist ein GERUEST zum Abtippen, keine Datei zum Einspielen.
// Das exakte NOALBS-Schema haengt an der Version, die jemand faehrt, und diese
// Anwendung hat sie nie gesehen. Eine JSON-Datei auszugeben, die aussieht wie
// eine Konfiguration und keine ist, waere schlimmer als gar keine: jemand
// spielt sie in ein laufendes Sicherheitsnetz. Der Hinweis steht deshalb IN
// der Datei, nicht nur daneben.
//
// Und: KEIN Stream-Key. Der liegt im Schluesselbund (`credentialKeys.ts`), und
// eine exportierte Konfiguration ist eine Datei, die per Mail geht.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { DeliveryDestination } from '../types/delivery'
import type { FallbackPlan, FallbackRule } from '../types/fallback'
import type { CsvTable } from './csv'

export type FallbackFindingKind =
  | 'scene-unknown'
  | 'scenes-unknown'
  | 'stats-loopback'
  | 'threshold-above-bitrate'
  | 'threshold-order'
  | 'no-return-path'

export const FALLBACK_FINDING_LABEL: Readonly<Record<FallbackFindingKind, string>> = {
  'scene-unknown': 'Szene gibt es im Encoder nicht',
  'scenes-unknown': 'Szenenliste fehlt — der Namensabgleich läuft nicht',
  'stats-loopback': 'localhost ist eine Annahme über die Maschine',
  'threshold-above-bitrate': 'Schwelle über der geplanten Bitrate',
  'threshold-order': 'Schwellen stehen verkehrt herum',
  'no-return-path': 'Kein Rückweg aus der Ausweichszene',
}

export interface FallbackFinding {
  kind: FallbackFindingKind
  text: string
  /** Die betroffene Regel, fuer den Sprung. Leer bei planweiten Befunden. */
  ruleId?: string
}

export interface FallbackAssessment {
  plan: FallbackPlan
  findings: FallbackFinding[]
  /**
   * Ziele ohne Regel. KEIN Befund: ein Plan ohne Sicherheitsnetz ist eine
   * Entscheidung, und je Ziel eine Warnung zu setzen wuerde die sechs echten
   * Befunde darunter begraben (dieselbe Haltung wie `withoutDomain` beim
   * Zeit-Plan und `open` beim Multicast-Adressplan).
   */
  unprotected: string[]
  /** Traegt das Projekt ueberhaupt eine Ausspielung? */
  hasDestinations: boolean
}

const LOOPBACK = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\]|::1)(:|\/|$)/i

/** Ist diese Statistik-URL auf „dieselbe Maschine" gestellt? */
export const isLoopback = (url: string | undefined): boolean => !!url && LOOPBACK.test(url.trim())

/** Die geplante Gesamtbitrate eines Ziels — Video plus Audio, in kbit/s. */
export const plannedKbps = (d: DeliveryDestination): number =>
  (d.encoding?.videoBitrateKbps ?? 0) + (d.encoding?.audioBitrateKbps ?? 0)

const EMPTY: FallbackPlan = { scenes: [], rules: [] }

/**
 * Die Pruefung. Sie liest nur — sie setzt keine Szene und keine Schwelle.
 *
 * Alles, was sie sagt, folgt aus dem Plan: die Szenenliste, die Regeln, die
 * geplanten Bitraten der Ziele und die Geraete, auf denen Waechter und Encoder
 * stehen. Keine Messung, keine Vorgabe.
 */
export function assessFallback(project: CablePlannerProject): FallbackAssessment {
  const plan = project.fallback ?? EMPTY
  const dests = project.deliveryDestinations ?? []
  const destById = new Map(dests.map((d) => [d.id, d]))
  const equipById = new Map(project.equipment.map((e) => [e.id, e]))
  const findings: FallbackFinding[] = []

  const scenes = plan.scenes.map((s) => s.trim()).filter(Boolean)
  const bekannt = new Set(scenes)
  const named = (id: string) => destById.get(id)?.name ?? id
  const geraet = (id: string | undefined) => (id ? (equipById.get(id)?.name ?? id) : undefined)

  // 1) Die Szenenliste selbst. Zuerst, weil sie die naechste Pruefung traegt.
  if (plan.rules.length > 0 && scenes.length === 0) {
    findings.push({
      kind: 'scenes-unknown',
      text: 'Es sind Regeln hinterlegt, aber keine Szene des Encoders steht im Plan. Der Namensabgleich — die billigste Prüfung von allen — läuft damit nicht, und das Ergebnis „keine Beanstandung" wäre keins.',
    })
  }

  for (const r of plan.rules) {
    const ziel = destById.get(r.destinationId)

    // 2) Der Namensabgleich. Der Kern des Bedarfs.
    if (scenes.length > 0) {
      for (const [feld, name] of [
        ['Normalbetrieb', r.sceneNormal],
        ['niedrige Bitrate', r.sceneLow],
        ['offline', r.sceneOffline],
      ] as const) {
        const wert = name?.trim()
        if (!wert || bekannt.has(wert)) continue
        findings.push({
          kind: 'scene-unknown',
          ruleId: r.id,
          text: `${named(r.destinationId)}, ${feld}: „${wert}" steht in keiner Szene des Encoders. Der Wächter schaltet auf einen Namen, den es nicht gibt — die Show bleibt stehen, wo sie gerade war, und niemand sieht einen Fehler.`,
        })
      }
    }

    // 3) Der Rueckweg. NOALBS #119: eine klebende Offline-Szene.
    if (r.sceneOffline?.trim() && !r.sceneNormal?.trim()) {
      findings.push({
        kind: 'no-return-path',
        ruleId: r.id,
        text: `${named(r.destinationId)}: eine Ausweichszene ist benannt, eine für den Normalbetrieb nicht. Wer einmal umschaltet, schaltet nie zurück — die Show läuft auf der Tafel weiter, während die Strecke längst wieder steht.`,
      })
    }

    // 4) Die Schwellen gegeneinander.
    if (
      typeof r.lowKbps === 'number' &&
      typeof r.offlineKbps === 'number' &&
      r.offlineKbps >= r.lowKbps
    ) {
      findings.push({
        kind: 'threshold-order',
        ruleId: r.id,
        text: `${named(r.destinationId)}: „offline" liegt bei ${r.offlineKbps} kbit/s und „niedrig" bei ${r.lowKbps} kbit/s. Offline muss UNTER niedrig liegen, sonst ist der Zwischenzustand nicht erreichbar und es gibt nur an oder aus.`,
      })
    }

    // 5) Die Schwelle gegen die geplante Bitrate.
    if (ziel && typeof r.lowKbps === 'number') {
      const geplant = plannedKbps(ziel)
      if (geplant > 0 && r.lowKbps >= geplant) {
        findings.push({
          kind: 'threshold-above-bitrate',
          ruleId: r.id,
          text: `${named(r.destinationId)}: die Schwelle „niedrig" liegt bei ${r.lowKbps} kbit/s, geplant sind ${geplant} kbit/s (Video ${ziel.encoding.videoBitrateKbps} + Audio ${ziel.encoding.audioBitrateKbps}). Der Zustand liegt damit vom ersten Moment an vor und geht nie weg.`,
        })
      }
    }
  }

  // 6) `localhost`. NOALBS #178.
  if (plan.rules.length > 0 && isLoopback(plan.statsUrl)) {
    const waechter = geraet(plan.watcherEquipmentId)
    const encoderNamen = [
      ...new Set(
        plan.rules
          .map((r) => geraet(destById.get(r.destinationId)?.encoderEquipmentId))
          .filter((n): n is string => !!n),
      ),
    ]
    const fremde = waechter ? encoderNamen.filter((n) => n !== waechter) : []
    findings.push({
      kind: 'stats-loopback',
      text: waechter
        ? fremde.length
          ? `Die Statistik-Quelle ist „${plan.statsUrl}". Der Wächter läuft auf ${waechter}, die Statistik kommt aber von ${fremde.join(', ')} — localhost zeigt dann auf ${waechter} und nicht dorthin. Genau das schaltet dauerhaft auf die Offline-Szene, während die Strecke läuft (NOALBS #178).`
          : `Die Statistik-Quelle ist „${plan.statsUrl}". Wächter und Encoder stehen im Plan auf ${waechter} — das passt, solange es dabei bleibt. Ob die URL dort antwortet, sagt der Plan nicht; das ist eine Messung an der Maschine.`
        : `Die Statistik-Quelle ist „${plan.statsUrl}". „localhost" heißt „dieselbe Maschine" — welche das ist, steht nicht im Plan. Im Beleg antwortete dieselbe URL im Browser und nicht im Wächter, und die Show lief auf der Offline-Szene weiter (NOALBS #178).`,
    })
  }

  const geschuetzt = new Set(plan.rules.map((r) => r.destinationId))
  return {
    plan,
    findings,
    unprotected: dests.filter((d) => !geschuetzt.has(d.id)).map((d) => d.id),
    hasDestinations: dests.length > 0,
  }
}

/** Das Blatt: eine Zeile je Regel, mit den drei Szenen und beiden Schwellen. */
export function fallbackTable(project: CablePlannerProject): CsvTable {
  const a = assessFallback(project)
  const dests = project.deliveryDestinations ?? []
  const name = (id: string) => dests.find((d) => d.id === id)?.name ?? id
  return {
    headers: [
      'Ziel',
      'Normalbetrieb',
      'Niedrige Bitrate',
      'Offline',
      'Schwelle niedrig (kbit/s)',
      'Schwelle offline (kbit/s)',
      'Geplant (kbit/s)',
      'Anmerkung',
    ],
    rows: a.plan.rules.map((r) => {
      const d = dests.find((x) => x.id === r.destinationId)
      return [
        name(r.destinationId),
        r.sceneNormal ?? '',
        r.sceneLow ?? '',
        r.sceneOffline ?? '',
        r.lowKbps ?? '',
        r.offlineKbps ?? '',
        d ? plannedKbps(d) : '',
        r.note ?? '',
      ]
    }),
  }
}

/**
 * Das Geruest zum Abtippen.
 *
 * Bewusst KEINE NOALBS-Datei: das Schema haengt an der Version, und diese
 * Anwendung hat sie nie gesehen. Der Hinweis steht IN der Ausgabe, damit er
 * die Datei nicht verlaesst — jemand schickt sie weiter, und der Satz daneben
 * bleibt im Chat zurueck.
 *
 * Ohne Stream-Key, ohne Ingest-Key: die Datei geht per Mail.
 */
export function fallbackSkeleton(project: CablePlannerProject): string {
  const a = assessFallback(project)
  const dests = project.deliveryDestinations ?? []
  const equip = new Map(project.equipment.map((e) => [e.id, e.name]))
  return JSON.stringify(
    {
      _hinweis:
        'Gerüst zum Abtippen, KEINE einspielbare Konfiguration. Das genaue NOALBS-Schema hängt an der Version, die du fährst; dieser Plan kennt sie nicht. Stream-Keys stehen hier nicht und dürfen hier nicht stehen.',
      waechter: {
        geraet: a.plan.watcherEquipmentId ? (equip.get(a.plan.watcherEquipmentId) ?? null) : null,
        statistikUrl: a.plan.statsUrl ?? null,
      },
      szenenImEncoder: a.plan.scenes,
      regeln: a.plan.rules.map((r) => {
        const d = dests.find((x) => x.id === r.destinationId)
        return {
          ziel: d?.name ?? r.destinationId,
          plattform: d?.platform ?? null,
          encoder: d?.encoderEquipmentId ? (equip.get(d.encoderEquipmentId) ?? null) : null,
          geplantKbps: d ? plannedKbps(d) : null,
          szenen: {
            normal: r.sceneNormal ?? null,
            niedrig: r.sceneLow ?? null,
            offline: r.sceneOffline ?? null,
          },
          schwellenKbps: { niedrig: r.lowKbps ?? null, offline: r.offlineKbps ?? null },
          anmerkung: r.note ?? null,
        }
      }),
      befunde: a.findings.map((f) => ({ art: f.kind, text: f.text })),
    },
    null,
    2,
  )
}

/**
 * Normalisiert den gespeicherten Plan beim Laden.
 *
 * Verworfen wird nur, was unlesbar ist: eine Regel ohne Ziel kann nichts
 * schuetzen. Eine Regel mit einem Szenennamen, den es nicht gibt, BLEIBT —
 * dafuer gibt es einen Befund, und sie hier wegzuwerfen hiesse, den Fehler zu
 * verstecken statt ihn zu zeigen.
 */
export function normaliseFallbackPlan(
  raw: unknown,
  onDrop?: (d: { reason: 'missing-required' | 'duplicate-id'; label: string }) => void,
): FallbackPlan | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Partial<FallbackPlan>
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined

  const scenes = [
    ...new Set((Array.isArray(o.scenes) ? o.scenes : []).map((s) => str(s)).filter((s): s is string => !!s)),
  ]
  const seen = new Set<string>()
  const rules: FallbackRule[] = []
  for (const raw2 of Array.isArray(o.rules) ? o.rules : []) {
    const r = raw2 as Partial<FallbackRule>
    const id = str(r.id)
    const destinationId = str(r.destinationId)
    if (!id || !destinationId) {
      onDrop?.({ reason: 'missing-required', label: id ?? destinationId ?? '' })
      continue
    }
    if (seen.has(id)) {
      onDrop?.({ reason: 'duplicate-id', label: id })
      continue
    }
    seen.add(id)
    const rule: FallbackRule = { id, destinationId }
    const sceneNormal = str(r.sceneNormal)
    if (sceneNormal) rule.sceneNormal = sceneNormal
    const sceneLow = str(r.sceneLow)
    if (sceneLow) rule.sceneLow = sceneLow
    const sceneOffline = str(r.sceneOffline)
    if (sceneOffline) rule.sceneOffline = sceneOffline
    const lowKbps = num(r.lowKbps)
    if (lowKbps !== undefined) rule.lowKbps = lowKbps
    const offlineKbps = num(r.offlineKbps)
    if (offlineKbps !== undefined) rule.offlineKbps = offlineKbps
    const note = str(r.note)
    if (note) rule.note = note
    rules.push(rule)
  }

  const watcherEquipmentId = str(o.watcherEquipmentId)
  const statsUrl = str(o.statsUrl)
  // Ein Objekt ohne alles traegt nichts — Ballast in jedem Projektfile, das
  // den Dialog einmal geoeffnet hat.
  if (!watcherEquipmentId && !statsUrl && scenes.length === 0 && rules.length === 0) return undefined
  return {
    ...(watcherEquipmentId ? { watcherEquipmentId } : {}),
    ...(statsUrl ? { statsUrl } : {}),
    scenes,
    rules,
  }
}
