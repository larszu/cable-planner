import type {
  DeviceData,
  RackAccessory,
  RackData,
  RackDevicePlacement,
} from "./types";
import {
  countUnknownDepthDevices,
  getRackDepthConflicts,
  inferRackHeightU,
} from "./rackUtils";
import { effectiveThermalBtuh } from "./thermal";

export interface RackStats {
  /** Total U capacity of the rack. */
  uTotal: number;
  /** Sum of occupied U slots — placements (excluding shelf-mounted) + accessories. */
  uUsed: number;
  /** Sum of weights in kg. Devices with no weightKg are skipped. */
  weightKg: number;
  /** Sum of power draw in watts. Devices with no powerDrawW are skipped. */
  powerW: number;
  /** Sum of thermal load in BTU/h. Uses thermalBtuh if set, otherwise derives from powerDrawW. */
  thermalBtuh: number;
  /** Largest single rear-overhang (front + rear depth − rack.depthMm) in mm. 0 if no overhang. */
  maxRearOverhangMm: number;
  /** Pairs of front/rear devices whose summed depth exceeds rack.depthMm. */
  conflictCount: number;
  /** Devices on the rack with no depthMm — caveats the conflict count. */
  unknownDepthCount: number;
  /** Devices with no weightKg — caveats the weight total. */
  unknownWeightCount: number;
  /** Devices with no powerDrawW — caveats power/thermal totals. */
  unknownPowerCount: number;
}

const EMPTY: RackStats = {
  uTotal: 0,
  uUsed: 0,
  weightKg: 0,
  powerW: 0,
  thermalBtuh: 0,
  maxRearOverhangMm: 0,
  conflictCount: 0,
  unknownDepthCount: 0,
  unknownWeightCount: 0,
  unknownPowerCount: 0,
};

export function computeRackStats(
  rack: RackData,
  placements: RackDevicePlacement[],
  accessories: RackAccessory[],
  deviceDataMap: Map<string, DeviceData>,
): RackStats {
  const stats: RackStats = { ...EMPTY, uTotal: rack.heightU };
  const usedUSlots = new Set<number>();

  for (const p of placements) {
    if (p.rackId !== rack.id) continue;
    const dd = deviceDataMap.get(p.deviceNodeId);
    if (!dd) continue;
    if (dd.weightKg != null) stats.weightKg += dd.weightKg;
    else stats.unknownWeightCount++;
    if (dd.powerDrawW != null) stats.powerW += dd.powerDrawW;
    else stats.unknownPowerCount++;
    const therm = effectiveThermalBtuh(dd);
    if (therm) stats.thermalBtuh += therm.value;
    if (!p.mountedOnShelfId) {
      const heightU = inferRackHeightU(dd);
      for (let u = p.uPosition; u < p.uPosition + heightU; u++) usedUSlots.add(u);
    }
  }

  for (const a of accessories) {
    if (a.rackId !== rack.id) continue;
    for (let u = a.uPosition; u < a.uPosition + a.heightU; u++) usedUSlots.add(u);
  }

  stats.uUsed = usedUSlots.size;

  const conflicts = getRackDepthConflicts(rack, placements, deviceDataMap);
  stats.conflictCount = conflicts.length;
  stats.maxRearOverhangMm = conflicts.reduce((m, c) => Math.max(m, c.depthOverhangMm), 0);
  stats.unknownDepthCount = countUnknownDepthDevices(rack, placements, deviceDataMap);

  return stats;
}

/** Sum stats across multiple racks (a page-level view). */
export function aggregateRackStats(perRack: RackStats[]): RackStats {
  const out: RackStats = { ...EMPTY };
  for (const s of perRack) {
    out.uTotal += s.uTotal;
    out.uUsed += s.uUsed;
    out.weightKg += s.weightKg;
    out.powerW += s.powerW;
    out.thermalBtuh += s.thermalBtuh;
    out.maxRearOverhangMm = Math.max(out.maxRearOverhangMm, s.maxRearOverhangMm);
    out.conflictCount += s.conflictCount;
    out.unknownDepthCount += s.unknownDepthCount;
    out.unknownWeightCount += s.unknownWeightCount;
    out.unknownPowerCount += s.unknownPowerCount;
  }
  return out;
}

/** Format a rack stats line into a compact display string. */
export function formatStatsLine(stats: RackStats): string {
  const parts: string[] = [`${stats.uTotal}U`, `${stats.uUsed}U used`];
  if (stats.weightKg > 0) {
    const lb = stats.weightKg * 2.20462;
    parts.push(`${stats.weightKg.toFixed(1)}kg / ${lb.toFixed(0)}lb`);
  }
  if (stats.powerW > 0) parts.push(`${Math.round(stats.powerW)}W`);
  if (stats.thermalBtuh > 0) parts.push(`${Math.round(stats.thermalBtuh)} BTU/h`);
  if (stats.conflictCount > 0) parts.push(`${stats.conflictCount} conflict${stats.conflictCount === 1 ? "" : "s"} ⚠`);
  return parts.join(" · ");
}
