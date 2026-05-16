// Rack face constants and helpers shared between RackFaceSVG, RackRenderer,
// and PDF export. Kept in a non-component file so React Fast Refresh stays
// happy in the component module.
import { PX_PER_MM } from "../rackUtils";

export const PX_PER_U = 24;
export const RACK_WIDTH = 260;
export const RULER_WIDTH = 28;
export const RAIL_WIDTH = 8;
export const FULL_WIDTH = RACK_WIDTH - 2 * RAIL_WIDTH; // 244
export const DEVICE_INSET = RAIL_WIDTH;
export const HALF_WIDTH = (RACK_WIDTH - 2 * DEVICE_INSET) / 2 - 1;

export function uToY(uPos: number, rackH: number) { return (rackH - uPos) * PX_PER_U; }
export function sideW(depthMm: number) { return Math.max(80, depthMm * PX_PER_MM); }

export const ACC_COLORS: Record<string, string> = {
  "blank-panel": "#888", "vent-panel": "#aaa", "shelf": "#a0855b",
  "drawer": "#8a7a5a", "cable-manager": "#666", "fan-unit": "#556b7a",
};

export function wrapLabel(text: string, maxChars: number, maxLines: number): string[] {
  if (maxChars < 2) return [text.slice(0, 1) + "…"];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    if (lines.length >= maxLines) break;
    const candidate = cur ? cur + " " + word : word;
    if (candidate.length <= maxChars) { cur = candidate; }
    else { if (cur) lines.push(cur); cur = word.length > maxChars ? word.slice(0, maxChars - 1) + "…" : word; }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === 0) lines.push(text.slice(0, maxChars - 1) + "…");
  return lines;
}
