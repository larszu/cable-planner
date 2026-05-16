import { escapeForMText, escapeForText, fmt } from "./units";

/**
 * Hand-rolled AutoCAD 2000 (AC1015) DXF writer.
 *
 * R2000 requires per-entity handles (group 5), owner refs (group 330), and
 * AcDb* subclass markers (group 100). Everything that the reader validates
 * is produced here — miss a subclass marker and AutoCAD rejects the file.
 *
 * Handle allocation strategy:
 *   - Well-known fixed handles for tables, block records, blocks, dictionaries.
 *   - A counter (`nextHandle`) for everything else, starting well above the
 *     reserved range.
 */

// Fixed handles for the required tables / blocks / dictionaries.
// Values chosen to leave room for any future additions and to avoid collisions.
export const HANDLES = {
  // Tables
  TABLE_VPORT: "8",
  TABLE_LTYPE: "5",
  TABLE_LAYER: "2",
  TABLE_STYLE: "3",
  TABLE_VIEW: "6",
  TABLE_UCS: "7",
  TABLE_APPID: "9",
  TABLE_DIMSTYLE: "A",
  TABLE_BLOCK_RECORD: "1",

  // VPORT entry
  VPORT_ACTIVE: "2E",

  // LTYPE entries (pre-reserved)
  LTYPE_BYBLOCK: "14",
  LTYPE_BYLAYER: "15",
  LTYPE_CONTINUOUS: "16",
  LTYPE_DASHED: "17",
  LTYPE_DOTTED: "18",
  LTYPE_DASHDOT: "19",
  LTYPE_MISMATCH: "1A",

  // STYLE STANDARD
  STYLE_STANDARD: "11",

  // APPID ACAD
  APPID_ACAD: "12",

  // DIMSTYLE STANDARD
  DIMSTYLE_STANDARD: "27",

  // Block records
  BLOCK_RECORD_MODEL_SPACE: "1F",
  BLOCK_RECORD_PAPER_SPACE: "1B",

  // Blocks (their owning BLOCK_RECORD is listed above)
  BLOCK_MODEL_SPACE: "20",
  ENDBLK_MODEL_SPACE: "21",
  BLOCK_PAPER_SPACE: "1C",
  ENDBLK_PAPER_SPACE: "1D",

  // OBJECTS section — named object dictionary and its children
  DICT_NAMED: "C",
  DICT_ACAD_GROUP: "D",
  DICT_ACAD_MLINESTYLE: "E",
  DICT_ACAD_PLOTSTYLENAME: "F",
  PLOTSTYLE_NORMAL: "10",
};

// First handle assigned to entities. Must be greater than any well-known handle.
const ENTITY_HANDLE_START = 0x100;

export interface LayerDef {
  name: string;
  /** ACI color index (1..255). Use 7 (white/black) for default. */
  color: number;
  /** Linetype name. Must exist in LTYPE table. */
  linetype?: string;
}

export interface LtypeDef {
  name: string;
  description: string;
  /** Pattern lengths in inches: positive = dash on, negative = dash off, 0 = dot. */
  pattern: number[];
}

export interface TextStyle {
  /** Text height in inches (absolute). */
  height: number;
  /** ACI color — used when trueColor is not set. Omit for BYLAYER. */
  color?: number;
  /** 24-bit true color (group 420). Takes precedence over `color`. */
  trueColor?: number;
  /** MTEXT attachment point. 1=TL 2=TC 3=TR 4=ML 5=MC 6=MR 7=BL 8=BC 9=BR */
  attachment?: number;
  /** Rotation in degrees (CCW from +X axis). */
  rotationDeg?: number;
  /** Background fill color (ACI). When set, MTEXT gets a pill background. */
  backgroundAci?: number;
  /** Width factor for background fill (1.1 = 10% padding). */
  backgroundScale?: number;
}

export interface EntityStyle {
  /** ACI color (group 62). Defaults to BYLAYER (256). */
  aci?: number;
  /** 24-bit true color (group 420). Takes precedence over aci. */
  trueColor?: number;
  /** Linetype name. Defaults to BYLAYER. */
  linetype?: string;
  /** Line weight in 100ths of mm (group 370). -1 = BYLAYER. */
  lineWeight?: number;
}

