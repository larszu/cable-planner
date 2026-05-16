import type { RackData, RackDevicePlacement, RackAccessory, DeviceData } from "../types";
import { RACK_ACCESSORY_LABELS } from "../types";
import { inferRackHeightU, shelfDepthMm, shelfInnerWidthMm, PX_PER_MM } from "../rackUtils";
import {
  PX_PER_U, RACK_WIDTH, RULER_WIDTH, RAIL_WIDTH, FULL_WIDTH, DEVICE_INSET, HALF_WIDTH,
  uToY, sideW, ACC_COLORS, wrapLabel,
} from "./rackFaceConstants";
import { resolveDeviceLabel, type SchematicDisplayDefaults } from "../displayName";

export interface RackFaceSVGProps {
  rack: RackData;
  placements: RackDevicePlacement[];
  accessories: RackAccessory[];
  deviceDataMap: Map<string, DeviceData>;
  face: "front" | "rear" | "side";
  widthPx: number;
  heightPx: number;
  /** Schematic-wide short-name + wrap defaults; per-device DeviceData fields override. */
  schematicDefaults?: SchematicDisplayDefaults;
}

/**
 * Static SVG rendering of a single rack face (front, rear, or side).
 * No interactive handlers — chrome (face label, stats, caveats) is the caller's
 * responsibility, positioned outside the returned SVG.
 *
 * Used by PrintSheetRenderer for print sheet viewports. RackRenderer keeps its
 * own composition for now; future consolidation can switch it to this component.
 */
