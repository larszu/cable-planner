import { useSchematicStore } from "./store";

/**
 * Run the Print Sheet PDF export using current store state.
 * Shared between MenuBar's File→Export menu and the Export PDF button on the
 * print sheet toolbar so behavior + error messages stay aligned.
 */
export async function runPrintSheetExport(): Promise<void> {
  const { exportPrintSheetPdf } = await import("./printSheetPdf");
  const state = useSchematicStore.getState();
  const sheetPages = state.pages.filter((p) => p.type === "print-sheet");
  if (sheetPages.length === 0) {
    alert("No print sheets to export. Add a print sheet via the page tabs first.");
    return;
  }
  await exportPrintSheetPdf({
    pages: state.pages,
    nodes: state.nodes,
    schematicName: state.schematicName,
    titleBlock: state.titleBlock,
    schematicDefaults: { useShortNames: state.useShortNames, wrapDeviceLabels: state.wrapDeviceLabels },
  });
}