export class DxfWriter {
  private lines: string[] = [];
  private handleCounter = ENTITY_HANDLE_START;
  private extMin = { x: 0, y: 0 };
  private extMax = { x: 1, y: 1 };

  /** Allocate a new hex handle for an entity. */
  allocHandle(): string {
    const h = this.handleCounter.toString(16).toUpperCase();
    this.handleCounter++;
    return h;
  }

  setExtents(min: { x: number; y: number }, max: { x: number; y: number }) {
    this.extMin = min;
    this.extMax = max;
  }

  private write(code: number, value: string) {
    this.lines.push(String(code));
    this.lines.push(value);
  }

  private i(code: number, value: number) {
    this.write(code, Math.trunc(value).toString());
  }

  private r(code: number, value: number) {
    this.write(code, fmt(value));
  }

  private s(code: number, value: string) {
    this.write(code, value);
  }

  // ─── Section scaffolding ─────────────────────────────────────────────

  private startSection(name: string) {
    this.s(0, "SECTION");
    this.s(2, name);
  }

  private endSection() {
    this.s(0, "ENDSEC");
  }

  // ─── HEADER ──────────────────────────────────────────────────────────

  writeHeader() {
    this.startSection("HEADER");
    this.s(9, "$ACADVER"); this.s(1, "AC1015");
    this.s(9, "$DWGCODEPAGE"); this.s(3, "ANSI_1252");
    this.s(9, "$INSBASE");
    this.r(10, 0); this.r(20, 0); this.r(30, 0);
    this.s(9, "$EXTMIN");
    this.r(10, this.extMin.x); this.r(20, this.extMin.y); this.r(30, 0);
    this.s(9, "$EXTMAX");
    this.r(10, this.extMax.x); this.r(20, this.extMax.y); this.r(30, 0);
    this.s(9, "$LIMMIN");
    this.r(10, this.extMin.x); this.r(20, this.extMin.y);
    this.s(9, "$LIMMAX");
    this.r(10, this.extMax.x); this.r(20, this.extMax.y);
    this.s(9, "$INSUNITS"); this.i(70, 1); // 1 = inches
    this.s(9, "$MEASUREMENT"); this.i(70, 0); // 0 = imperial
    this.s(9, "$LUNITS"); this.i(70, 2); // 2 = decimal
    this.s(9, "$AUPREC"); this.i(70, 4);
    this.s(9, "$LTSCALE"); this.r(40, 1);
    this.s(9, "$PSLTSCALE"); this.i(70, 0);
    this.s(9, "$CELTSCALE"); this.r(40, 1);
    this.s(9, "$CLAYER"); this.s(8, "0");
    this.s(9, "$CELTYPE"); this.s(6, "BYLAYER");
    this.s(9, "$CECOLOR"); this.i(62, 256);
    // $HANDSEED must be strictly greater than any allocated handle. Using a
    // large fixed value avoids the "handle already in use" error we'd get if
    // the seed collided with the first entity handle.
    this.s(9, "$HANDSEED"); this.s(5, "FFFFF");
    this.endSection();
  }

  // ─── CLASSES (empty but required) ────────────────────────────────────

  writeClasses() {
    this.startSection("CLASSES");
    this.endSection();
  }

  // ─── TABLES ──────────────────────────────────────────────────────────

  writeTables(layers: LayerDef[], ltypes: LtypeDef[]) {
    this.startSection("TABLES");

    this.writeVportTable();
    this.writeLtypeTable(ltypes);
    this.writeLayerTable(layers);
    this.writeStyleTable();
    this.writeViewTable();
    this.writeUcsTable();
    this.writeAppidTable();
    this.writeDimstyleTable();
    this.writeBlockRecordTable();

    this.endSection();
  }

