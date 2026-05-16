import type { DeviceData, DeviceTemplate } from "./types";

/**
 * Canonical inventory key for matching placed devices against owned-gear
 * templates. Format: `manufacturer|modelNumber|displayName`.
 *
 * Both variants must agree on what goes in the display-name slot so that a
 * template in the owned-gear list matches the devices it was spawned from.
 * Templates only have `label`; placed nodes may have been renamed and expose
 * the original via `baseLabel` — `model` wins when present, then `baseLabel`,
 * then the (possibly-edited) `label`.
 */
export function inventoryKeyFromTemplate(
  t: Pick<DeviceTemplate, "label" | "manufacturer" | "modelNumber">,
): string {
  return `${t.manufacturer ?? ""}|${t.modelNumber ?? ""}|${t.label}`;
}

export function inventoryKeyFromDeviceData(
  d: Pick<DeviceData, "label" | "manufacturer" | "modelNumber" | "model" | "baseLabel">,
): string {
  return `${d.manufacturer ?? ""}|${d.modelNumber ?? ""}|${d.model ?? d.baseLabel ?? d.label}`;
}
