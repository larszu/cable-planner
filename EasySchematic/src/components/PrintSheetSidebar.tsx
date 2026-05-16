import { useSchematicStore } from "../store";
import type { RackElevationPage } from "../types";

export default function PrintSheetSidebar() {
  const pages = useSchematicStore((s) => s.pages);
  const activePage = useSchematicStore((s) => s.activePage);
  const addViewport = useSchematicStore((s) => s.addViewport);

  const elevationPages = pages.filter((p): p is RackElevationPage => p.type === "rack-elevation");

  const handleDragStart = (e: React.DragEvent, pageId: string, rackId: string, kind: "rack-front" | "rack-rear" | "rack-side") => {
    e.dataTransfer.setData("application/x-print-viewport", JSON.stringify({ pageId, rackId, kind }));
    e.dataTransfer.effectAllowed = "copy";
  };

  if (elevationPages.length === 0) return null;

  return (
    <div className="w-44 bg-white border-r border-neutral-200 overflow-y-auto flex flex-col text-xs" data-print-hide>
      <div className="px-2 pt-2 pb-1 font-semibold text-neutral-500 uppercase tracking-wider" style={{ fontSize: 9 }}>
        Drag to Sheet
      </div>
      {elevationPages.map((ep) => (
        <div key={ep.id} className="mb-2">
          <div className="px-2 py-0.5 text-neutral-600 font-medium truncate" title={ep.label}>
            {ep.label}
          </div>
          {ep.racks.map((rack) => (
            <div key={rack.id} className="ml-2 mb-1">
              <div className="px-2 py-0.5 text-neutral-500 truncate" title={rack.label} style={{ fontSize: 10 }}>
                {rack.label} ({rack.heightU}U)
              </div>
              {(["rack-front", "rack-rear", "rack-side"] as const).map((kind) => (
                <div
                  key={kind}
                  className="ml-2 px-2 py-0.5 rounded cursor-grab text-neutral-600 hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-200 transition-colors"
                  draggable
                  onDragStart={(e) => handleDragStart(e, ep.id, rack.id, kind)}
                  onClick={() => {
                    if (!activePage) return;
                    addViewport(activePage, {
                      kind,
                      rackRefPageId: ep.id,
                      rackRefId: rack.id,
                      positionMm: { x: 20, y: 20 },
                      sizeMm: { w: 60, h: 80 },
                      showLabel: true,
                    });
                  }}
                >
                  {kind === "rack-front" ? "Front" : kind === "rack-rear" ? "Rear" : "Side"}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