  private writeVportTable() {
    this.s(0, "TABLE"); this.s(2, "VPORT");
    this.s(5, HANDLES.TABLE_VPORT);
    this.s(330, "0");
    this.s(100, "AcDbSymbolTable");
    this.i(70, 1);

    // *Active viewport fitted to extents
    const cx = (this.extMin.x + this.extMax.x) / 2;
    const cy = (this.extMin.y + this.extMax.y) / 2;
    const w = Math.max(1, this.extMax.x - this.extMin.x);
    const h = Math.max(1, this.extMax.y - this.extMin.y);
    const viewHeight = Math.max(w / 1.6, h) * 1.05; // fit with padding

    this.s(0, "VPORT");
    this.s(5, HANDLES.VPORT_ACTIVE);
    this.s(330, HANDLES.TABLE_VPORT);
    this.s(100, "AcDbSymbolTableRecord");
    this.s(100, "AcDbViewportTableRecord");
    this.s(2, "*Active");
    this.i(70, 0);
    this.r(10, 0); this.r(20, 0); // lower-left corner of viewport
    this.r(11, 1); this.r(21, 1); // upper-right corner
    this.r(12, cx); this.r(22, cy); // view center
    this.r(13, 0); this.r(23, 0); // snap base
    this.r(14, 0.5); this.r(24, 0.5); // snap spacing
    this.r(15, 0.5); this.r(25, 0.5); // grid spacing
    this.r(16, 0); this.r(26, 0); this.r(36, 1); // view direction
    this.r(17, 0); this.r(27, 0); this.r(37, 0); // view target
    this.r(40, viewHeight);
    this.r(41, w / h > 0 ? w / h : 1);
    this.r(42, 50); // lens length
    this.r(43, 0); // front clip
    this.r(44, 0); // back clip
    this.r(50, 0); // snap rotation
    this.r(51, 0); // view twist
    this.i(71, 0);
    this.i(72, 100);
    this.i(73, 1);
    this.i(74, 3);
    this.i(75, 0);
    this.i(76, 0);
    this.i(77, 0);
    this.i(78, 0);

    this.s(0, "ENDTAB");
  }

  private writeLtypeTable(ltypes: LtypeDef[]) {
    this.s(0, "TABLE"); this.s(2, "LTYPE");
    this.s(5, HANDLES.TABLE_LTYPE);
    this.s(330, "0");
    this.s(100, "AcDbSymbolTable");
    this.i(70, ltypes.length + 2); // +2 for BYBLOCK/BYLAYER

    // BYBLOCK
    this.s(0, "LTYPE"); this.s(5, HANDLES.LTYPE_BYBLOCK);
    this.s(330, HANDLES.TABLE_LTYPE);
    this.s(100, "AcDbSymbolTableRecord");
    this.s(100, "AcDbLinetypeTableRecord");
    this.s(2, "ByBlock"); this.i(70, 0);
    this.s(3, ""); this.i(72, 65); this.i(73, 0); this.r(40, 0);

    // BYLAYER
    this.s(0, "LTYPE"); this.s(5, HANDLES.LTYPE_BYLAYER);
    this.s(330, HANDLES.TABLE_LTYPE);
    this.s(100, "AcDbSymbolTableRecord");
    this.s(100, "AcDbLinetypeTableRecord");
    this.s(2, "ByLayer"); this.i(70, 0);
    this.s(3, ""); this.i(72, 65); this.i(73, 0); this.r(40, 0);

    // Custom + CONTINUOUS (all provided via ltypes array, including CONTINUOUS)
    for (const lt of ltypes) {
      const handle =
        lt.name === "CONTINUOUS" ? HANDLES.LTYPE_CONTINUOUS :
        lt.name === "ES_DASHED" ? HANDLES.LTYPE_DASHED :
        lt.name === "ES_DOTTED" ? HANDLES.LTYPE_DOTTED :
        lt.name === "ES_DASHDOT" ? HANDLES.LTYPE_DASHDOT :
        lt.name === "ES_MISMATCH" ? HANDLES.LTYPE_MISMATCH :
        this.allocHandle();
      this.s(0, "LTYPE"); this.s(5, handle);
      this.s(330, HANDLES.TABLE_LTYPE);
      this.s(100, "AcDbSymbolTableRecord");
      this.s(100, "AcDbLinetypeTableRecord");
      this.s(2, lt.name); this.i(70, 0);
      this.s(3, lt.description);
      this.i(72, 65);
      this.i(73, lt.pattern.length);
      const total = lt.pattern.reduce((sum, v) => sum + Math.abs(v), 0);
      this.r(40, total);
      for (const p of lt.pattern) {
        this.r(49, p);
        this.i(74, 0);
      }
    }

    this.s(0, "ENDTAB");
  }

