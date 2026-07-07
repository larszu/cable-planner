// ───────────────────────────────────────────────────────────────────────────
// RF-Koordination — Frequenz-Konflikte für Funkstrecken (WWB-Prinzip).
//
// Prüft einen Satz belegter Frequenzen auf:
//  1. zu geringen Kanalabstand (Trägerabstand < Mindestabstand)
//  2. Intermodulation 3. Ordnung, 2 Sender:  2·f_i − f_j
//  3. Intermodulation 3. Ordnung, 3 Sender:  f_i + f_j − f_k
// Fällt ein Intermod-Produkt in ein Schutzband um eine belegte Frequenz, stört
// es dort. Rein + testbar; keine Hardware, kein Scan — nur Rechnung.
//
// Das ist bewusst die verbreitete „3rd-order IMD"-Grundkoordination (wie sie
// Tools wie Shure Wireless Workbench als Basis nutzen), nicht der volle
// hersteller­spezifische Kompatibilitäts-Algorithmus.
// ───────────────────────────────────────────────────────────────────────────

export interface RfFreq {
  id: string
  label: string
  mhz: number
}

export type RfConflictKind = 'spacing' | 'imd3-2tx' | 'imd3-3tx'

export interface RfConflict {
  kind: RfConflictKind
  /** Beteiligte Kanal-Ids (2 oder 3). */
  ids: string[]
  /** Menschlich lesbare Beschreibung. */
  message: string
  /** Bei Intermod: das störende Produkt (MHz) und die getroffene Frequenz. */
  productMhz?: number
  victimMhz?: number
}

export interface RfCoordinationOptions {
  /** Mindest-Trägerabstand zwischen zwei Kanälen (MHz). */
  minSpacingMhz: number
  /** Schutzband um eine belegte Frequenz für Intermod-Produkte (MHz). */
  imdGuardMhz: number
  /** 3-Sender-Intermod mitprüfen (rechenintensiver, O(n³)). */
  check3Tx: boolean
}

export const DEFAULT_RF_OPTIONS: RfCoordinationOptions = {
  minSpacingMhz: 0.4,
  imdGuardMhz: 0.3,
  check3Tx: true,
}

const round = (x: number): number => Math.round(x * 1000) / 1000

/**
 * Findet Frequenz-Konflikte in einer Kanalliste. Nur Kanäle mit gültiger
 * Frequenz (> 0) werden berücksichtigt. Ergebnis ist dedupliziert und stabil
 * sortiert (spacing zuerst, dann 2-Tx-, dann 3-Tx-Intermod).
 */
export const computeRfConflicts = (
  freqs: RfFreq[],
  opts: RfCoordinationOptions = DEFAULT_RF_OPTIONS,
): RfConflict[] => {
  const used = freqs.filter((f) => typeof f.mhz === 'number' && f.mhz > 0)
  const conflicts: RfConflict[] = []
  const seen = new Set<string>()
  const push = (c: RfConflict, key: string) => {
    if (seen.has(key)) return
    seen.add(key)
    conflicts.push(c)
  }

  // 1) Trägerabstand
  for (let i = 0; i < used.length; i++) {
    for (let j = i + 1; j < used.length; j++) {
      const d = Math.abs(used[i].mhz - used[j].mhz)
      if (d < opts.minSpacingMhz) {
        const key = `sp:${[used[i].id, used[j].id].sort().join('|')}`
        push(
          {
            kind: 'spacing',
            ids: [used[i].id, used[j].id],
            message: `${used[i].label} (${used[i].mhz}) ↔ ${used[j].label} (${used[j].mhz}): Abstand ${round(d)} MHz < ${opts.minSpacingMhz} MHz`,
          },
          key,
        )
      }
    }
  }

  // Opfer-Frequenzen als (mhz,id) — ein Intermod-Produkt „trifft", wenn es nahe
  // an einer belegten Frequenz liegt, die NICHT selbst Teil des Produkts ist.
  const near = (product: number, excludeIds: Set<string>): RfFreq | undefined =>
    used.find((v) => !excludeIds.has(v.id) && Math.abs(v.mhz - product) <= opts.imdGuardMhz)

  // 2) 3rd-order, 2 Sender: 2·f_i − f_j
  for (let i = 0; i < used.length; i++) {
    for (let j = 0; j < used.length; j++) {
      if (i === j) continue
      const product = 2 * used[i].mhz - used[j].mhz
      const victim = near(product, new Set([used[i].id, used[j].id]))
      if (victim) {
        const key = `i2:${[used[i].id, used[j].id].sort().join('|')}:${victim.id}`
        push(
          {
            kind: 'imd3-2tx',
            ids: [used[i].id, used[j].id, victim.id],
            productMhz: round(product),
            victimMhz: victim.mhz,
            message: `2·${used[i].label} − ${used[j].label} = ${round(product)} MHz trifft ${victim.label} (${victim.mhz})`,
          },
          key,
        )
      }
    }
  }

  // 3) 3rd-order, 3 Sender: f_i + f_j − f_k
  if (opts.check3Tx) {
    for (let i = 0; i < used.length; i++) {
      for (let j = i + 1; j < used.length; j++) {
        for (let k = 0; k < used.length; k++) {
          if (k === i || k === j) continue
          const product = used[i].mhz + used[j].mhz - used[k].mhz
          const victim = near(product, new Set([used[i].id, used[j].id, used[k].id]))
          if (victim) {
            const key = `i3:${[used[i].id, used[j].id, used[k].id].sort().join('|')}:${victim.id}`
            push(
              {
                kind: 'imd3-3tx',
                ids: [used[i].id, used[j].id, used[k].id, victim.id],
                productMhz: round(product),
                victimMhz: victim.mhz,
                message: `${used[i].label} + ${used[j].label} − ${used[k].label} = ${round(product)} MHz trifft ${victim.label} (${victim.mhz})`,
              },
              key,
            )
          }
        }
      }
    }
  }

  const rank: Record<RfConflictKind, number> = { spacing: 0, 'imd3-2tx': 1, 'imd3-3tx': 2 }
  conflicts.sort((a, b) => rank[a.kind] - rank[b.kind])
  return conflicts
}
