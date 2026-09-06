// ───────────────────────────────────────────────────────────────────────────
// Bedarf, der nicht in `project.equipment` steht.
//
// WARUM ES DIESE DATEI GIBT (gemessen 2026-09-04, Gegenrunde zu Runde 10).
// `deriveDemand` las ausschliesslich `project.equipment`. Zwei ganze
// Planteile liegen aber daneben, als eigene Projektfelder:
//
//   `project.drumKit`     — Mikrofonierung eines Schlagzeugs
//   `project.wirelessRig` — Kanalplan fuer Funkstrecken
//
// Beide tauchten in KEINER Stueckliste auf. Der Funkstrecken-Plan plant
// Sender-Bodies und Kapseln mit echter Katalog-GUID; die Drum-Mikrofonierung
// hat stattdessen ihre EIGENE, zweite Materialliste (`deriveDrumBom`), die nur
// in die Zwischenablage geht — kein CSV, kein Lagerabgleich, kein Kontakt zum
// Deckungs-Resolver.
//
// DER UNTERSCHIED ZUM RACK-FALL. Ein Rack-Snapshot traegt nur einen Namen, und
// seine Positionen sind deshalb VORSCHLAEGE. Hier ist es besser: `drumKit.mics`
// und `wirelessRig.channels` tragen `deviceTypeId`, also Katalog-GUIDs — die
// Zeilen sind TATSACHEN und landen in der Typ-Spalte.
//
// WAS DAS SCHWIERIG MACHT — und warum diese Datei nicht nur die GUIDs
// weiterreicht: `deriveDrumBom` leitet zusaetzlich Stative, Kessel-Clamps und
// XLR-Kabel ab. Die gibt es im GERAETEkatalog nicht, sie haben also keine
// GUID. Sie wegzulassen waere derselbe stille Unterlauf noch einmal, nur eine
// Ebene tiefer: wer sechs Mikrofone kommissioniert und keine Stative, steht am
// Aufbautag genauso da. Sie kommen deshalb als NAMENS-Zeilen mit, wie alles
// andere ohne Katalog-Zuordnung, und tragen ihre Herkunft im Text.
//
// ─── BEDARF 17: DIE KABEL UND DIE ADAPTER (2026-09-06) ─────────────────────
//
// Derselbe blinde Fleck, eine Ebene groesser. Der Bedarf sagt:
//
//   > The pick list is generated from the commercial reservation, never from
//   > the cable/camera/lighting plan. The plan's BOM (INCLUDING ADAPTERS AND
//   > SPARES) is re-typed by a human; warehouse substitutions made at pack
//   > time never reach the plan and surface at load-in.
//
// Der Cable-Planner hatte die Kabel-Stueckliste (`cableBomTable`) — aber als
// EIGENES Blatt. Der Deckungs-Abgleich gegen das Lager las nur `deriveDemand`,
// also die Geraete. Das Lager kommissioniert damit die Kameras und nicht die
// Kabel: genau die Trennung, die der Bedarf beklagt.
//
// Und die ADAPTER standen ueberhaupt nirgends. Der Plan WEISS, dass er welche
// braucht — `cable.needsConverter` und der LWL-Steckertyp-Mismatch aus
// `drawingChecks` (Check 17b) sagen es beide — aber diese Erkenntnis blieb im
// Zeichnungs-Befund stehen und wurde nie zu Material. Ein Adapter, den
// niemand einpackt, ist am Aufbautag dasselbe wie ein fehlendes Kabel.
//
// WAS HIER NICHT PASSIERT: der Reserve-Aufschlag. `cableBomTable` kennt einen,
// und er ist eine EXPORT-Einstellung des Nutzers — deshalb steht `kabel-bom`
// in `UNJUDGEABLE_DOCUMENTS`. Ihn in den Deckungs-Abgleich zu ziehen hiesse,
// die Antwort „reicht der Bestand?" von einem Prozentsatz abhaengig zu machen,
// den an dieser Stelle niemand sieht. Die Zeilen zaehlen, was der Plan
// verlangt; der Aufschlag bleibt, wo er sichtbar eingestellt wird.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { Port } from '../types/equipment'
import { resolveDeviceType } from './deviceTypeRegistry'
import { deriveDrumBom } from './drumMicing'

