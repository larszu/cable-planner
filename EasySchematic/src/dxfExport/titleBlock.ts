import type { TitleBlock, TitleBlockLayout } from "../types";
import { computeCellRects, getFieldValue, normalizeSizes } from "../titleBlockLayout";
import type { DxfWriter, EntityStyle } from "./writer";
import { hexToTrueColor, CANONICAL_LAYERS } from "./layers";
import { cssFontPxToDxfHeight, rgbToTrueColor } from "./units";

/**
 * Draw the schematic's title block as DXF geometry near the bottom-right
 * of the drawing extents. Users can freeze the EasySchematic-TitleBlock layer
 * in AutoCAD if they want to substitute their own.
 *
 * All input/output coordinates are in inches (DXF units).
 */
export function emitTitleBlock(
  writer: DxfWriter,
  tb: TitleBlock,
  layout: TitleBlockLayout,
  extMin: { x: number; y: number },
  extMax: { x: number; y: number },
) {
  const tbWidth = layout.widthIn;
  const tbHeight = layout.heightIn;
  // Place just above the extMin.y, right-aligned with extMax.x
  const tbLeft = extMax.x - tbWidth;
  const tbBottom = extMin.y - tbHeight - 0.25; // below extents
  const tbTop = tbBottom + tbHeight;

  const borderStyle: EntityStyle = { trueColor: rgbToTrueColor(100, 100, 100) };
  const layer = CANONICAL_LAYERS.TITLE_BLOCK;

  // Outer border
  writer.addRect(layer, tbLeft, tbBottom, tbWidth, tbHeight, borderStyle);

  // Interior grid lines — horizontal row dividers and vertical column dividers,
  // skipping merged-cell regions.
  const normCols = normalizeSizes(layout.columns);
  const normRows = normalizeSizes(layout.rows);
  const colStarts: number[] = [0];
  for (let i = 0; i < normCols.length; i++) colStarts.push(colStarts[i] + normCols[i]);
  const rowStarts: number[] = [0];
  for (let i = 0; i < normRows.length; i++) rowStarts.push(rowStarts[i] + normRows[i]);

  const skipH = new Set<string>();
  const skipV = new Set<string>();
  for (const cell of layout.cells) {
    for (let r = cell.row + 1; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        skipH.add(`${r},${c}`);
      }
    }
    for (let c = cell.col + 1; c < cell.col + cell.colSpan; c++) {
      for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
        skipV.add(`${c},${r}`);
      }
    }
  }

  // Horizontal grid lines
  for (let ri = 1; ri < layout.rows.length; ri++) {
    // DXF Y = tbTop - rowStarts[ri] * tbHeight  (title block is flipped: row 0 at top)
    const y = tbTop - rowStarts[ri] * tbHeight;
    let segStart: number | null = null;
    for (let c = 0; c < layout.columns.length; c++) {
      if (skipH.has(`${ri},${c}`)) {
        if (segStart !== null) {
          writer.addLine(
            layer,
            tbLeft + colStarts[segStart] * tbWidth, y,
            tbLeft + colStarts[c] * tbWidth, y,
            borderStyle,
          );
          segStart = null;
        }
      } else if (segStart === null) segStart = c;
    }
    if (segStart !== null) {
      writer.addLine(
        layer,
        tbLeft + colStarts[segStart] * tbWidth, y,
        tbLeft + tbWidth, y,
        borderStyle,
      );
    }
  }

  // Vertical grid lines
  for (let ci = 1; ci < layout.columns.length; ci++) {
    const x = tbLeft + colStarts[ci] * tbWidth;
    let segStart: number | null = null;
    for (let r = 0; r < layout.rows.length; r++) {
      if (skipV.has(`${ci},${r}`)) {
        if (segStart !== null) {
          writer.addLine(
            layer,
            x, tbTop - rowStarts[segStart] * tbHeight,
            x, tbTop - rowStarts[r] * tbHeight,
            borderStyle,
          );
          segStart = null;
        }
      } else if (segStart === null) segStart = r;
    }
    if (segStart !== null) {
      writer.addLine(
        layer,
        x, tbTop - rowStarts[segStart] * tbHeight,
        x, tbBottom,
        borderStyle,
      );
    }
  }

  // Cell contents
  const cellRects = computeCellRects(layout);
  for (const cell of layout.cells) {
    const rect = cellRects.get(cell.id);
    if (!rect) continue;
    const cellX = tbLeft + rect.x * tbWidth;
    const cellY = tbTop - (rect.y + rect.h) * tbHeight;
    const cellW = rect.w * tbWidth;
    const cellH = rect.h * tbHeight;

    let text: string;
    switch (cell.content.type) {
      case "field": {
        const value = getFieldValue(tb, cell.content.field);
        if (!value) continue;
        text = value;
        break;
      }
      case "static":
        text = cell.content.text;
        break;
      case "pageNumber":
        text = "";
        break;
      case "logo":
        continue; // Logos require raster — not emitted to DXF
    }

    if (!text) continue;

    const textStyle: EntityStyle = { trueColor: hexToTrueColor(cell.color) };
    // fontSize is in CSS px, so use the same cap-height conversion
    const heightIn = cssFontPxToDxfHeight(cell.fontSize);
    const pad = 0.03;

    let textX: number;
    let align: "left" | "center" | "right";
    if (cell.align === "center") {
      textX = cellX + cellW / 2;
      align = "center";
    } else if (cell.align === "right") {
      textX = cellX + cellW - pad;
      align = "right";
    } else {
      textX = cellX + pad;
      align = "left";
    }

    const textY = cellY + cellH / 2 - heightIn * 0.5;

    writer.addText(layer, textX, textY, text, {
      height: heightIn,
      align,
      style: textStyle,
    });
  }
}