  private writeLayerTable(layers: LayerDef[]) {
    this.s(0, "TABLE"); this.s(2, "LAYER");
    this.s(5, HANDLES.TABLE_LAYER);
    this.s(330, "0");
    this.s(100, "AcDbSymbolTable");
    this.i(70, layers.length);

    for (const layer of layers) {
      this.s(0, "LAYER"); this.s(5, this.allocHandle());
      this.s(330, HANDLES.TABLE_LAYER);
      this.s(100, "AcDbSymbolTableRecord");
      this.s(100, "AcDbLayerTableRecord");
      this.s(2, layer.name);
      this.i(70, 0);
      this.i(62, layer.color);
      this.s(6, layer.linetype ?? "CONTINUOUS");
      this.i(370, -3); // lineweight: BYLAYER
      this.s(390, HANDLES.PLOTSTYLE_NORMAL); // plot style name → Normal placeholder
    }

    this.s(0, "ENDTAB");
  }

  private writeStyleTable() {
    this.s(0, "TABLE"); this.s(2, "STYLE");
    this.s(5, HANDLES.TABLE_STYLE);
    this.s(330, "0");
    this.s(100, "AcDbSymbolTable");
    this.i(70, 1);

    this.s(0, "STYLE"); this.s(5, HANDLES.STYLE_STANDARD);
    this.s(330, HANDLES.TABLE_STYLE);
    this.s(100, "AcDbSymbolTableRecord");
    this.s(100, "AcDbTextStyleTableRecord");
    this.s(2, "STANDARD"); this.i(70, 0);
    this.r(40, 0); this.r(41, 1); this.r(50, 0);
    this.i(71, 0); this.r(42, 2.5);
    // Prefer Arial TTF (matches Inter's aspect ratio better than blocky
    // txt.shx). If unavailable, CAD silently falls back to default shape font.
    this.s(3, "arial.ttf"); this.s(4, "");

    this.s(0, "ENDTAB");
  }

  private writeViewTable() {
    this.s(0, "TABLE"); this.s(2, "VIEW");
    this.s(5, HANDLES.TABLE_VIEW);
    this.s(330, "0");
    this.s(100, "AcDbSymbolTable");
    this.i(70, 0);
    this.s(0, "ENDTAB");
  }

  private writeUcsTable() {
    this.s(0, "TABLE"); this.s(2, "UCS");
    this.s(5, HANDLES.TABLE_UCS);
    this.s(330, "0");
    this.s(100, "AcDbSymbolTable");
    this.i(70, 0);
    this.s(0, "ENDTAB");
  }

  private writeAppidTable() {
    this.s(0, "TABLE"); this.s(2, "APPID");
    this.s(5, HANDLES.TABLE_APPID);
    this.s(330, "0");
    this.s(100, "AcDbSymbolTable");
    this.i(70, 1);

    this.s(0, "APPID"); this.s(5, HANDLES.APPID_ACAD);
    this.s(330, HANDLES.TABLE_APPID);
    this.s(100, "AcDbSymbolTableRecord");
    this.s(100, "AcDbRegAppTableRecord");
    this.s(2, "ACAD"); this.i(70, 0);

    this.s(0, "ENDTAB");
  }

  private writeDimstyleTable() {
    this.s(0, "TABLE"); this.s(2, "DIMSTYLE");
    this.s(5, HANDLES.TABLE_DIMSTYLE);
    this.s(330, "0");
    this.s(100, "AcDbSymbolTable");
    this.s(100, "AcDbDimStyleTable");
    this.i(70, 1);

    this.s(0, "DIMSTYLE"); this.s(105, HANDLES.DIMSTYLE_STANDARD);
    this.s(330, HANDLES.TABLE_DIMSTYLE);
    this.s(100, "AcDbSymbolTableRecord");
    this.s(100, "AcDbDimStyleTableRecord");
    this.s(2, "STANDARD"); this.i(70, 0);

    this.s(0, "ENDTAB");
  }

