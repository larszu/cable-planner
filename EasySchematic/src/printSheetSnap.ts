/**
 * Alignment-snap helper for the print sheet canvas.
 *
 * Mirrors the spirit of src/snapUtils.ts (used on the main schematic) but
 * works in mm space, against PrintViewport rects + page margins/center.
 *
 * Supports:
 *  - drag snap: candidates are the 6 reference lines of the moving rect
 *    (left, right, centerX, top, bottom, centerY) snapped against the same
 *    lines on every other rect, plus page margins and page center.
 *  - resize snap (SE corner): candidates are the right edge and bottom edge
 *    of the moving rect.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetGuide {
  /** "v" — a vertical line, "h" — a horizontal line. */
  orientation: "v" | "h";
  /** Position in mm: x for vertical lines, y for horizontal lines. */
  posMm: number;
  /** Cross-axis extent in mm: y-range for vertical lines, x-range for horizontal. */
  fromMm: number;
  toMm: number;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  guides: SheetGuide[];
}

interface Candidate {
  /** Candidate snap position for the moving anchor. */
  posMm: number;
  /** Offset to apply to the moving rect's x (or y) to land on this position. */
  delta: number;
  /** The "other rect" that produced this candidate (for guide cross-axis range). */
  otherRect?: Rect;
  /** Whether this candidate is a page-edge or page-center line (no other rect). */
  pageLine?: "edge" | "center";
}

/** Proximity gating: only the K nearest rects (by bbox distance) become snap targets. */
const NEAREST_K_SHEET = 8;

function bboxDistance(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return Math.hypot(dx, dy);
}

