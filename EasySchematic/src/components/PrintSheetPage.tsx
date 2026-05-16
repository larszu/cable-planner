import { useSchematicStore } from "../store";
import PrintSheetToolbar from "./PrintSheetToolbar";
import PrintSheetSidebar from "./PrintSheetSidebar";
import PrintSheetRenderer from "./PrintSheetRenderer";
import type { PrintSheetPage as PrintSheetPageType } from "../types";

export default function PrintSheetPage() {
  const activePage = useSchematicStore((s) => s.activePage);
  const pages = useSchematicStore((s) => s.pages);

  const page = pages.find((p) => p.id === activePage);
  if (!page || page.type !== "print-sheet") return null;

  return (
    <div className="flex flex-1 overflow-hidden flex-col">
      <PrintSheetToolbar page={page as PrintSheetPageType} />
      <div className="flex flex-1 overflow-hidden">
        <PrintSheetSidebar />
        <PrintSheetRenderer page={page as PrintSheetPageType} />
      </div>
    </div>
  );
}
