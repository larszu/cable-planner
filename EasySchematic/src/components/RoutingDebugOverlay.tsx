import { useViewport } from "@xyflow/react";
import { useSchematicStore } from "../store";
import { CELL_SIZE } from "../pathfinding";

/** Renders routing debug visuals (obstacles, penalty zones, edge paths) on the canvas.
 *  Only visible when debugEdges is enabled in the store. */
export default function RoutingDebugOverlay() {
  const debugData = useSchematicStore((s) => s.routingDebugData);
  const debugEdges = useSchematicStore((s) => s.debugEdges);
  const showObstacles = useSchematicStore((s) => s.debugShowObstacles);
  const showPenalties = useSchematicStore((s) => s.debugShowPenalties);
  const showWaypoints = useSchematicStore((s) => s.debugShowWaypoints);
  const showGrid = useSchematicStore((s) => s.debugShowGrid);
  const { x: vx, y: vy, zoom } = useViewport();

  if (!debugEdges || !debugData) return null;

  const { obstacles, penaltyZones, edges } = debugData as {
    obstacles: { left: number; top: number; right: number; bottom: number; nodeId?: string }[];
    penaltyZones: { axis: "h" | "v"; coordinate: number; rangeMin: number; rangeMax: number; signalType?: string }[];
    edges: Record<string, {
      source: { x: number; y: number; exitsRight: boolean };
      target: { x: number; y: number; entersLeft: boolean };
      signalType?: string;
      path: { x: number; y: number }[];
      turns: string;
      status: string;
    }>;
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <g transform={`translate(${vx}, ${vy}) scale(${zoom})`}>
          {/* A* pathfinding grid — intersections are the nodes A* traverses */}
          {showGrid && (() => {
            const rfEl = document.querySelector(".react-flow");
            if (!rfEl) return null;
            const rect = rfEl.getBoundingClientRect();
            const flowLeft = -vx / zoom;
            const flowTop = -vy / zoom;
            const flowRight = flowLeft + rect.width / zoom;
            const flowBottom = flowTop + rect.height / zoom;
            const startGX = Math.floor(flowLeft / CELL_SIZE);
            const startGY = Math.floor(flowTop / CELL_SIZE);
            const endGX = Math.ceil(flowRight / CELL_SIZE);
            const endGY = Math.ceil(flowBottom / CELL_SIZE);
            const cols = endGX - startGX;
            const rows = endGY - startGY;
            if (cols * rows > 10000) return null;

            // Build blocked intersection set from obstacle rects
            const blockedPoints = new Set<string>();
            if (obstacles) {
              for (const r of obstacles) {
                const gl = Math.floor(r.left / CELL_SIZE);
                const gt = Math.floor(r.top / CELL_SIZE);
                const gr = Math.ceil(r.right / CELL_SIZE);
                const gb = Math.ceil(r.bottom / CELL_SIZE);
                for (let gx = gl; gx <= gr; gx++) {
                  for (let gy = gt; gy <= gb; gy++) {
                    blockedPoints.add(`${gx},${gy}`);
                  }
                }
              }
            }

            // Draw grid lines
            const lines: React.JSX.Element[] = [];
            for (let gx = startGX; gx <= endGX; gx++) {
              const px = gx * CELL_SIZE;
              lines.push(
                <line key={`v${gx}`} x1={px} y1={startGY * CELL_SIZE} x2={px} y2={endGY * CELL_SIZE}
                  stroke="black" strokeWidth={0.5 / zoom} opacity={0.25} />
              );
            }
            for (let gy = startGY; gy <= endGY; gy++) {
              const py = gy * CELL_SIZE;
              lines.push(
                <line key={`h${gy}`} x1={startGX * CELL_SIZE} y1={py} x2={endGX * CELL_SIZE} y2={py}
                  stroke="black" strokeWidth={0.5 / zoom} opacity={0.25} />
              );
            }

            // Draw intersection points — blocked (red) vs free (black)
            const points: React.JSX.Element[] = [];
            for (let gx = startGX; gx <= endGX; gx++) {
              for (let gy = startGY; gy <= endGY; gy++) {
                const px = gx * CELL_SIZE;
                const py = gy * CELL_SIZE;
                const blocked = blockedPoints.has(`${gx},${gy}`);
                points.push(
                  <circle
                    key={`${gx},${gy}`}
                    cx={px} cy={py}
                    r={blocked ? 2.5 / zoom : 1.5 / zoom}
                    fill={blocked ? "#ff2222" : "black"}
                    opacity={blocked ? 0.8 : 0.5}
                  />
                );
              }
            }
            return <>{lines}{points}</>;
          })()}

          {/* Obstacle rects — device padding (pixel coordinates from buildObstacles) */}
          {showObstacles && obstacles?.filter((r) => !r.nodeId?.startsWith("turn-")).map((r, i) => (
            <rect
              key={`obs-${i}`}
              x={r.left} y={r.top}
              width={r.right - r.left} height={r.bottom - r.top}
              fill="rgba(255,0,0,0.06)" stroke="rgba(255,0,0,0.4)"
              strokeWidth={1 / zoom} strokeDasharray={`${3 / zoom},${3 / zoom}`}
            />
          ))}

          {/* Turn-point obstacles — X markers at blocked intersections */}
          {showObstacles && obstacles?.filter((r) => r.nodeId?.startsWith("turn-")).map((r, i) => {
            const s = 5 / zoom;
            return (
              <g key={`turn-${i}`}>
                <line x1={r.left - s} y1={r.top - s} x2={r.left + s} y2={r.top + s}
                  stroke="#ff44ff" strokeWidth={1.5 / zoom} />
                <line x1={r.left + s} y1={r.top - s} x2={r.left - s} y2={r.top + s}
                  stroke="#ff44ff" strokeWidth={1.5 / zoom} />
              </g>
            );
          })}

          {/* Penalty zones (grid coordinates — convert to pixels) */}
          {showPenalties && penaltyZones?.map((z, i) => {
            if (z.axis === "v") {
              // Vertical segment: x=coordinate, y from rangeMin to rangeMax
              const x = z.coordinate * CELL_SIZE;
              const y1 = z.rangeMin * CELL_SIZE;
              const y2 = z.rangeMax * CELL_SIZE;
              return (
                <line key={`pen-${i}`}
                  x1={x} y1={y1} x2={x} y2={y2}
                  stroke="rgba(255,165,0,0.5)" strokeWidth={Math.max(CELL_SIZE * 0.8, 4 / zoom)}
                  strokeLinecap="round"
                />
              );
            } else {
              // Horizontal segment
              const y = z.coordinate * CELL_SIZE;
              const x1 = z.rangeMin * CELL_SIZE;
              const x2 = z.rangeMax * CELL_SIZE;
              return (
                <line key={`pen-${i}`}
                  x1={x1} y1={y} x2={x2} y2={y}
                  stroke="rgba(255,165,0,0.5)" strokeWidth={Math.max(CELL_SIZE * 0.8, 4 / zoom)}
                  strokeLinecap="round"
                />
              );
            }
          })}

          {/* Edge debug paths with waypoint dots */}
          {edges && Object.entries(edges).map(([id, e]) => {
            if (!e.path || e.path.length < 2) return null;
            const d = e.path.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
            const color = e.status === "bad" ? "#ff4444" : "#44ff44";
            return (
              <g key={id}>
                <path d={d} fill="none" stroke={color} strokeWidth={2 / zoom} opacity={0.8} />
                {/* Source/target markers */}
                <circle cx={e.source.x} cy={e.source.y} r={4 / zoom} fill="#4488ff" stroke="white" strokeWidth={1 / zoom} />
                <circle cx={e.target.x} cy={e.target.y} r={4 / zoom} fill="#ff8844" stroke="white" strokeWidth={1 / zoom} />
                {/* Waypoint dots */}
                {showWaypoints && e.path.slice(1, -1).map((p, wi) => (
                  <circle key={wi} cx={p.x} cy={p.y} r={2.5 / zoom} fill={color} opacity={0.6} />
                ))}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
