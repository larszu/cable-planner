import type { DeviceData, DeviceTemplate, SchematicFile } from "./types";

export interface SchematicDisplayDefaults {
  useShortNames?: boolean;
  wrapDeviceLabels?: boolean;
}

export function getSchematicDisplayDefaults(file: Pick<SchematicFile, "useShortNames" | "wrapDeviceLabels">): SchematicDisplayDefaults {
  return {
    useShortNames: file.useShortNames,
    wrapDeviceLabels: file.wrapDeviceLabels,
  };
}

export interface ResolvedDeviceLabel {
  text: string;
  wrap: boolean;
  /** True when a compact name is available for this device — explicit shortName or
   *  modelNumber. Drives whether the "Use short name" toggle is enabled in the editor. */
  hasShortName: boolean;
  /** Source of the compact name when one is available; "label" when nothing else exists. */
  shortSource: "shortName" | "modelNumber" | "label";
}

/** Pick the most compact identifier we have for a device. Preference order:
 *  curated `shortName` → `modelNumber` → fall back to the full `label`. */
function compactName(device: Pick<DeviceData, "label" | "shortName" | "modelNumber">): { text: string; source: "shortName" | "modelNumber" | "label" } {
  const shortName = device.shortName?.trim();
  if (shortName) return { text: shortName, source: "shortName" };
  const modelNumber = device.modelNumber?.trim();
  if (modelNumber) return { text: modelNumber, source: "modelNumber" };
  return { text: device.label, source: "label" };
}

/** Auto-number suffix preserved when collapsing a long label to its short form.
 *
 *  `renumberNodes` writes labels as exactly `baseLabel` (single instance) or
 *  `${baseLabel} ${N}` (multiple instances), and clears `baseLabel` when the user
 *  manually renames. So a non-empty baseLabel is a precise signal of
 *  "this device is participating in auto-numbering" — anything trailing baseLabel
 *  in the current label is the auto-number suffix and should ride along when we
 *  swap in shortName / modelNumber.
 *
 *  Example: baseLabel="Sony HDC-5500", label="Sony HDC-5500 3" → suffix=" 3".
 *  Resolved with shortName "HDC-5500" → "HDC-5500 3". */
function autoNumberSuffix(label: string, baseLabel: string | undefined): string {
  if (!baseLabel) return "";
  if (label === baseLabel) return "";
  if (label.startsWith(baseLabel)) return label.slice(baseLabel.length);
  return "";
}

export function resolveDeviceLabel(
  device: Pick<DeviceData, "label" | "shortName" | "useShortName" | "wrapLabel" | "modelNumber" | "baseLabel">,
  defaults: SchematicDisplayDefaults,
): ResolvedDeviceLabel {
  const compact = compactName(device);
  const hasShortName = compact.source !== "label";
  const useShort = device.useShortName ?? defaults.useShortNames ?? false;
  const text = useShort && hasShortName
    ? compact.text + autoNumberSuffix(device.label, device.baseLabel)
    : device.label;
  const wrap = device.wrapLabel ?? defaults.wrapDeviceLabels ?? false;
  return { text, wrap, hasShortName, shortSource: compact.source };
}

/** What to show in the device library / sidebar for a template entry — same fallback
 *  chain as device instances: shortName → modelNumber → label. */
export function templateDisplayLabel(t: Pick<DeviceTemplate, "label" | "shortName" | "modelNumber">): string {
  return t.shortName?.trim() || t.modelNumber?.trim() || t.label;
}