/**
 * Eine Bedarfsposition, die nicht von einem `EquipmentItem` kommt.
 *
 * `herkunft` wird in der Stueckliste genannt. Ohne sie sieht die Position aus
 * wie ein frei stehendes Geraet, und wer sie im Regal sucht, weiss nicht, dass
 * sie zum Drum-Set oder zum Funk-Rig gehoert.
 */
export interface ZusatzBedarf {
  /** Katalog-GUID, wo der Plan sie kennt. Dann ist die Zeile eine Tatsache. */
  deviceTypeId?: string
  label: string
  category?: string
  quantity: number
  herkunft: string
}

const DRUM = 'Drum-Mikrofonierung'
const FUNK = 'Funkstrecken-Plan'
const KABEL = 'Kabelplan'
const ADAPTER = 'Adapter (vom Plan verlangt)'

/** Zaehlt gleiche Positionen zusammen, deterministisch sortiert. */
const zusammen = (roh: ZusatzBedarf[]): ZusatzBedarf[] => {
  const byKey = new Map<string, ZusatzBedarf>()
  for (const z of roh) {
    if (!z.label.trim()) continue
    const key = `${z.deviceTypeId ?? ''}|${z.label.trim().toLowerCase()}|${z.herkunft}`
    const hit = byKey.get(key)
    if (hit) hit.quantity += z.quantity
    else byKey.set(key, { ...z, label: z.label.trim() })
  }
  return [...byKey.values()].sort(
    (a, b) => a.herkunft.localeCompare(b.herkunft, 'de') || a.label.localeCompare(b.label, 'de'),
  )
}

/**
 * Der Bedarf aus `drumKit` und `wirelessRig`.
 *
 * Nimmt bewusst nur die beiden Felder entgegen und nicht das ganze Projekt —
 * dann kann ein Test sie einzeln stellen, und die Abhaengigkeit steht in der
 * Signatur statt im Rumpf.
 */
