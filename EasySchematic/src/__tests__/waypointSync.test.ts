import { describe, it, expect } from "vitest";
import { syncEdgesFromWaypointNodes } from "../waypointSync";
import type { ConnectionEdge, SchematicNode } from "../types";

const edge = (id: string, manual?: { x: number; y: number }[]): ConnectionEdge =>
  ({
    id,
    source: "src",
    target: "tgt",
    sourceHandle: "a",
    targetHandle: "b",
    type: "offset",
    data: {
      signalType: "sdi",
      ...(manual ? { manualWaypoints: manual } : {}),
    },
  }) as ConnectionEdge;

const wp = (id: string, edgeId: string, index: number, x: number, y: number, parentId?: string): SchematicNode =>
  ({
    id,
    type: "waypoint",
    position: { x, y },
    data: { edgeId, index },
    ...(parentId ? { parentId } : {}),
  }) as SchematicNode;

const room = (id: string, x: number, y: number): SchematicNode =>
  ({
    id,
    type: "room",
    position: { x, y },
    data: { label: "", width: 500, height: 500 },
  }) as unknown as SchematicNode;

describe("syncEdgesFromWaypointNodes", () => {
  it("writes absolute coords for a top-level waypoint (no parentId)", () => {
    const edges = [edge("e1")];
    const nodes = [wp("wp-e1-0", "e1", 0, 300, 200)];
    const result = syncEdgesFromWaypointNodes(edges, nodes);
    expect(result[0].data?.manualWaypoints).toEqual([{ x: 300, y: 200 }]);
  });

  it("walks parent chain so a reparented waypoint still writes absolute coords", () => {
    // Repro of the bug: room-4 at (4100, 180), waypoint reparented under it
    // with relative position (100, 140) — absolute is (4200, 320). The sync
    // must NOT write the bare (100, 140) into manualWaypoints.
    const edges = [edge("e1")];
    const nodes = [
      room("room-4", 4100, 180),
      wp("wp-e1-0", "e1", 0, 100, 140, "room-4"),
    ];
    const result = syncEdgesFromWaypointNodes(edges, nodes);
    expect(result[0].data?.manualWaypoints).toEqual([{ x: 4200, y: 320 }]);
  });

  it("handles nested parents (waypoint → room → outer-room)", () => {
    const edges = [edge("e1")];
    const nodes = [
      room("outer", 1000, 1000),
      { ...room("inner", 100, 200), parentId: "outer" } as SchematicNode,
      wp("wp-e1-0", "e1", 0, 50, 80, "inner"),
    ];
    const result = syncEdgesFromWaypointNodes(edges, nodes);
    // 1000+100+50 = 1150, 1000+200+80 = 1280
    expect(result[0].data?.manualWaypoints).toEqual([{ x: 1150, y: 1280 }]);
  });

  it("preserves existing edges array reference when nothing changed", () => {
    const edges = [edge("e1", [{ x: 300, y: 200 }])];
    const nodes = [wp("wp-e1-0", "e1", 0, 300, 200)];
    const result = syncEdgesFromWaypointNodes(edges, nodes);
    expect(result).toBe(edges);
  });

  it("sorts by index", () => {
    const edges = [edge("e1")];
    const nodes = [
      wp("wp-e1-1", "e1", 1, 200, 100),
      wp("wp-e1-0", "e1", 0, 100, 100),
    ];
    const result = syncEdgesFromWaypointNodes(edges, nodes);
    expect(result[0].data?.manualWaypoints).toEqual([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
  });
});
