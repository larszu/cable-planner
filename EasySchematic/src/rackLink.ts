import type { RackData, RackDevicePlacement, SchematicNode, DeviceData } from "./types";
import { inferRackHeightU } from "./rackUtils";

export function getDevicesInRoom(roomId: string, nodes: SchematicNode[]): SchematicNode[] {
  return nodes.filter((n) => n.type === "device" && n.parentId === roomId);
}

export interface ProposalResult {
  placements: Omit<RackDevicePlacement, "id">[];
  skipped: SchematicNode[];
}

export function proposeRackPlacements(
  rack: RackData,
  roomDevices: SchematicNode[],
  existingPlacements: RackDevicePlacement[],
): ProposalResult {
  const placedDeviceIds = new Set(existingPlacements.map((p) => p.deviceNodeId));
  const occupiedSlots = new Set<number>();
  for (const p of existingPlacements) {
    if (p.rackId !== rack.id || p.face !== "front" || p.mountedOnShelfId) continue;
    const data = roomDevices.find((n) => n.id === p.deviceNodeId)?.data as DeviceData | undefined;
    const hU = data ? inferRackHeightU(data) : 1;
    for (let u = p.uPosition; u < p.uPosition + hU; u++) occupiedSlots.add(u);
  }

  const sorted = [...roomDevices]
    .filter((n) => {
      const d = n.data as DeviceData;
      return d.deviceType !== "adapter" && !placedDeviceIds.has(n.id);
    })
    .sort((a, b) => ((a.data as DeviceData).label ?? "").localeCompare((b.data as DeviceData).label ?? ""));

  const placements: Omit<RackDevicePlacement, "id">[] = [];
  const skipped: SchematicNode[] = [];
  let uCursor = 1;

  for (const node of sorted) {
    const data = node.data as DeviceData;
    if (data.heightMm == null) {
      skipped.push(node);
      continue;
    }
    const hU = inferRackHeightU(data);
    // Find the next available span of hU units starting at uCursor
    let start = uCursor;
    while (start + hU - 1 <= rack.heightU) {
      let fits = true;
      for (let u = start; u < start + hU; u++) {
        if (occupiedSlots.has(u)) { fits = false; break; }
      }
      if (fits) break;
      start++;
    }
    if (start + hU - 1 > rack.heightU) {
      skipped.push(node);
      continue;
    }
    for (let u = start; u < start + hU; u++) occupiedSlots.add(u);
    placements.push({ rackId: rack.id, deviceNodeId: node.id, uPosition: start, face: "front" });
    uCursor = start + hU;
  }

  return { placements, skipped };
}