  private writeBlockRecordTable() {
    this.s(0, "TABLE"); this.s(2, "BLOCK_RECORD");
    this.s(5, HANDLES.TABLE_BLOCK_RECORD);
    this.s(330, "0");
    this.s(100, "AcDbSymbolTable");
    this.i(70, 2);

    this.s(0, "BLOCK_RECORD"); this.s(5, HANDLES.BLOCK_RECORD_MODEL_SPACE);
    this.s(330, HANDLES.TABLE_BLOCK_RECORD);
    this.s(100, "AcDbSymbolTableRecord");
    this.s(100, "AcDbBlockTableRecord");
    this.s(2, "*Model_Space");
    this.i(70, 0); this.i(280, 1); this.i(281, 0);

    this.s(0, "BLOCK_RECORD"); this.s(5, HANDLES.BLOCK_RECORD_PAPER_SPACE);
    this.s(330, HANDLES.TABLE_BLOCK_RECORD);
    this.s(100, "AcDbSymbolTableRecord");
    this.s(100, "AcDbBlockTableRecord");
    this.s(2, "*Paper_Space");
    this.i(70, 0); this.i(280, 1); this.i(281, 0);

    this.s(0, "ENDTAB");
  }

  // ─── BLOCKS ──────────────────────────────────────────────────────────

  writeBlocks() {
    this.startSection("BLOCKS");

    // *Model_Space block (empty — entities live in ENTITIES section)
    this.s(0, "BLOCK"); this.s(5, HANDLES.BLOCK_MODEL_SPACE);
    this.s(330, HANDLES.BLOCK_RECORD_MODEL_SPACE);
    this.s(100, "AcDbEntity");
    this.s(8, "0");
    this.s(100, "AcDbBlockBegin");
    this.s(2, "*Model_Space"); this.i(70, 0);
    this.r(10, 0); this.r(20, 0); this.r(30, 0);
    this.s(3, "*Model_Space"); this.s(1, "");
    this.s(0, "ENDBLK"); this.s(5, HANDLES.ENDBLK_MODEL_SPACE);
    this.s(330, HANDLES.BLOCK_RECORD_MODEL_SPACE);
    this.s(100, "AcDbEntity"); this.s(8, "0");
    this.s(100, "AcDbBlockEnd");

    // *Paper_Space block (also empty)
    this.s(0, "BLOCK"); this.s(5, HANDLES.BLOCK_PAPER_SPACE);
    this.s(330, HANDLES.BLOCK_RECORD_PAPER_SPACE);
    this.s(100, "AcDbEntity");
    this.i(67, 1);
    this.s(8, "0");
    this.s(100, "AcDbBlockBegin");
    this.s(2, "*Paper_Space"); this.i(70, 0);
    this.r(10, 0); this.r(20, 0); this.r(30, 0);
    this.s(3, "*Paper_Space"); this.s(1, "");
    this.s(0, "ENDBLK"); this.s(5, HANDLES.ENDBLK_PAPER_SPACE);
    this.s(330, HANDLES.BLOCK_RECORD_PAPER_SPACE);
    this.s(100, "AcDbEntity");
    this.i(67, 1);
    this.s(8, "0");
    this.s(100, "AcDbBlockEnd");

    this.endSection();
  }

  // ─── ENTITIES ────────────────────────────────────────────────────────

  startEntities() {
    this.startSection("ENTITIES");
  }

  endEntities() {
    this.endSection();
  }

  private writeEntityPreamble(subclass: string, layer: string, style?: EntityStyle) {
    this.s(5, this.allocHandle());
    this.s(330, HANDLES.BLOCK_RECORD_MODEL_SPACE);
    this.s(100, "AcDbEntity");
    this.s(8, layer);
    if (style?.linetype) this.s(6, style.linetype);
    if (style?.aci !== undefined) this.i(62, style.aci);
    if (style?.lineWeight !== undefined) this.i(370, style.lineWeight);
    if (style?.trueColor !== undefined) this.i(420, style.trueColor);
    this.s(100, subclass);
  }

  addLine(layer: string, x1: number, y1: number, x2: number, y2: number, style?: EntityStyle) {
    this.s(0, "LINE");
    this.writeEntityPreamble("AcDbLine", layer, style);
    this.r(10, x1); this.r(20, y1); this.r(30, 0);
    this.r(11, x2); this.r(21, y2); this.r(31, 0);
  }

