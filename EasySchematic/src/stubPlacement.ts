// Shared constants + helper for placing stub-label nodes. Used by:
//   - convertEdgeToStubs (store.ts) for newly stubbed connections
//   - migrateStubsToNodes (migrations.ts) for legacy schematics with no stub-end coords
//   - onNodeDrag/onNodeDragStop (App.tsx) to center-snap the box on the 20px grid
//   - StubLabelNode.tsx re-exports the constants for cohesion

export const STUB_GAP = 64;       // gap between device port and the stub box edge facing it
                                  // (large enough for a midpoint cable-ID badge to fit between)
export const STUB_W_EST = 80;     // estimated box width before React Flow has measured the DOM
export const STUB_H_EST = 14;     // estimated box height (9px line-height + 1.5×2 padding + 1×2 border)

/**
 * Place the stub box so the BOX EDGE facing the device is `STUB_GAP` from the
 * device port, and the box CENTER aligns with the port's Y. Returns the absolute
 * top-left position plus which side ("l"|"r") of the box is the connecting handle.
 */
export function defaultStubPlacement(
  handlePos: { x: number; y: number },
  portSide: "left" | "right",
): { pos: { x: number; y: number }; handle: "l" | "r" } {
  if (portSide === "right") {
    // Stub sits to the right of device; connecting handle is on the stub's LEFT side.
    return {
      pos: { x: handlePos.x + STUB_GAP, y: handlePos.y - STUB_H_EST / 2 },
      handle: "l",
    };
  }
  // Stub sits to the left of device; connecting handle is on the stub's RIGHT side.
  return {
    pos: { x: handlePos.x - STUB_GAP - STUB_W_EST, y: handlePos.y - STUB_H_EST / 2 },
    handle: "r",
  };
}