function nearestRects(moving: Rect, others: Rect[], k: number): Rect[] {
  return others
    .map((r) => ({ r, d: bboxDistance(moving, r) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((x) => x.r);
}

/**
 * Compute snap during drag. Returns the snapped (x, y) for `movingRect`'s top-left
 * plus the visible guide lines.
 */
export function computeDragSnap(
  movingRect: Rect,
  otherRects: Rect[],
  pageWMm: number,
  pageHMm: number,
  marginMm: number,
  thresholdMm: number,
): SnapResult {
  const m = movingRect;
  // Anchors of the moving rect (x then y axis):
  const ax = { left: m.x, right: m.x + m.w, centerX: m.x + m.w / 2 };
  const ay = { top: m.y, bottom: m.y + m.h, centerY: m.y + m.h / 2 };

  // Build candidate target lines for x-axis: each other rect's left/right/centerX,
  // plus page margins and page center. Proximity-gated so a crowded sheet only
  // considers the closest neighbors instead of producing alignment noise.
  const xCands: Candidate[] = [];
  const yCands: Candidate[] = [];

  const nearby = nearestRects(movingRect, otherRects, NEAREST_K_SHEET);
  for (const other of nearby) {
    const ox = { left: other.x, right: other.x + other.w, centerX: other.x + other.w / 2 };
    const oy = { top: other.y, bottom: other.y + other.h, centerY: other.y + other.h / 2 };
    // x-axis matches: try every (movingAnchor, otherAnchor) pair on the x axis.
    for (const mAnchor of [ax.left, ax.right, ax.centerX] as const) {
      for (const oAnchor of [ox.left, ox.right, ox.centerX] as const) {
        const delta = oAnchor - mAnchor;
        if (Math.abs(delta) < thresholdMm) xCands.push({ posMm: oAnchor, delta, otherRect: other });
      }
    }
    for (const mAnchor of [ay.top, ay.bottom, ay.centerY] as const) {
      for (const oAnchor of [oy.top, oy.bottom, oy.centerY] as const) {
        const delta = oAnchor - mAnchor;
        if (Math.abs(delta) < thresholdMm) yCands.push({ posMm: oAnchor, delta, otherRect: other });
      }
    }
  }

  // Page lines
  const pageX = [marginMm, pageWMm - marginMm, pageWMm / 2];
  const pageY = [marginMm, pageHMm - marginMm, pageHMm / 2];
  const pageXKind: ("edge" | "center")[] = ["edge", "edge", "center"];
  const pageYKind: ("edge" | "center")[] = ["edge", "edge", "center"];
  for (let i = 0; i < pageX.length; i++) {
    for (const mAnchor of [ax.left, ax.right, ax.centerX] as const) {
      const delta = pageX[i] - mAnchor;
      if (Math.abs(delta) < thresholdMm) xCands.push({ posMm: pageX[i], delta, pageLine: pageXKind[i] });
    }
  }
  for (let i = 0; i < pageY.length; i++) {
    for (const mAnchor of [ay.top, ay.bottom, ay.centerY] as const) {
      const delta = pageY[i] - mAnchor;
      if (Math.abs(delta) < thresholdMm) yCands.push({ posMm: pageY[i], delta, pageLine: pageYKind[i] });
    }
  }

  // Pick the closest candidate per axis (smallest |delta|). Ties go to the first.
  const bestX = xCands.reduce<Candidate | null>((acc, c) => acc && Math.abs(acc.delta) <= Math.abs(c.delta) ? acc : c, null);
  const bestY = yCands.reduce<Candidate | null>((acc, c) => acc && Math.abs(acc.delta) <= Math.abs(c.delta) ? acc : c, null);

  const snappedX = m.x + (bestX?.delta ?? 0);
  const snappedY = m.y + (bestY?.delta ?? 0);

  // Build guides for every candidate that lands on the chosen snap position.
  // The snapped rect:
  const sm: Rect = { x: snappedX, y: snappedY, w: m.w, h: m.h };
  const guides: SheetGuide[] = [];

  if (bestX) {
    for (const c of xCands) {
      if (Math.abs(c.posMm - bestX.posMm) > 0.01) continue;
      // Vertical guide line at posMm. Span from min(top) to max(bottom) across the moving + other rect.
      let fromY = sm.y;
      let toY = sm.y + sm.h;
      if (c.otherRect) {
        fromY = Math.min(fromY, c.otherRect.y);
        toY = Math.max(toY, c.otherRect.y + c.otherRect.h);
      } else {
        // Page line: span the whole page vertically
        fromY = 0;
        toY = pageHMm;
      }
      guides.push({ orientation: "v", posMm: c.posMm, fromMm: fromY, toMm: toY });
    }
  }
  if (bestY) {
    for (const c of yCands) {
      if (Math.abs(c.posMm - bestY.posMm) > 0.01) continue;
      let fromX = sm.x;
      let toX = sm.x + sm.w;
      if (c.otherRect) {
        fromX = Math.min(fromX, c.otherRect.x);
        toX = Math.max(toX, c.otherRect.x + c.otherRect.w);
      } else {
        fromX = 0;
        toX = pageWMm;
      }
      guides.push({ orientation: "h", posMm: c.posMm, fromMm: fromX, toMm: toX });
    }
  }

  return { snappedX, snappedY, guides };
}

/**
 * Compute snap during resize (SE corner only). Snaps the moving rect's right edge
 * to other rects' left/right/centerX and the page margin/center; same for bottom.
 * Returns the snapped (w, h).
 */
export function computeResizeSnap(
  movingRect: Rect,
  otherRects: Rect[],
  pageWMm: number,
  pageHMm: number,
  marginMm: number,
  thresholdMm: number,
): { snappedW: number; snappedH: number; guides: SheetGuide[] } {
  const m = movingRect;
  const right = m.x + m.w;
  const bottom = m.y + m.h;

  const xTargets: Candidate[] = [];
  const yTargets: Candidate[] = [];

  const nearby = nearestRects(movingRect, otherRects, NEAREST_K_SHEET);
  for (const other of nearby) {
    const ox = [other.x, other.x + other.w, other.x + other.w / 2];
    const oy = [other.y, other.y + other.h, other.y + other.h / 2];
    for (const t of ox) {
      const delta = t - right;
      if (Math.abs(delta) < thresholdMm) xTargets.push({ posMm: t, delta, otherRect: other });
    }
    for (const t of oy) {
      const delta = t - bottom;
      if (Math.abs(delta) < thresholdMm) yTargets.push({ posMm: t, delta, otherRect: other });
    }
  }
  // Page lines
  for (const t of [marginMm, pageWMm - marginMm, pageWMm / 2]) {
    const delta = t - right;
    if (Math.abs(delta) < thresholdMm) xTargets.push({ posMm: t, delta, pageLine: "edge" });
  }
  for (const t of [marginMm, pageHMm - marginMm, pageHMm / 2]) {
    const delta = t - bottom;
    if (Math.abs(delta) < thresholdMm) yTargets.push({ posMm: t, delta, pageLine: "edge" });
  }

  const bestX = xTargets.reduce<Candidate | null>((acc, c) => acc && Math.abs(acc.delta) <= Math.abs(c.delta) ? acc : c, null);
  const bestY = yTargets.reduce<Candidate | null>((acc, c) => acc && Math.abs(acc.delta) <= Math.abs(c.delta) ? acc : c, null);

  const snappedW = Math.max(20, m.w + (bestX?.delta ?? 0));
  const snappedH = Math.max(20, m.h + (bestY?.delta ?? 0));

  const sm: Rect = { x: m.x, y: m.y, w: snappedW, h: snappedH };
  const guides: SheetGuide[] = [];
  if (bestX) {
    for (const c of xTargets) {
      if (Math.abs(c.posMm - bestX.posMm) > 0.01) continue;
      let fromY = sm.y, toY = sm.y + sm.h;
      if (c.otherRect) { fromY = Math.min(fromY, c.otherRect.y); toY = Math.max(toY, c.otherRect.y + c.otherRect.h); }
      else { fromY = 0; toY = pageHMm; }
      guides.push({ orientation: "v", posMm: c.posMm, fromMm: fromY, toMm: toY });
    }
  }
  if (bestY) {
    for (const c of yTargets) {
      if (Math.abs(c.posMm - bestY.posMm) > 0.01) continue;
      let fromX = sm.x, toX = sm.x + sm.w;
      if (c.otherRect) { fromX = Math.min(fromX, c.otherRect.x); toX = Math.max(toX, c.otherRect.x + c.otherRect.w); }
      else { fromX = 0; toX = pageWMm; }
      guides.push({ orientation: "h", posMm: c.posMm, fromMm: fromX, toMm: toX });
    }
  }

  return { snappedW, snappedH, guides };
}
