import { collectColorKeyEntries, layoutColorKey } from "../colorKeyLayout";
import type { LineStyle, ConnectionEdge, SignalType } from "../types";
import type { DxfWriter, EntityStyle } from "./writer";
import { CANONICAL_LAYERS, hexToTrueColor, lineStyleToLtype } from "./layers";
import { cssFontPxToDxfHeight, rgbToTrueColor } from "./units";

/**
 * Emit the signal color key / legend near the drawing extents.
 * The layer EasySchematic-Legend can be frozen if the user prefers their own.
 *
 * All coordinates in inches.
 */
export function emitLegend(
  writer: DxfWriter,
  edges: ConnectionEdge[],
  signalColors: Partial<Record<SignalType, string>> | undefined,
  signalLineStyles: Partial<Record<SignalType, LineStyle>> | undefined,
  overrides: Partial<Record<SignalType, boolean>> | undefined,
  extMin: { x: number; y: number },
  extMax: { x: number; y: number },
  columns = 2,
) {
  const entries = collectColorKeyEntries(edges, signalColors, signalLineStyles, overrides);
  if (entries.length === 0) return;

  // Inch-based cell layout (tuned to look good in CAD)
  const cellW = 1.2;
  const cellH = 0.2;
  const padding = 0.08;
  const headerH = 0.2;

  const geometry = layoutColorKey(entries, columns, cellW, cellH, padding, headerH);

  // Position legend at top-left of extents (just above extMax.y, left-aligned)
  const legendX = extMin.x;
  const legendTop = extMax.y + 0.25;
  const legendBottom = legendTop - geometry.height;

  const borderStyle: EntityStyle = { trueColor: rgbToTrueColor(0, 0, 0) };
  const layer = CANONICAL_LAYERS.LEGEND;

  // Background fill (white)
  writer.addSolidHatchRect(
    layer,
    legendX, legendBottom, geometry.width, geometry.height,
    { trueColor: rgbToTrueColor(255, 255, 255) },
  );

  // Border
  writer.addRect(layer, legendX, legendBottom, geometry.width, geometry.height, borderStyle);

  // Header
  const headerY = legendTop - padding - headerH * 0.65;
  writer.addText(
    layer,
    legendX + padding,
    headerY,
    "SIGNAL KEY",
    {
      height: cssFontPxToDxfHeight(9),
      align: "left",
      style: { trueColor: rgbToTrueColor(0, 0, 0) },
    },
  );

  // Entries
  const swatchW = 0.25;
  const swatchGap = 0.08;
  for (const pe of geometry.entries) {
    // `pe.x` and `pe.y` are in the legend's local coordinate system
    // (layoutColorKey uses top-down padding-inclusive coords).
    const entryX = legendX + pe.x;
    const entryY = legendTop - pe.y - cellH * 0.5; // center vertically in cell

    const trueColor = hexToTrueColor(pe.entry.color);
    const lt = lineStyleToLtype(pe.entry.lineStyle);
    const swatchStyle: EntityStyle = {
      trueColor,
      linetype: lt,
      lineWeight: 30,
    };

    // Color swatch — a short line
    writer.addLine(
      layer,
      entryX, entryY,
      entryX + swatchW, entryY,
      swatchStyle,
    );

    // Label
    writer.addText(
      layer,
      entryX + swatchW + swatchGap,
      entryY - 0.04,
      pe.entry.label,
      {
        height: cssFontPxToDxfHeight(8),
        align: "left",
        style: { trueColor: rgbToTrueColor(0, 0, 0) },
      },
    );
  }
}