  /** Closed rectangle as an LWPOLYLINE (4 vertices, closed flag). */
  addRect(layer: string, x: number, y: number, w: number, h: number, style?: EntityStyle) {
    this.s(0, "LWPOLYLINE");
    this.writeEntityPreamble("AcDbPolyline", layer, style);
    this.i(90, 4);
    this.i(70, 1); // closed
    this.r(10, x); this.r(20, y);
    this.r(10, x + w); this.r(20, y);
    this.r(10, x + w); this.r(20, y + h);
    this.r(10, x); this.r(20, y + h);
  }

  /**
   * Rounded rectangle as a closed LWPOLYLINE with 8 vertices and bulged
   * corners. `radius` is the corner-fillet radius in the same units as x/y/w/h.
   * Bulge = tan(π/8) ≈ 0.4142 produces a 90° arc on each corner.
   */
  addRoundedRect(
    layer: string,
    x: number, y: number,
    w: number, h: number,
    radius: number,
    style?: EntityStyle,
  ) {
    const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    if (r === 0) { this.addRect(layer, x, y, w, h, style); return; }
    const b = Math.tan(Math.PI / 8); // ≈ 0.4142
    // CCW traversal: segments alternate straight (bulge 0) and arc (bulge b).
    // The bulge on vertex i applies to the segment from vertex i to vertex i+1.
    const pts: { x: number; y: number; bulge: number }[] = [
      { x: x + r,     y: y,         bulge: 0 }, // bottom edge
      { x: x + w - r, y: y,         bulge: b }, // bottom-right fillet
      { x: x + w,     y: y + r,     bulge: 0 }, // right edge
      { x: x + w,     y: y + h - r, bulge: b }, // top-right fillet
      { x: x + w - r, y: y + h,     bulge: 0 }, // top edge
      { x: x + r,     y: y + h,     bulge: b }, // top-left fillet
      { x: x,         y: y + h - r, bulge: 0 }, // left edge
      { x: x,         y: y + r,     bulge: b }, // bottom-left fillet
    ];
    this.s(0, "LWPOLYLINE");
    this.writeEntityPreamble("AcDbPolyline", layer, style);
    this.i(90, pts.length);
    this.i(70, 1); // closed
    for (const p of pts) {
      this.r(10, p.x); this.r(20, p.y);
      if (p.bulge !== 0) this.r(42, p.bulge);
    }
  }

  /** Open or closed LWPOLYLINE from a list of 2D points. */
  addPolyline(layer: string, points: { x: number; y: number }[], closed = false, style?: EntityStyle) {
    if (points.length < 2) return;
    this.s(0, "LWPOLYLINE");
    this.writeEntityPreamble("AcDbPolyline", layer, style);
    this.i(90, points.length);
    this.i(70, closed ? 1 : 0);
    for (const p of points) {
      this.r(10, p.x); this.r(20, p.y);
    }
  }

  /**
   * Add an ARC entity.
   * Angles are in degrees (CCW from +X axis). ARC is always drawn CCW from
   * startAngle to endAngle in DXF.
   */
  addArc(layer: string, cx: number, cy: number, radius: number, startDeg: number, endDeg: number, style?: EntityStyle) {
    this.s(0, "ARC");
    this.writeEntityPreamble("AcDbCircle", layer, style);
    this.r(10, cx); this.r(20, cy); this.r(30, 0);
    this.r(40, radius);
    this.s(100, "AcDbArc");
    this.r(50, startDeg);
    this.r(51, endDeg);
  }

  /** Add an ELLIPSE entity. */
  addEllipse(
    layer: string,
    cx: number, cy: number,
    majorX: number, majorY: number,
    ratio: number,
    style?: EntityStyle,
  ) {
    this.s(0, "ELLIPSE");
    this.writeEntityPreamble("AcDbEllipse", layer, style);
    this.r(10, cx); this.r(20, cy); this.r(30, 0);
    this.r(11, majorX); this.r(21, majorY); this.r(31, 0);
    this.r(210, 0); this.r(220, 0); this.r(230, 1); // extrusion
    this.r(40, ratio);
    this.r(41, 0);
    this.r(42, 2 * Math.PI);
  }

