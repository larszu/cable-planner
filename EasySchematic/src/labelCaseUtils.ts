import { useCallback } from "react";
import type { LabelCaseMode } from "./types";
import { useSchematicStore } from "./store";

/** Transform a label for display. Data is never mutated — callers apply this at render/serialize time only. */
export function transformLabel(text: string | null | undefined, mode: LabelCaseMode): string {
  if (text == null) return "";
  switch (mode) {
    case "uppercase": return text.toUpperCase();
    case "lowercase": return text.toLowerCase();
    case "capitalize": return text.replace(/\b\w/g, (c) => c.toUpperCase());
    case "as-typed":
    default: return text;
  }
}

/** React hook — returns a memoized transform bound to the current labelCase preference.
 *  Use inside components that display labels. Don't use inside <input> values. */
export function useDisplayLabel(): (text: string | null | undefined) => string {
  const mode = useSchematicStore((s) => s.labelCase);
  return useCallback((text) => transformLabel(text, mode), [mode]);
}

/** Non-component helper — reads current preference from the store and transforms.
 *  Use inside report/export functions that run outside React. */
export function transformLabelNow(text: string | null | undefined): string {
  return transformLabel(text, useSchematicStore.getState().labelCase);
}
