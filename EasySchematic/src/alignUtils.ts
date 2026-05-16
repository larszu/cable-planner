import type { SchematicNode, DeviceData } from "./types";

export type AlignOperation =
  | "left"
  | "center-h"
  | "right"
  | "top"
  | "middle-v"
  | "bottom"
  | "distribute-h"
  | "distribute-v";

const DEFAULT_W = 180;
const DEFAULT_H = 60;
const GRID_SIZE = 20;

// Spacing constants (mirrored from snapUtils/pathfinding to avoid circular dep)
const STUB = 30;
const PAD = 20;
const ROUTING_GAP = 8;
const STUB_GAP = 6;

function rightPortCount(node: SchematicNode): number {
  if (node.type === "room") return 0;
  const ports = (node.data as DeviceData).ports ?? [];
  return ports.filter((p) => {
    if (p.direction === "bidirectional") return true;
    return (p.direction === "output") !== (p.flipped ?? false);
  }).length;
}

function leftPortCount(node: SchematicNode): number {
  if (node.type === "room") return 0;
  const ports = (node.data as DeviceData).ports ?? [];
  return ports.filter((p) => {
    if (p.direction === "bidirectional") return true;
    return (p.direction === "input") !== (p.flipped ?? false);
  }).length;
}

function maxSpread(portCount: number): number {
  return portCount <= 1 ? 0 : ((portCount - 1) / 2) * STUB_GAP;
}

function w(n: SchematicNode) {
  return n.measured?.width ?? DEFAULT_W;
}
function h(n: SchematicNode) {
  return n.measured?.height ?? DEFAULT_H;
}

/** Returns a map of nodeId → new position for nodes that moved. */
export function computeAlignment(
  nodes: SchematicNode[],
  op: AlignOperation,
): Map<string, { x: number; y: number }> {
  if (nodes.length < 2) return new Map();
  if ((op === "distribute-h" || op === "distribute-v") && nodes.length < 3)
    return new Map();

  const updates = new Map<string, { x: number; y: number }>();

  switch (op) {
    case "left": {
      const minX = Math.min(...nodes.map((n) => n.position.x));
      for (const n of nodes) {
        if (n.position.x !== minX)
          updates.set(n.id, { x: minX, y: n.position.y });
      }
      break;
    }
    case "center-h": {
      const minX = Math.min(...nodes.map((n) => n.position.x));
      const maxX = Math.max(...nodes.map((n) => n.position.x + w(n)));
      const centerX = (minX + maxX) / 2;
      for (const n of nodes) {
        const nx = centerX - w(n) / 2;
        if (n.position.x !== nx)
          updates.set(n.id, { x: nx, y: n.position.y });
      }
      break;
    }
    case "right": {
      const maxX = Math.max(...nodes.map((n) => n.position.x + w(n)));
      for (const n of nodes) {
        const nx = maxX - w(n);
        if (n.position.x !== nx)
          updates.set(n.id, { x: nx, y: n.position.y });
      }
      break;
    }
    case "top": {
      const minY = Math.min(...nodes.map((n) => n.position.y));
      for (const n of nodes) {
        if (n.position.y !== minY)
          updates.set(n.id, { x: n.position.x, y: minY });
      }
      break;
    }
    case "middle-v": {
      const minY = Math.min(...nodes.map((n) => n.position.y));
      const maxY = Math.max(...nodes.map((n) => n.position.y + h(n)));
      const centerY = (minY + maxY) / 2;
      for (const n of nodes) {
        const ny = centerY - h(n) / 2;
        if (n.position.y !== ny)
          updates.set(n.id, { x: n.position.x, y: ny });
      }
      break;
    }
    case "bottom": {
      const maxY = Math.max(...nodes.map((n) => n.position.y + h(n)));
      for (const n of nodes) {
        const ny = maxY - h(n);
        if (n.position.y !== ny)
          updates.set(n.id, { x: n.position.x, y: ny });
      }
      break;
    }
    case "distribute-h": {
      const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
      const totalWidth = sorted.reduce((sum, n) => sum + w(n), 0);
      const minX = sorted[0].position.x;
      const maxRight = sorted[sorted.length - 1].position.x + w(sorted[sorted.length - 1]);
      const gap = (maxRight - minX - totalWidth) / (sorted.length - 1);
      let x = minX;
      for (const n of sorted) {
        if (n.position.x !== x)
          updates.set(n.id, { x, y: n.position.y });
        x += w(n) + gap;
      }
      break;
    }
    case "distribute-v": {
      const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
      const totalHeight = sorted.reduce((sum, n) => sum + h(n), 0);
      const minY = sorted[0].position.y;
      const maxBottom = sorted[sorted.length - 1].position.y + h(sorted[sorted.length - 1]);
      const gap = (maxBottom - minY - totalHeight) / (sorted.length - 1);
      let y = minY;
      for (const n of sorted) {
        if (n.position.y !== y)
          updates.set(n.id, { x: n.position.x, y });
        y += h(n) + gap;
      }
      break;
    }
  }

  return updates;
}

