import type { LineStyle, SignalType } from "../types";
import { SIGNAL_LABELS } from "../types";
import { DEFAULT_SIGNAL_COLORS } from "../signalColors";
import type { LayerDef, LtypeDef } from "./writer";
import { hexToRgb, rgbToTrueColor, sanitizeName } from "./units";

/** Pick a crude ACI color code (0..255) from a 24-bit RGB triple.
 *  We also emit true-color (group 420) so this is just a fallback for readers
 *  that ignore 420. */
export function rgbToAci(r: number, g: number, b: number): number {
  // Very small palette-match: prefer the closest of the 9 standard ACI colors.
  // ACI 1..9 approximate colors (from AutoCAD):
  const ACI_PALETTE: [number, number, number, number][] = [
    [1, 255, 0, 0],     // red
    [2, 255, 255, 0],   // yellow
    [3, 0, 255, 0],     // green
    [4, 0, 255, 255],   // cyan
    [5, 0, 0, 255],     // blue
    [6, 255, 0, 255],   // magenta
    [7, 255, 255, 255], // white/black
    [8, 128, 128, 128], // dark gray
    [9, 192, 192, 192], // light gray
  ];
  let best = 7;
  let bestDist = Infinity;
  for (const [aci, ar, ag, ab] of ACI_PALETTE) {
    const dr = r - ar, dg = g - ag, db = b - ab;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      best = aci;
    }
  }
  return best;
}

export const CANONICAL_LAYERS = {
  DEFAULT: "0",
  ROOMS: "EasySchematic-Rooms",
  ROOMS_FILL: "EasySchematic-Rooms-Fill",
  DEVICES: "EasySchematic-Devices",
  DEVICES_HEADER: "EasySchematic-Devices-Header",
  LABELS: "EasySchematic-Labels",
  PORTS: "EasySchematic-Ports",
  ANNOTATIONS: "EasySchematic-Annotations",
  ANNOTATIONS_FILL: "EasySchematic-Annotations-Fill",
  TITLE_BLOCK: "EasySchematic-TitleBlock",
  LEGEND: "EasySchematic-Legend",
} as const;

export type LineStyleName = "CONTINUOUS" | "ES_DASHED" | "ES_DOTTED" | "ES_DASHDOT" | "ES_MISMATCH";

export function lineStyleToLtype(style: LineStyle | undefined): LineStyleName {
  switch (style) {
    case "dashed": return "ES_DASHED";
    case "dotted": return "ES_DOTTED";
    case "dash-dot": return "ES_DASHDOT";
    default: return "CONTINUOUS";
  }
}

/** LTYPE pattern definitions, lengths in inches. */
export const LTYPE_DEFS: LtypeDef[] = [
  { name: "CONTINUOUS", description: "Solid line", pattern: [] },
  { name: "ES_DASHED", description: "Dashed", pattern: [0.5, -0.25] },
  { name: "ES_DOTTED", description: "Dotted", pattern: [0, -0.2] },
  { name: "ES_DASHDOT", description: "Dash-Dot", pattern: [0.5, -0.25, 0, -0.25] },
  { name: "ES_MISMATCH", description: "Connector mismatch", pattern: [0.375, -0.1875] },
];

/** Layer name for a specific signal-type connection. */
export function signalLayerName(sig: SignalType): string {
  const sanitized = sanitizeName(sig);
  return `EasySchematic-Connections-${sanitized}`;
}

/**
 * Build the full layer list for a schematic, given the set of signal types
 * actually used plus an optional per-signal color override map.
 */
export function buildLayerDefs(
  usedSignalTypes: Set<SignalType>,
  signalColors: Partial<Record<SignalType, string>> | undefined,
): LayerDef[] {
  const layers: LayerDef[] = [
    { name: CANONICAL_LAYERS.DEFAULT, color: 7 },
    { name: CANONICAL_LAYERS.ROOMS, color: 9, linetype: "ES_DASHED" },
    { name: CANONICAL_LAYERS.ROOMS_FILL, color: 9 },
    { name: CANONICAL_LAYERS.DEVICES, color: 7 },
    { name: CANONICAL_LAYERS.DEVICES_HEADER, color: 8 },
    { name: CANONICAL_LAYERS.LABELS, color: 7 },
    { name: CANONICAL_LAYERS.PORTS, color: 8 },
    { name: CANONICAL_LAYERS.ANNOTATIONS, color: 7 },
    { name: CANONICAL_LAYERS.ANNOTATIONS_FILL, color: 9 },
    { name: CANONICAL_LAYERS.TITLE_BLOCK, color: 7 },
    { name: CANONICAL_LAYERS.LEGEND, color: 7 },
  ];

  for (const sig of usedSignalTypes) {
    const hex = signalColors?.[sig] ?? DEFAULT_SIGNAL_COLORS[sig];
    const [r, g, b] = hexToRgb(hex);
    layers.push({
      name: signalLayerName(sig),
      color: rgbToAci(r, g, b),
    });
  }

  return layers;
}

/** Resolve the effective color for a signal type (hex, e.g. "#dc2626"). */
export function resolveSignalColor(
  sig: SignalType,
  overrides: Partial<Record<SignalType, string>> | undefined,
): string {
  return overrides?.[sig] ?? DEFAULT_SIGNAL_COLORS[sig];
}

/** Human-readable name for a signal type, matching app conventions. */
export function signalLabel(sig: SignalType): string {
  return SIGNAL_LABELS[sig] ?? sig;
}

/** Convert a hex color to a DXF true-color integer (group 420). */
export function hexToTrueColor(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return rgbToTrueColor(r, g, b);
}
