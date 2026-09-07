// ───────────────────────────────────────────────────────────────────────────
// ISSUE #663 — „Es fehlt die Fehlermeldung, dass Kabeltypen nicht
// zusammenpassen." (Rack-Planer)
//
// Der Signalplan hat diese Pruefung seit langem: `drawingChecks.ts`, Check 2,
// meldet ein Kabel zwischen zwei verschieden bestueckten Ports. Die
// Rack-INTERNE Verkabelung hatte sie nicht — und sie ist genau die, bei der
// man sich vertut: dort steckt man BNC an XLR, weil beide Ports in derselben
// Hoeheneinheit nebeneinanderliegen und die Beschriftung klein ist.
//
// ─── WARUM NICHT EINFACH `drawingChecks` AUFRUFEN ──────────────────────────
//
// Die Rack-interne Verkabelung ist kein `Cable[]` ueber `EquipmentItem[]`.
// Sie verbindet PLATZIERUNGEN ueber PORTNAMEN (`InternalCableDraft`), weil
// ein Rack-Preset eine Vorlage ist und noch keine Geraete im Plan hat. Ein
// Adapter, der Entwuerfe in Plan-Objekte uebersetzt, muesste Ids erfinden —
// und erfundene Ids sind die Sorte Zwischenschicht, die spaeter jemand fuer
// echte Daten haelt.
//
// Diese Datei prueft deshalb DIE ENTWURFSFORM direkt. Die Regel („zwei Ports
// mit verschiedenem Steckerbild passen nicht") ist dieselbe wie im Plan; sie
// steht hier ein zweites Mal, weil sie auf einer anderen Datenform arbeitet.
//
// ─── EIN PORT, DEN ES NICHT GIBT, IST DER TEURERE FEHLER ───────────────────
//
// Weil die Verbindung am NAMEN haengt, bricht sie still, wenn jemand den Port
// eines Geraets umbenennt: das Kabel bleibt im Preset stehen und zeigt auf
// nichts. Im Rack sieht man es nicht — dort ist eine Linie gezeichnet. Der
// Befund `port-unknown` ist deshalb ein FEHLER und keine Warnung.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate } from '../types/equipment'

/** Was diese Pruefung von einer Platzierung braucht. */
export interface WireCheckPlacement {
  id: string
  name: string
  inputs: EquipmentTemplate['inputs']
  outputs: EquipmentTemplate['outputs']
}

/** Was sie von einem Kabel braucht. */
export interface WireCheckCable {
  fromPlacementId: string
  fromPortName: string
  toPlacementId: string
  toPortName: string
  name?: string
  type?: string
}

export type RackWireFindingKind =
  /** Ein Kabel nennt einen Port, den das Geraet nicht hat. */
  | 'port-unknown'
  /** Ein Kabel nennt eine Platzierung, die es nicht gibt. */
  | 'placement-unknown'
  /** Die beiden Ports tragen verschiedene Steckerbilder. */
  | 'connector-mismatch'
  /** Beides Eingaenge oder beides Ausgaenge. */
  | 'direction-mismatch'

export const RACK_WIRE_FINDING_LABEL: Readonly<Record<RackWireFindingKind, string>> = {
  'port-unknown': 'Port gibt es an diesem Gerät nicht',
  'placement-unknown': 'Gerät steht nicht mehr im Rack',
  'connector-mismatch': 'Steckertypen passen nicht zusammen',
  'direction-mismatch': 'Zwei Eingänge oder zwei Ausgänge verbunden',
}

/** Fehler blockieren, Warnungen fallen auf. */
export const RACK_WIRE_FINDING_SEVERITY: Readonly<
  Record<RackWireFindingKind, 'error' | 'warning'>
> = {
  // Ein Kabel, das auf nichts zeigt, ist eine Linie ohne Verbindung — im
  // Rack sichtbar gezeichnet und trotzdem nicht vorhanden.
  'port-unknown': 'error',
  'placement-unknown': 'error',
  // Ein Steckerunterschied kann gewollt sein (Adapter im Kabel). Deshalb
  // Warnung: gemeldet, aber nicht behauptet, es sei falsch.
  'connector-mismatch': 'warning',
  'direction-mismatch': 'warning',
}

export interface RackWireFinding {
  kind: RackWireFindingKind
  severity: 'error' | 'warning'
  /** Die betroffene Kabel-Position in der Liste — der Sprung dorthin. */
  index: number
  /** Klartext fuer die Oberflaeche. */
  text: string
}

const portOf = (
  p: WireCheckPlacement,
  name: string,
): { connectorType?: string; direction: 'in' | 'out' } | undefined => {
  const ein = p.inputs?.find((x) => x.name === name)
  if (ein) return { connectorType: ein.connectorType, direction: 'in' }
  const aus = p.outputs?.find((x) => x.name === name)
  if (aus) return { connectorType: aus.connectorType, direction: 'out' }
  return undefined
}

/**
 * Was an der Rack-internen Verkabelung nicht aufgeht.
 *
 * `Custom` wird beim Steckervergleich UEBERSPRUNGEN — dieselbe Regel wie im
 * Signalplan: ein selbst benannter Stecker sagt nichts darueber, worauf er
 * passt, und eine Warnung ohne Grundlage bringt niemanden weiter.
 */
export const rackWireFindings = (
  placements: readonly WireCheckPlacement[],
  cables: readonly WireCheckCable[],
): RackWireFinding[] => {
  const byId = new Map(placements.map((p) => [p.id, p]))
  const out: RackWireFinding[] = []
  const melde = (kind: RackWireFindingKind, index: number, text: string) =>
    out.push({ kind, severity: RACK_WIRE_FINDING_SEVERITY[kind], index, text })

  cables.forEach((c, index) => {
    const kabel = c.name?.trim() || c.type?.trim() || `Kabel ${index + 1}`
    const von = byId.get(c.fromPlacementId)
    const nach = byId.get(c.toPlacementId)
    if (!von || !nach) {
      melde('placement-unknown', index, `${kabel}: ein verbundenes Gerät steht nicht mehr im Rack`)
      return
    }
    const pv = portOf(von, c.fromPortName)
    const pn = portOf(nach, c.toPortName)
    if (!pv) {
      melde('port-unknown', index, `${kabel}: „${c.fromPortName}" gibt es an ${von.name} nicht`)
    }
    if (!pn) {
      melde('port-unknown', index, `${kabel}: „${c.toPortName}" gibt es an ${nach.name} nicht`)
    }
    if (!pv || !pn) return

    if (pv.direction === pn.direction) {
      melde(
        'direction-mismatch',
        index,
        pv.direction === 'out'
          ? `${kabel}: ${von.name} und ${nach.name} sind beide Ausgänge`
          : `${kabel}: ${von.name} und ${nach.name} sind beide Eingänge`,
      )
    }

    const a = pv.connectorType
    const b = pn.connectorType
    if (!a || !b || a === 'Custom' || b === 'Custom') return
    if (a !== b) {
      melde(
        'connector-mismatch',
        index,
        `${kabel}: ${von.name} (${a}) → ${nach.name} (${b})`,
      )
    }
  })

  return out
}