function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

/** Minimum horizontal gap between two adjacent nodes (port-aware). */
function minHGap(left: SchematicNode, right: SchematicNode): number {
  return (
    STUB +
    PAD +
    ROUTING_GAP +
    Math.max(maxSpread(rightPortCount(left)), maxSpread(leftPortCount(right)))
  );
}

/**
 * After alignment, resolve overlaps among the selected nodes by spreading
 * them apart on the non-aligned (free) axis. The aligned axis is preserved
 * exactly. Positions are grid-snapped.
 */
export function resolveAlignmentOverlaps(
  nodes: SchematicNode[],
  positions: Map<string, { x: number; y: number }>,
  op: AlignOperation,
): Map<string, { x: number; y: number }> {
  if (nodes.length < 2) return positions;

  // Build effective post-alignment positions for every selected node
  type Entry = { node: SchematicNode; x: number; y: number };
  const entries: Entry[] = nodes.map((n) => {
    const pos = positions.get(n.id) ?? n.position;
    return { node: n, x: pos.x, y: pos.y };
  });

  // Determine which axis is free (can be adjusted to prevent overlap)
  const freeAxisX =
    op === "top" || op === "middle-v" || op === "bottom" || op === "distribute-v";
  const freeAxisY = !freeAxisX;

  // Handle distribute operations: enforce minimum gap on the distribution axis
  if (op === "distribute-h") {
    enforceDistributeMin(entries, "x", (a, b) => minHGap(a, b));
  } else if (op === "distribute-v") {
    enforceDistributeMin(entries, "y", () => GRID_SIZE);
  }

  // Sort by free axis position
  if (freeAxisY) {
    entries.sort((a, b) => a.y - b.y);
  } else {
    entries.sort((a, b) => a.x - b.x);
  }

  // Compute centroid on free axis before sweep
  const centroidBefore = freeAxisY
    ? entries.reduce((s, e) => s + e.y + h(e.node) / 2, 0) / entries.length
    : entries.reduce((s, e) => s + e.x + w(e.node) / 2, 0) / entries.length;

  // Sweep: push apart consecutive nodes that are too close
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];

    if (freeAxisY) {
      const minGap = GRID_SIZE;
      const requiredY = prev.y + h(prev.node) + minGap;
      if (curr.y < requiredY) {
        curr.y = requiredY;
      }
    } else {
      const gap = minHGap(prev.node, curr.node);
      const requiredX = prev.x + w(prev.node) + gap;
      if (curr.x < requiredX) {
        curr.x = requiredX;
      }
    }
  }

  // Re-center the group on the free axis to minimize total displacement
  const centroidAfter = freeAxisY
    ? entries.reduce((s, e) => s + e.y + h(e.node) / 2, 0) / entries.length
    : entries.reduce((s, e) => s + e.x + w(e.node) / 2, 0) / entries.length;

  const shift = centroidBefore - centroidAfter;
  if (shift !== 0) {
    for (const e of entries) {
      if (freeAxisY) e.y += shift;
      else e.x += shift;
    }
  }

  // Grid-snap all positions
  for (const e of entries) {
    e.x = snapToGrid(e.x);
    e.y = snapToGrid(e.y);
  }

  // Return only nodes whose position actually changed from their original
  const result = new Map<string, { x: number; y: number }>();
  for (const e of entries) {
    if (e.x !== e.node.position.x || e.y !== e.node.position.y) {
      result.set(e.node.id, { x: e.x, y: e.y });
    }
  }
  return result;
}

/**
 * For distribute operations, if the computed gap between consecutive nodes
 * is below the minimum, re-lay out from the first node using minimum gaps.
 */
function enforceDistributeMin(
  entries: { node: SchematicNode; x: number; y: number }[],
  axis: "x" | "y",
  minGapFn: (a: SchematicNode, b: SchematicNode) => number,
): void {
  const size = axis === "x" ? w : h;
  const sorted = [...entries].sort((a, b) => a[axis] - b[axis]);

  // Check if any consecutive gap is below minimum
  let needsFix = false;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i][axis] - (sorted[i - 1][axis] + size(sorted[i - 1].node));
    const min = minGapFn(sorted[i - 1].node, sorted[i].node);
    if (gap < min) {
      needsFix = true;
      break;
    }
  }
  if (!needsFix) return;

  // Re-lay out from the first node with minimum gaps
  let pos = sorted[0][axis];
  for (let i = 0; i < sorted.length; i++) {
    sorted[i][axis] = pos;
    if (i < sorted.length - 1) {
      pos += size(sorted[i].node) + minGapFn(sorted[i].node, sorted[i + 1].node);
    }
  }
}
