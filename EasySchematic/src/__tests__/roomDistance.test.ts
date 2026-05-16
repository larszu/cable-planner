import { describe, it, expect } from "vitest";
import {
  pairKey,
  getTopLevelRoomId,
  isTopLevelRoom,
  listTopLevelRooms,
  getRoomDistance,
  computeCableLength,
  formatLength,
} from "../roomDistance";
import type { RoomData, SchematicNode } from "../types";

function makeRoom(id: string, label: string, parentId?: string): SchematicNode {
  return {
    id,
    type: "room",
    position: { x: 0, y: 0 },
    data: { label } as RoomData,
    ...(parentId ? { parentId } : {}),
  } as SchematicNode;
}

function makeDevice(id: string, parentId?: string): SchematicNode {
  return {
    id,
    type: "device",
    position: { x: 0, y: 0 },
    data: { label: "dev" } as unknown as RoomData,
    ...(parentId ? { parentId } : {}),
  } as SchematicNode;
}

describe("pairKey", () => {
  it("is symmetric regardless of argument order", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });

  it("produces a sorted 'a|b' key", () => {
    expect(pairKey("b", "a")).toBe("a|b");
    expect(pairKey("room-1", "room-2")).toBe("room-1|room-2");
  });

  it("distinguishes distinct pairs", () => {
    expect(pairKey("a", "b")).not.toBe(pairKey("a", "c"));
  });
});

describe("getTopLevelRoomId", () => {
  it("returns the id itself for a top-level room", () => {
    const nodes = [makeRoom("r1", "Room 1")];
    expect(getTopLevelRoomId("r1", nodes)).toBe("r1");
  });

  it("walks up a 3-deep nesting chain to the top-level ancestor", () => {
    const nodes = [
      makeRoom("top", "Top"),
      makeRoom("mid", "Mid", "top"),
      makeRoom("leaf", "Leaf", "mid"),
    ];
    expect(getTopLevelRoomId("leaf", nodes)).toBe("top");
    expect(getTopLevelRoomId("mid", nodes)).toBe("top");
    expect(getTopLevelRoomId("top", nodes)).toBe("top");
  });

  it("returns undefined when roomId is missing or not a room", () => {
    const nodes = [makeRoom("r1", "Room 1"), makeDevice("d1", "r1")];
    expect(getTopLevelRoomId(undefined, nodes)).toBeUndefined();
    expect(getTopLevelRoomId("does-not-exist", nodes)).toBeUndefined();
    expect(getTopLevelRoomId("d1", nodes)).toBeUndefined();
  });

  it("handles a cyclic parent chain without infinite looping", () => {
    const nodes = [
      makeRoom("a", "A", "b"),
      makeRoom("b", "B", "a"),
    ];
    const result = getTopLevelRoomId("a", nodes);
    expect(result === "a" || result === "b").toBe(true);
  });
});

describe("isTopLevelRoom", () => {
  it("returns true for a room with no parent", () => {
    const nodes = [makeRoom("r1", "Room 1")];
    expect(isTopLevelRoom("r1", nodes)).toBe(true);
  });

  it("returns false for a nested room", () => {
    const nodes = [makeRoom("top", "Top"), makeRoom("leaf", "Leaf", "top")];
    expect(isTopLevelRoom("leaf", nodes)).toBe(false);
  });

  it("returns false for a non-room id", () => {
    const nodes = [makeRoom("r1", "Room 1"), makeDevice("d1", "r1")];
    expect(isTopLevelRoom("d1", nodes)).toBe(false);
    expect(isTopLevelRoom("missing", nodes)).toBe(false);
  });
});

describe("listTopLevelRooms", () => {
  it("returns only top-level rooms with their labels", () => {
    const nodes = [
      makeRoom("a", "Room A"),
      makeRoom("b", "Room B"),
      makeRoom("a-child", "Child", "a"),
      makeDevice("d1"),
    ];
    const result = listTopLevelRooms(nodes);
    expect(result).toEqual([
      { id: "a", label: "Room A" },
      { id: "b", label: "Room B" },
    ]);
  });
});

describe("getRoomDistance", () => {
  const nodes = [
    makeRoom("a", "A"),
    makeRoom("b", "B"),
    makeRoom("a-leaf", "A Leaf", "a"),
  ];
  const file = { roomDistances: { [pairKey("a", "b")]: 50 } };

  it("resolves a direct top-level pair", () => {
    expect(getRoomDistance("a", "b", file, nodes)).toBe(50);
    expect(getRoomDistance("b", "a", file, nodes)).toBe(50);
  });

  it("resolves via a nested room's top-level ancestor", () => {
    expect(getRoomDistance("a-leaf", "b", file, nodes)).toBe(50);
  });

  it("returns undefined when both rooms share a top-level ancestor", () => {
    expect(getRoomDistance("a", "a-leaf", file, nodes)).toBeUndefined();
  });

  it("returns undefined when no entry is stored", () => {
    expect(getRoomDistance("a", "b", { roomDistances: {} }, nodes)).toBeUndefined();
    expect(getRoomDistance("a", "b", {}, nodes)).toBeUndefined();
  });
});

describe("computeCableLength", () => {
  it("applies percent slack and fixed addition", () => {
    expect(computeCableLength(100, { unit: "m", slackPercent: 15, slackFixed: 2 })).toBeCloseTo(117);
  });

  it("returns the raw distance when slack is zero", () => {
    expect(computeCableLength(42, { unit: "m", slackPercent: 0, slackFixed: 0 })).toBe(42);
  });

  it("treats non-finite slack values as zero", () => {
    expect(
      computeCableLength(10, { unit: "m", slackPercent: Number.NaN, slackFixed: Number.NaN }),
    ).toBe(10);
  });

  it("clamps negative results to zero", () => {
    expect(computeCableLength(1, { unit: "m", slackPercent: 0, slackFixed: -10 })).toBe(0);
  });
});

describe("formatLength", () => {
  it("formats with one decimal place and unit suffix", () => {
    expect(formatLength(117, "m")).toBe("117.0 m");
    expect(formatLength(42.5, "ft")).toBe("42.5 ft");
  });
});