export const zusatzBedarf = (
  plan: Pick<CablePlannerProject, 'drumKit' | 'wirelessRig' | 'cables' | 'equipment'>,
): ZusatzBedarf[] => {
  const roh: ZusatzBedarf[] = []

  // ── Drum-Set ──────────────────────────────────────────────────────────────
  // Die Mikrofone kommen mit ihrer GUID, wo sie eine haben. `deriveDrumBom`
  // liefert daneben Stative/Clamps/XLR — die haben keine, und genau deshalb
  // gehen sie hier UEBER DEN NAMEN mit, statt zu verschwinden.
  const drum = plan.drumKit
  if (drum) {
    for (const m of drum.mics ?? []) {
      const type = resolveDeviceType(m.micDeviceTypeId)
      const label = type?.template.name?.trim() || m.micName?.trim()
      if (!label) continue
      roh.push({
        ...(m.micDeviceTypeId ? { deviceTypeId: m.micDeviceTypeId } : {}),
        label,
        ...(type?.template.category ? { category: type.template.category } : {}),
        quantity: 1,
        herkunft: DRUM,
      })
    }
    for (const row of deriveDrumBom(drum)) {
      // Die Mic-Zeilen stehen oben schon — hier nur das Zubehoer, sonst
      // zaehlte jedes Mikrofon doppelt.
      if (row.kind === 'mic') continue
      roh.push({ label: row.item, quantity: row.qty, herkunft: DRUM })
    }
  }

  // ── Funkstrecken ──────────────────────────────────────────────────────────
  // Ein Kanal ist ein Sender-Body PLUS eine Kapsel/ein Headset. Beide sind
  // eigene Artikel im Lager und zaehlen einzeln.
  for (const c of plan.wirelessRig?.channels ?? []) {
    for (const id of [c.bodyDeviceTypeId, c.micDeviceTypeId]) {
      if (!id) continue
      const type = resolveDeviceType(id)
      const label = type?.template.name?.trim()
      if (!label) continue
      roh.push({
        deviceTypeId: id,
        label,
        ...(type?.template.category ? { category: type.template.category } : {}),
        quantity: 1,
        herkunft: FUNK,
      })
    }
  }

  // ── Kabel ─────────────────────────────────────────────────────────────────
  // Gebuendelt wie in `buildCableBomRows`: nach Typ UND Laenge, denn ein
  // 5-m-SDI und ein 50-m-SDI sind im Lager zwei Artikel. Ein Multicore zaehlt
  // je Buendel einmal — sonst kommissioniert das Lager sechzehn Kabel fuer
  // eine Trommel.
  const gezaehlteBuendel = new Set<string>()
  for (const c of plan.cables ?? []) {
    // Funkstrecken sind keine Kabel. Sie stehen als Geraete im Plan.
    if (c.wireless) continue
    if (c.multicoreName) {
      if (gezaehlteBuendel.has(c.multicoreName)) continue
      gezaehlteBuendel.add(c.multicoreName)
    }
    const laenge = c.length ?? 0
    roh.push({
      label: laenge > 0 ? `${c.type} ${laenge} m` : c.type,
      quantity: 1,
      herkunft: KABEL,
    })
  }

  // ── Adapter ───────────────────────────────────────────────────────────────
  // Der Plan WEISS, dass er welche braucht -- er sagt es an zwei Stellen --
  // und bis hierher blieb diese Erkenntnis im Zeichnungs-Befund stehen, statt
  // Material zu werden. Ein Adapter, den niemand einpackt, ist am Aufbautag
  // dasselbe wie ein fehlendes Kabel.
  const portById = new Map<string, Port>()
  for (const e of plan.equipment ?? []) {
    for (const p of [...(e.inputs ?? []), ...(e.outputs ?? [])]) portById.set(p.id, p)
  }
  for (const c of plan.cables ?? []) {
    if (c.wireless) continue
    const von = portById.get(c.fromPortId)
    const nach = portById.get(c.toPortId)

    // (1) Optischer Steckertyp ungleich -- dieselbe Bedingung wie Check 17b in
    //     `drawingChecks`. Der Adapter wird BENANNT: „LWL-Adapter LC ↔ SC" ist
    //     kommissionierbar, „Adapter" ist es nicht.
    const a = von?.fiberConnector
    const b = nach?.fiberConnector
    if (a && b && a !== b) {
      roh.push({ label: `LWL-Adapter ${a} ↔ ${b}`, quantity: 1, herkunft: ADAPTER })
      continue
    }

    // (2) Das ausdrueckliche Haekchen am Kabel. Es kommt NACH der optischen
    //     Pruefung, damit ein Link nicht zweimal zaehlt: dasselbe Kabel traegt
    //     beides oft gleichzeitig.
    if (c.needsConverter) {
      const vonTyp = von?.connectorType
      const nachTyp = nach?.connectorType
      roh.push({
        // Wo die Stecker bekannt sind, steht der Adapter mit ihnen da. Wo
        // nicht, bleibt die Zeile allgemein -- eine erfundene Steckerpaarung
        // waere schlimmer als eine unbestimmte Zeile, weil sie bestellbar
        // aussieht.
        label:
          vonTyp && nachTyp && vonTyp !== nachTyp
            ? `Adapter ${vonTyp} ↔ ${nachTyp}`
            : `Adapter für „${c.name || c.type}"`,
        quantity: 1,
        herkunft: ADAPTER,
      })
    }
  }

  return zusammen(roh)
}