export default function RackFaceSVG({
  rack,
  placements: rackPlacements,
  accessories: rackAccessories,
  deviceDataMap,
  face,
  widthPx,
  heightPx,
  schematicDefaults,
}: RackFaceSVGProps) {
  const defaults: SchematicDisplayDefaults = schematicDefaults ?? {};
  const totalH = rack.heightU * PX_PER_U;
  const is2Post = rack.rackType === "open-2post";
  const isOpen = is2Post || rack.rackType === "open-4post";

  if (face === "side") {
    const SW = sideW(rack.depthMm);
    const depthScale = PX_PER_MM;
    const vbX = -8;
    const vbY = -20;
    const vbW = SW + 16;
    const vbH = totalH + 24;

    return (
      <svg width={widthPx} height={heightPx} viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet">
        <text x={SW / 2} y={-8} textAnchor="middle" fontSize={12} fontWeight={600} fill="#333">{rack.label}</text>
        <rect x={0} y={0} width={SW} height={totalH}
          fill={isOpen ? "rgba(250,250,250,0.4)" : "#fafafa"} stroke="#333" strokeWidth={1}
          strokeDasharray={isOpen ? "4 2" : undefined} rx={1} />
        {Array.from({ length: rack.heightU }, (_, i) => (
          <line key={i} x1={0} y1={i * PX_PER_U} x2={SW} y2={i * PX_PER_U} stroke="#eee" strokeWidth={0.5} />
        ))}
        <line x1={4} y1={0} x2={4} y2={totalH} stroke="#aaa" strokeWidth={1} strokeDasharray="2 2" />
        <text x={4} y={-3} textAnchor="middle" fontSize={7} fill="#aaa">F</text>
        {!is2Post && (
          <>
            <line x1={SW - 4} y1={0} x2={SW - 4} y2={totalH} stroke="#aaa" strokeWidth={1} strokeDasharray="2 2" />
            <text x={SW - 4} y={-3} textAnchor="middle" fontSize={7} fill="#aaa">R</text>
          </>
        )}
        {rackAccessories.filter((a) => a.type === "shelf").map((a) => {
          const ay = uToY(a.uPosition + a.heightU - 1, rack.heightU);
          const ah = a.heightU * PX_PER_U - 1;
          const sd = shelfDepthMm(a, rack) * depthScale;
          const ax = (is2Post || a.face === "front") ? 4 : SW - 4 - sd;
          return <rect key={a.id} x={ax} y={ay + ah - 2} width={sd} height={2} fill="#a0855b" stroke="#7a6240" strokeWidth={0.5} />;
        })}
        {rackPlacements.map((pl) => {
          const dd = deviceDataMap.get(pl.deviceNodeId);
          if (!dd) return null;
          const heightU = inferRackHeightU(dd);
          if (pl.mountedOnShelfId) {
            const shelf = rackAccessories.find((a) => a.id === pl.mountedOnShelfId);
            if (!shelf) return null;
            const ay = uToY(shelf.uPosition + shelf.heightU - 1, rack.heightU);
            const ah = shelf.heightU * PX_PER_U - 1;
            const dDepth = (dd.depthMm ?? shelfDepthMm(shelf, rack)) * depthScale;
            const hMm = pl.rotated ? (dd.widthMm ?? 44.45) : (dd.heightMm ?? 44.45);
            const dh = hMm * PX_PER_MM;
            const surfaceY = ay + ah - 0.5;
            const dy = surfaceY - dh - (pl.shelfOffsetMm?.y ?? 0) * PX_PER_MM;
            const dx = (is2Post || shelf.face === "front") ? 4 : SW - 4 - dDepth;
            const resolved = resolveDeviceLabel(dd, defaults);
            const labelTrim = Math.max(3, Math.floor(dDepth / 5));
            const lbl = resolved.text.length > labelTrim ? resolved.text.slice(0, Math.max(1, labelTrim - 1)) + "…" : resolved.text;
            return (
              <g key={pl.id}>
                <rect x={dx} y={dy} width={dDepth} height={dh} fill={dd.headerColor ?? dd.color ?? "#4a90d9"} stroke="#333" strokeWidth={0.5} rx={1} opacity={0.85} />
                <text x={dx + dDepth / 2} y={dy + dh / 2} textAnchor="middle" dominantBaseline="central"
                  fontSize={Math.min(7, Math.max(4, dh * 0.5))} fill="#fff" style={{ pointerEvents: "none" }}>
                  {lbl}
                </text>
              </g>
            );
          }
          const y = uToY(pl.uPosition + heightU - 1, rack.heightU);
          const h = heightU * PX_PER_U - 1;
          const deviceDepth = (dd.depthMm ?? rack.depthMm * 0.6) * depthScale;
          const x = (is2Post || pl.face === "front") ? 4 : SW - 4 - deviceDepth;
          const resolved = resolveDeviceLabel(dd, defaults);
          const fs = h > 20 ? 8 : 7;
          const maxChars = Math.max(2, Math.floor(deviceDepth / (fs * 0.58)));
          const maxLines = resolved.wrap ? Math.max(1, Math.floor(h / (fs * 1.5))) : 1;
          const lines = wrapLabel(resolved.text, maxChars, Math.min(maxLines, 3));
          const lineH = fs * 1.35;
          const baseY = y + h / 2 - ((lines.length - 1) * lineH) / 2;
          const clipId = `rfsvg-side-clip-${rack.id}-${pl.id}`;
          return (
            <g key={pl.id}>
              <rect x={x} y={y} width={deviceDepth} height={h} fill={dd.headerColor ?? dd.color ?? "#4a90d9"} stroke="#333" strokeWidth={0.5} opacity={0.85} />
              <clipPath id={clipId}><rect x={x} y={y} width={deviceDepth} height={h} /></clipPath>
              <g clipPath={`url(#${clipId})`}>
                <text x={x + deviceDepth / 2} textAnchor="middle" fontSize={fs} fill="#fff" fontWeight={500} style={{ pointerEvents: "none" }}>
                  {lines.map((line, i) => (
                    <tspan key={i} x={x + deviceDepth / 2} y={baseY + i * lineH} dominantBaseline="central">{line}</tspan>
                  ))}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    );
  }

  // Front / rear view
  const showRails = !(is2Post && face === "rear");
  const activePlacements = rackPlacements.filter((p) => p.face === face && !p.mountedOnShelfId);
  const activeAccessories = rackAccessories.filter((a) => a.face === face);

  const vbX = -(RULER_WIDTH + 4);
  const vbY = -20;
  const vbW = RACK_WIDTH + RULER_WIDTH + 8;
  const vbH = totalH + 24;

  // Pattern id is unique per rack to allow multiple SVGs on the same page.
  const stripeId = `rfsvg-occ-stripes-${rack.id}`;
  // Opposite-face placements (drawn behind active content as "ghosts").
  const oppositePlacements = rackPlacements.filter((p) => p.face !== face && !p.mountedOnShelfId);

  return (
    <svg width={widthPx} height={heightPx} viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id={stripeId} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={6} stroke="rgba(0,0,0,0.08)" strokeWidth={2} />
        </pattern>
      </defs>

      <text x={RACK_WIDTH / 2} y={-8} textAnchor="middle" fontSize={12} fontWeight={600} fill="#333">{rack.label}</text>

      <rect x={0} y={0} width={RACK_WIDTH} height={totalH}
        fill={isOpen ? "rgba(245,245,245,0.4)" : "#f5f5f5"} stroke="#333"
        strokeWidth={isOpen ? 1 : 1.5} strokeDasharray={isOpen ? "4 2" : undefined} rx={2} />

      <rect x={0} y={0} width={RAIL_WIDTH} height={totalH} fill="#d4d4d4" stroke="#999" strokeWidth={0.5} />
      <rect x={RACK_WIDTH - RAIL_WIDTH} y={0} width={RAIL_WIDTH} height={totalH} fill="#d4d4d4" stroke="#999" strokeWidth={0.5} />

      {showRails && (
        <>
          <rect x={RAIL_WIDTH + 1} y={0} width={3} height={totalH} fill="#e0e0e0" stroke="#ccc" strokeWidth={0.25} />
          <rect x={RACK_WIDTH - RAIL_WIDTH - 4} y={0} width={3} height={totalH} fill="#e0e0e0" stroke="#ccc" strokeWidth={0.25} />
        </>
      )}

      {Array.from({ length: rack.heightU }, (_, i) => {
        const uNum = rack.heightU - i;
        const y = i * PX_PER_U;
        return (
          <g key={uNum}>
            <line x1={0} y1={y} x2={RACK_WIDTH} y2={y} stroke="#ddd" strokeWidth={0.5} />
            <text x={-RULER_WIDTH / 2 - 2} y={y + PX_PER_U / 2} textAnchor="middle" dominantBaseline="central" fontSize={8} fill="#999">{uNum}</text>
            {showRails && [1 / 6, 3 / 6, 5 / 6].map((frac, hi) => {
              const cy = y + PX_PER_U * frac;
              return (
                <g key={`h${hi}`}>
                  <circle cx={RAIL_WIDTH + 2.5} cy={cy} r={1.2} fill="#999" />
                  <circle cx={RACK_WIDTH - RAIL_WIDTH - 2.5} cy={cy} r={1.2} fill="#999" />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Opposite-face occupancy ghosts (drawn before accessories so active content overlaps them). */}
      {oppositePlacements.map((pl) => {
        const dd = deviceDataMap.get(pl.deviceNodeId);
        if (!dd) return null;
        const hU = inferRackHeightU(dd);
        const gy = uToY(pl.uPosition + hU - 1, rack.heightU);
        const gh = hU * PX_PER_U - 1;
        const gIsHalf = !!pl.halfRackSide;
        const gw = gIsHalf ? HALF_WIDTH : FULL_WIDTH;
        const gx = DEVICE_INSET + (gIsHalf && pl.halfRackSide === "right" ? HALF_WIDTH + 2 : 0);
        return (
          <rect
            key={`ghost-${pl.id}`}
            x={gx} y={gy} width={gw} height={gh}
            fill={`url(#${stripeId})`}
            stroke="#bbb" strokeWidth={0.5} strokeDasharray="3 2" rx={1}
          />
        );
      })}

      {activeAccessories.map((a) => {
        const ay = uToY(a.uPosition + a.heightU - 1, rack.heightU);
        const ah = a.heightU * PX_PER_U - 1;
        const fill = ACC_COLORS[a.type] ?? "#888";
        const isShelf = a.type === "shelf";
        const occupants = isShelf ? rackPlacements.filter((p) => p.mountedOnShelfId === a.id && p.face === face) : [];
        return (
          <g key={a.id}>
            <rect x={DEVICE_INSET} y={ay} width={FULL_WIDTH} height={ah} fill={fill} stroke="#555" strokeWidth={0.5} rx={1} />
            {a.type === "vent-panel" && Array.from({ length: Math.max(1, Math.floor(ah / 6)) }, (_, i) => (
              <line key={i} x1={DEVICE_INSET + 8} y1={ay + 3 + i * 6} x2={DEVICE_INSET + FULL_WIDTH - 8} y2={ay + 3 + i * 6} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
            ))}
            {!isShelf && (
              <text x={DEVICE_INSET + FULL_WIDTH / 2} y={ay + ah / 2} textAnchor="middle" dominantBaseline="central" fontSize={8} fill="rgba(255,255,255,0.8)" style={{ pointerEvents: "none" }}>
                {a.label ?? RACK_ACCESSORY_LABELS[a.type]}
              </text>
            )}
            {isShelf && (() => {
              const surfaceY = ay + ah - 0.5;
              const innerW = shelfInnerWidthMm();
              return occupants.map((p) => {
                const dd = deviceDataMap.get(p.deviceNodeId);
                if (!dd) return null;
                const wMm = p.rotated ? (dd.heightMm ?? 44.45) : (dd.widthMm ?? innerW);
                const hMm = p.rotated ? (dd.widthMm ?? innerW) : (dd.heightMm ?? 44.45);
                const wPx = wMm * PX_PER_MM;
                const hPx = hMm * PX_PER_MM;
                const offset = p.shelfOffsetMm ?? { x: 0, y: 0 };
                const xPx = DEVICE_INSET + offset.x * PX_PER_MM;
                const topY = surfaceY - hPx - offset.y * PX_PER_MM;
                const effectiveWidthPx = p.rotated ? hPx : wPx;
                const resolved = resolveDeviceLabel(dd, defaults);
                const labelTrim = Math.max(4, Math.floor(effectiveWidthPx / 5));
                const lbl = resolved.text.length > labelTrim ? resolved.text.slice(0, Math.max(1, labelTrim - 1)) + "…" : resolved.text;
                return (
                  <g key={p.id}>
                    <rect x={xPx} y={topY} width={wPx} height={hPx}
                      fill={dd.headerColor ?? dd.color ?? "#4a90d9"} stroke="#333" strokeWidth={0.5} rx={1} />
                    <text
                      x={xPx + wPx / 2} y={topY + hPx / 2}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize={Math.min(7, hPx * 0.4)} fill="#fff"
                      style={{ pointerEvents: "none" }}
                      transform={p.rotated ? `rotate(-90 ${xPx + wPx / 2} ${topY + hPx / 2})` : undefined}
                    >
                      {lbl}
                    </text>
                  </g>
                );
              });
            })()}
          </g>
        );
      })}

      {activePlacements.map((p) => {
        const dd = deviceDataMap.get(p.deviceNodeId);
        if (!dd) return null;
        const hU = inferRackHeightU(dd);
        const color = dd.headerColor ?? dd.color ?? "#4a90d9";
        const y = uToY(p.uPosition + hU - 1, rack.heightU);
        const h = hU * PX_PER_U - 1;
        const isHalf = !!p.halfRackSide;
        const w = isHalf ? HALF_WIDTH : FULL_WIDTH;
        const x = DEVICE_INSET + (isHalf && p.halfRackSide === "right" ? HALF_WIDTH + 2 : 0);
        const resolved = resolveDeviceLabel(dd, defaults);
        const fs = h > 20 ? 8 : 7;
        const maxChars = Math.min(isHalf ? 14 : 36, Math.floor(w / (fs * 0.58)));
        const maxLines = resolved.wrap ? Math.max(1, Math.floor(h / (fs * 1.5))) : 1;
        const lines = wrapLabel(resolved.text, maxChars, maxLines);
        const lineH = fs * 1.35;
        const baseY = y + h / 2 - ((lines.length - 1) * lineH) / 2;
        return (
          <g key={p.id}>
            <clipPath id={`rfsvg-clip-${p.id}`}><rect x={x} y={y} width={w} height={h} rx={1} /></clipPath>
            <rect x={x} y={y} width={w} height={h} fill={color} stroke="#333" strokeWidth={0.75} rx={1} />
            <g clipPath={`url(#rfsvg-clip-${p.id})`}>
              <text x={x + w / 2} textAnchor="middle" fontSize={fs} fill="#fff" fontWeight={600} style={{ pointerEvents: "none" }}>
                {lines.map((line, i) => (
                  <tspan key={i} x={x + w / 2} y={baseY + i * lineH} dominantBaseline="central">{line}</tspan>
                ))}
              </text>
              {hU > 1 && (
                <text x={x + w - 4} y={y + 8} textAnchor="end" fontSize={7} fill="rgba(255,255,255,0.7)" style={{ pointerEvents: "none" }}>{hU}U</text>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
