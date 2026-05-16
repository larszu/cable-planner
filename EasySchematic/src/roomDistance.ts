/**
 * Helpers for inter-room distance and estimated cable-length calculation (#146).
 *
 * Distances are stored pairwise on SchematicFile.roomDistances, keyed by a
 * canonical sorted "idA|idB" string so the lookup is symmetric. Devices in
 * nested subrooms inherit their top-level ancestor's distance.
 */

import type { DistanceSettings, RoomData, SchematicFile, SchematicNode } from "./types";

/** Canonical, sort-stable key for a symmetric pair of room IDs. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Walk the parentId chain upward from a room and return the top-level ancestor.
 * Returns the input ID unchanged if the room has no parent, or if the ID does
 * not correspond to a room node (defensive fallback).
 */
export function getTopLevelRoomId(
  roomId: string | undefined,
  nodes: SchematicNode[],
): string | undefined {
  if (!roomId) return undefined;
  let currentId: string | undefined = roomId;
  let lastRoomId: string | undefined = undefined;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const node = nodes.find((n) => n.id === currentId);
    if (!node || node.type !== "room") break;
    lastRoomId = currentId;
    currentId = node.parentId as string | undefined;
  }
  return lastRoomId;
}

/** True if the given room has no room-type ancestor — i.e. it's a top-level room. */
export function isTopLevelRoom(
  roomId: string,
  nodes: SchematicNode[],
): boolean {
  const node = nodes.find((n) => n.id === roomId);
  if (!node || node.type !== "room") return false;
  const parentId = node.parentId as string | undefined;
  if (!parentId) return true;
  const parent = nodes.find((n) => n.id === parentId);
  return !parent || parent.type !== "room";
}

/** List all top-level rooms in display order, returning [id, label] tuples. */
export function listTopLevelRooms(
  nodes: SchematicNode[],
): Array<{ id: string; label: string }> {
  return nodes
    .filter((n) => n.type === "room" && isTopLevelRoom(n.id, nodes))
    .map((n) => ({
      id: n.id,
      label: (n.data as RoomData).label || "Unnamed",
    }));
}

/**
 * Resolve the stored distance between two rooms. Accepts IDs for top-level or
 * nested rooms; nested rooms are walked up to their top-level ancestors before
 * the lookup. Returns undefined when either room is missing, the two resolve
 * to the same top-level room, or no distance has been set.
 */
export function getRoomDistance(
  fromRoomId: string | undefined,
  toRoomId: string | undefined,
  file: Pick<SchematicFile, "roomDistances">,
  nodes: SchematicNode[],
): number | undefined {
  const a = getTopLevelRoomId(fromRoomId, nodes);
  const b = getTopLevelRoomId(toRoomId, nodes);
  if (!a || !b || a === b) return undefined;
  return file.roomDistances?.[pairKey(a, b)];
}

/** distance × (1 + slack%/100) + slackFixed, clamped to non-negative. */
export function computeCableLength(
  distance: number,
  settings: DistanceSettings,
): number {
  const pct = Number.isFinite(settings.slackPercent) ? settings.slackPercent : 0;
  const fixed = Number.isFinite(settings.slackFixed) ? settings.slackFixed : 0;
  const value = distance * (1 + pct / 100) + fixed;
  return value < 0 ? 0 : value;
}

/** Format a length value for display, e.g. "117.0 m" or "42.5 ft". */
export function formatLength(value: number, unit: DistanceSettings["unit"]): string {
  return `${value.toFixed(1)} ${unit}`;
}