  /** Simple single-line TEXT entity. Height in inches. */
  addText(
    layer: string,
    x: number, y: number,
    text: string,
    opts: { height: number; align?: "left" | "center" | "right"; vAlign?: "baseline" | "bottom" | "middle" | "top"; rotationDeg?: number; style?: EntityStyle },
  ) {
    const align = opts.align ?? "left";
    const vAlign = opts.vAlign ?? "baseline";
    const hAlignCode = align === "left" ? 0 : align === "center" ? 1 : 2;
    const vAlignCode = vAlign === "baseline" ? 0 : vAlign === "bottom" ? 1 : vAlign === "middle" ? 2 : 3;

    this.s(0, "TEXT");
    this.writeEntityPreamble("AcDbText", layer, opts.style);
    this.r(10, x); this.r(20, y); this.r(30, 0);
    this.r(40, opts.height);
    this.s(1, escapeForText(text));
    if (opts.rotationDeg) this.r(50, opts.rotationDeg);
    this.s(7, "STANDARD");
    if (hAlignCode !== 0) this.i(72, hAlignCode);
    if (hAlignCode !== 0 || vAlignCode !== 0) {
      // Second alignment point — used when justification is non-default.
      this.r(11, x); this.r(21, y); this.r(31, 0);
    }
    this.s(100, "AcDbText");
    if (vAlignCode !== 0) this.i(73, vAlignCode);
  }

  /**
   * Multi-line / styled MTEXT entity. Height in inches.
   * Supports true-color, background fill, attachment-point alignment.
   */
  addMText(
    layer: string,
    x: number, y: number,
    text: string,
    opts: {
      height: number;
      widthBox?: number;
      attachment?: number; // 1..9, defaults to 1 (top-left)
      rotationDeg?: number;
      style?: EntityStyle;
      backgroundAci?: number;
      backgroundScale?: number;
    },
  ) {
    this.s(0, "MTEXT");
    this.writeEntityPreamble("AcDbMText", layer, opts.style);
    this.r(10, x); this.r(20, y); this.r(30, 0);
    this.r(40, opts.height);
    this.r(41, opts.widthBox ?? 0);
    this.i(71, opts.attachment ?? 1);
    this.i(72, 5); // drawing direction: by style
    const escaped = escapeForMText(text);
    // MTEXT content can be split across multiple 3 group codes (max 250 chars each) with
    // the final chunk on group 1. For our short labels, one group-1 line suffices.
    if (escaped.length > 250) {
      let idx = 0;
      while (idx + 250 < escaped.length) {
        this.s(3, escaped.substring(idx, idx + 250));
        idx += 250;
      }
      this.s(1, escaped.substring(idx));
    } else {
      this.s(1, escaped);
    }
    this.s(7, "STANDARD");
    if (opts.rotationDeg) this.r(50, opts.rotationDeg);
    if (opts.backgroundAci !== undefined) {
      this.i(90, 1); // background fill flag: use fill color
      this.i(63, opts.backgroundAci);
      this.r(45, opts.backgroundScale ?? 1.25); // border offset factor
      this.i(441, 0); // transparency
    }
  }

  /** Solid hatch fill over a single closed rectangular boundary. */
  addSolidHatchRect(layer: string, x: number, y: number, w: number, h: number, style?: EntityStyle) {
    this.addSolidHatchPolygon(layer, [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ], style);
  }

  /** Solid hatch fill over a single closed polygon boundary. */
  addSolidHatchPolygon(layer: string, points: { x: number; y: number }[], style?: EntityStyle) {
    if (points.length < 3) return;
    this.s(0, "HATCH");
    this.writeEntityPreamble("AcDbHatch", layer, style);
    this.r(10, 0); this.r(20, 0); this.r(30, 0); // elevation
    this.r(210, 0); this.r(220, 0); this.r(230, 1); // extrusion
    this.s(2, "SOLID");
    this.i(70, 1); // solid fill
    this.i(71, 0); // associativity: non-associative
    this.i(91, 1); // number of boundary paths
    // Boundary path: external (1) + polyline (2) = 3
    this.i(92, 3);
    this.i(72, 0); // has bulge = 0
    this.i(73, 1); // closed
    this.i(93, points.length);
    for (const p of points) {
      this.r(10, p.x); this.r(20, p.y);
    }
    this.i(97, 0); // source boundary objects count
    this.i(75, 0); // hatch style: odd parity
    this.i(76, 1); // hatch pattern type: predefined
    this.r(47, 1); // pixel size
    this.i(98, 0); // seed points
  }

  /** Solid hatch over an ellipse boundary. */
  addSolidHatchEllipse(
    layer: string,
    cx: number, cy: number,
    majorX: number, majorY: number,
    ratio: number,
    style?: EntityStyle,
  ) {
    this.s(0, "HATCH");
    this.writeEntityPreamble("AcDbHatch", layer, style);
    this.r(10, 0); this.r(20, 0); this.r(30, 0);
    this.r(210, 0); this.r(220, 0); this.r(230, 1);
    this.s(2, "SOLID");
    this.i(70, 1);
    this.i(71, 0);
    this.i(91, 1);
    this.i(92, 1); // external, non-polyline
    this.i(93, 1); // number of edges
    // Edge: ellipse (type 3)
    this.i(72, 3);
    this.r(10, cx); this.r(20, cy);
    this.r(11, majorX); this.r(21, majorY);
    this.r(40, ratio);
    this.r(50, 0);
    this.r(51, 360);
    this.i(73, 1); // CCW
    this.i(97, 0);
    this.i(75, 0);
    this.i(76, 1);
    this.r(47, 1);
    this.i(98, 0);
  }

  // ─── OBJECTS ─────────────────────────────────────────────────────────

  writeObjects() {
    this.startSection("OBJECTS");

    // Named object dictionary
    this.s(0, "DICTIONARY"); this.s(5, HANDLES.DICT_NAMED);
    this.s(330, "0");
    this.s(100, "AcDbDictionary");
    this.i(280, 0); this.i(281, 1);
    this.s(3, "ACAD_GROUP"); this.s(350, HANDLES.DICT_ACAD_GROUP);
    this.s(3, "ACAD_MLINESTYLE"); this.s(350, HANDLES.DICT_ACAD_MLINESTYLE);
    this.s(3, "ACAD_PLOTSTYLENAME"); this.s(350, HANDLES.DICT_ACAD_PLOTSTYLENAME);

    // ACAD_GROUP sub-dict (empty)
    this.s(0, "DICTIONARY"); this.s(5, HANDLES.DICT_ACAD_GROUP);
    this.s(330, HANDLES.DICT_NAMED);
    this.s(100, "AcDbDictionary");
    this.i(280, 0); this.i(281, 1);

    // ACAD_MLINESTYLE sub-dict (empty)
    this.s(0, "DICTIONARY"); this.s(5, HANDLES.DICT_ACAD_MLINESTYLE);
    this.s(330, HANDLES.DICT_NAMED);
    this.s(100, "AcDbDictionary");
    this.i(280, 0); this.i(281, 1);

    // ACAD_PLOTSTYLENAME dictionary — holds the "Normal" placeholder that
    // every LAYER's group-390 plot-style-name handle references.
    this.s(0, "ACDBDICTIONARYWDFLT"); this.s(5, HANDLES.DICT_ACAD_PLOTSTYLENAME);
    this.s(330, HANDLES.DICT_NAMED);
    this.s(100, "AcDbDictionary");
    this.i(281, 1);
    this.s(3, "Normal"); this.s(350, HANDLES.PLOTSTYLE_NORMAL);
    this.s(100, "AcDbDictionaryWithDefault");
    this.s(340, HANDLES.PLOTSTYLE_NORMAL);

    // Normal plot style placeholder — real AutoCAD uses AcDbPlaceHolder here.
    this.s(0, "ACDBPLACEHOLDER"); this.s(5, HANDLES.PLOTSTYLE_NORMAL);
    this.s(330, HANDLES.DICT_ACAD_PLOTSTYLENAME);

    this.endSection();
  }

  // ─── EOF ─────────────────────────────────────────────────────────────

  writeEof() {
    this.s(0, "EOF");
  }

  toString(): string {
    return this.lines.join("\r\n") + "\r\n";
  }
}
