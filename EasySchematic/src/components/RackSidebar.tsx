import { useCallback, useMemo, useState } from "react";
import { useSchematicStore } from "../store";
import type { DeviceData, RackElevationPage, RackType, RackData, RoomData } from "../types";
import { RACK_TYPE_LABELS } from "../types";
import { inferRackHeightU } from "../rackUtils";
import { aggregateRackStats, computeRackStats, formatStatsLine } from "../rackStats";
import { getDevicesInRoom } from "../rackLink";
import { resolveDeviceLabel } from "../displayName";

/** Shared drag state — set by sidebar, read by RackRenderer during dragOver.
 *  (dataTransfer.getData is blocked during dragover for security; this fallback
 *  lets the renderer preview drop targets without reading the payload.) */
export let draggedDeviceHeightU = 1;
export let draggedDeviceNodeId: string | null = null;

interface RackSidebarProps {
  page: RackElevationPage;
}

export default function RackSidebar({ page }: RackSidebarProps) {
  const nodes = useSchematicStore((s) => s.nodes);
  const removeRack = useSchematicStore((s) => s.removeRack);
  const updateRack = useSchematicStore((s) => s.updateRack);
  const moveRackToPage = useSchematicStore((s) => s.moveRackToPage);
  const allPagesForMove = useSchematicStore((s) => s.pages);
  const useShortNames = useSchematicStore((s) => s.useShortNames);
  const otherElevationPages = useMemo(() =>
    allPagesForMove.filter((p): p is RackElevationPage => p.type === "rack-elevation" && p.id !== page.id),
    [allPagesForMove, page.id],
  );
  const [showAddRack, setShowAddRack] = useState(false);
  const [editRack, setEditRack] = useState<RackData | null>(null);
  const [search, setSearch] = useState("");
  const [editingRackId, setEditingRackId] = useState<string | null>(null);
  const [editingRackLabel, setEditingRackLabel] = useState("");
  const [moveMenuRackId, setMoveMenuRackId] = useState<string | null>(null);

  // Find devices that haven't been placed in ANY rack on ANY page
  const allPages = useSchematicStore((s) => s.pages);
  const placedNodeIds = new Set(
    allPages.flatMap((p) => p.type === "rack-elevation" ? p.placements.map((pl) => pl.deviceNodeId) : [])
  );

  const unrackedDevices = nodes.filter(
    (n) => n.type === "device" && !placedNodeIds.has(n.id) && (n.data as DeviceData).deviceType !== "adapter"
  );

  const deviceDataMap = useMemo(() => {
    const map = new Map<string, DeviceData>();
    for (const n of nodes) {
      if (n.type === "device") map.set(n.id, n.data as DeviceData);
    }
    return map;
  }, [nodes]);

  const pageStats = useMemo(() => {
    if (page.racks.length === 0) return null;
    const per = page.racks.map((r) => computeRackStats(r, page.placements, page.accessories, deviceDataMap));
    return aggregateRackStats(per);
  }, [page, deviceDataMap]);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string, rackHeightU: number) => {
    e.dataTransfer.setData("application/x-rack-device-id", nodeId);
    e.dataTransfer.effectAllowed = "move";
    draggedDeviceHeightU = rackHeightU;
    draggedDeviceNodeId = nodeId;
  }, []);

  const handleDragEnd = useCallback(() => {
    draggedDeviceNodeId = null;
  }, []);

  return (
    <div className="w-56 bg-white border-r border-neutral-300 flex flex-col text-xs overflow-hidden">
      {/* Add Rack section */}
      <div className="p-2 border-b border-neutral-200">
        <button
          className="w-full px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          onClick={() => setShowAddRack(true)}
        >
          + Add Rack
        </button>
      </div>

      {/* Page totals */}
      {pageStats && (
        <div className="p-2 border-b border-neutral-200 bg-neutral-50">
          <div className="font-semibold text-neutral-500 mb-1 uppercase tracking-wider" style={{ fontSize: 9 }}>
            Page Totals
          </div>
          <div className="text-neutral-700 text-[11px] leading-tight">{formatStatsLine(pageStats)}</div>
          {(pageStats.unknownDepthCount > 0 || pageStats.unknownWeightCount > 0 || pageStats.unknownPowerCount > 0) && (
            <div className="text-neutral-400 text-[10px] mt-0.5">
              {[
                pageStats.unknownDepthCount > 0 ? `${pageStats.unknownDepthCount} unknown depth` : null,
                pageStats.unknownWeightCount > 0 ? `${pageStats.unknownWeightCount} unknown weight` : null,
                pageStats.unknownPowerCount > 0 ? `${pageStats.unknownPowerCount} unknown power` : null,
              ].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Racks on this page */}
      {page.racks.length > 0 && (
        <div className="p-2 border-b border-neutral-200">
          <div className="font-semibold text-neutral-500 mb-1 uppercase tracking-wider" style={{ fontSize: 9 }}>
            Racks
          </div>
          {page.racks.map((rack) => {
            const placementCount = page.placements.filter((p) => p.rackId === rack.id).length;
            const isEditing = editingRackId === rack.id;
            return (
              <div key={rack.id} className="flex items-center justify-between py-0.5 text-neutral-700 group">
                {isEditing ? (
                  <input
                    className="flex-1 min-w-0 bg-white border border-blue-400 rounded px-1 py-0 text-xs outline-none"
                    value={editingRackLabel}
                    autoFocus
                    onChange={(e) => setEditingRackLabel(e.target.value)}
                    onBlur={() => {
                      if (editingRackLabel.trim()) updateRack(page.id, rack.id, { label: editingRackLabel.trim() });
                      setEditingRackId(null);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") { if (editingRackLabel.trim()) updateRack(page.id, rack.id, { label: editingRackLabel.trim() }); setEditingRackId(null); }
                      if (e.key === "Escape") setEditingRackId(null);
                    }}
                  />
                ) : (
                  <span
                    className="truncate cursor-pointer"
                    onDoubleClick={() => { setEditingRackId(rack.id); setEditingRackLabel(rack.label); }}
                    title="Double-click to rename"
                  >
                    {rack.label} ({rack.heightU}U)
                  </span>
                )}
                <span className="text-neutral-400 text-[10px] shrink-0 ml-1 flex items-center gap-1">
                  {placementCount > 0 && <span>{placementCount} dev</span>}
                  {otherElevationPages.length > 0 && (
                    <div className="relative">
                      <button
                        className="text-neutral-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Move to page"
                        onClick={(e) => { e.stopPropagation(); setMoveMenuRackId(moveMenuRackId === rack.id ? null : rack.id); }}
                      >
                        →
                      </button>
                      {moveMenuRackId === rack.id && (
                        <div className="absolute right-0 top-5 z-50 bg-white border border-neutral-200 rounded shadow-lg py-1 min-w-[120px]">
                          {otherElevationPages.map((p) => (
                            <button
                              key={p.id}
                              className="w-full text-left px-3 py-1 text-xs text-neutral-700 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => { moveRackToPage(page.id, rack.id, p.id); setMoveMenuRackId(null); }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    className="text-neutral-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`Edit ${rack.label}`}
                    onClick={() => setEditRack(rack)}
                  >
                    ✎
                  </button>
                  <button
                    className="text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`Delete ${rack.label}`}
                    onClick={() => {
                      if (confirm(`Delete "${rack.label}"? This removes all devices placed in it.`)) {
                        removeRack(page.id, rack.id);
                      }
                    }}
                  >
                    ×
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Unracked devices — grouped by linked room */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {unrackedDevices.length > 0 && (
          <input
            className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-400"
            placeholder="Search devices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        )}
        {unrackedDevices.length === 0 ? (
          <div className="text-neutral-400 py-2">All devices placed</div>
        ) : (() => {
          const q = search.trim().toLowerCase();
          const matchesSearch = (node: typeof unrackedDevices[number]) => {
            if (!q) return true;
            const data = node.data as DeviceData;
            return data.label.toLowerCase().includes(q)
              || (data.shortName?.toLowerCase().includes(q) ?? false)
              || (data.manufacturer?.toLowerCase().includes(q) ?? false)
              || (data.modelNumber?.toLowerCase().includes(q) ?? false)
              || data.deviceType.toLowerCase().includes(q);
          };
          const renderDevice = (node: typeof unrackedDevices[number]) => {
            const data = node.data as DeviceData;
            const resolved = resolveDeviceLabel(data, { useShortNames, wrapDeviceLabels: false });
            const heightU = inferRackHeightU(data);
            const needsShelf = data.heightMm == null;
            return (
              <div
                key={node.id}
                className="flex items-center justify-between px-2 py-1 rounded bg-neutral-50 border border-neutral-200 cursor-grab hover:bg-blue-50 hover:border-blue-300"
                draggable
                onDragStart={(e) => handleDragStart(e, node.id, heightU)}
                onDragEnd={handleDragEnd}
                title={needsShelf ? `No height set — drop on a shelf accessory · ${data.label}` : data.label}
              >
                <span className="truncate">{resolved.text}</span>
                <span className="text-neutral-400 ml-1 shrink-0">
                  {needsShelf ? <span className="text-amber-600" title="needs shelf">⬚</span> : `${heightU}U`}
                </span>
              </div>
            );
          };

          const unrackedIds = new Set(unrackedDevices.map((n) => n.id));
          const linkedRacks = page.racks.filter((r) => r.linkedRoomId);
          const claimedByGroup = new Set<string>();
          const groups = linkedRacks.map((rack) => {
            const roomNode = nodes.find((n) => n.id === rack.linkedRoomId);
            const roomLabel = (roomNode?.data as RoomData | undefined)?.label ?? "Room";
            const roomDevices = getDevicesInRoom(rack.linkedRoomId!, nodes)
              .filter((n) => unrackedIds.has(n.id) && matchesSearch(n));
            roomDevices.forEach((n) => claimedByGroup.add(n.id));
            return { rack, roomLabel, devices: roomDevices };
          }).filter((g) => g.devices.length > 0);

          const otherUnracked = unrackedDevices
            .filter((n) => !claimedByGroup.has(n.id) && matchesSearch(n))
            .sort((a, b) => ((a.data as DeviceData).label).localeCompare((b.data as DeviceData).label));

          return (
            <>
              {groups.map(({ rack, roomLabel, devices }) => (
                <div key={rack.id}>
                  <div className="font-semibold text-blue-600 mb-0.5 uppercase tracking-wider" style={{ fontSize: 8 }}>
                    From {roomLabel} → {rack.label} ({devices.length})
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {devices.sort((a, b) => ((a.data as DeviceData).label).localeCompare((b.data as DeviceData).label)).map(renderDevice)}
                  </div>
                </div>
              ))}
              {otherUnracked.length > 0 && (
                <div>
                  <div className="font-semibold text-neutral-500 mb-0.5 uppercase tracking-wider" style={{ fontSize: 8 }}>
                    {groups.length > 0 ? `Other Unracked (${otherUnracked.length})` : `Unracked Devices (${otherUnracked.length})`}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {otherUnracked.map(renderDevice)}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Add Rack Dialog */}
      {showAddRack && (
        <AddRackDialog
          pageId={page.id}
          rackCount={page.racks.length}
          onClose={() => setShowAddRack(false)}
        />
      )}

      {/* Edit Rack Dialog */}
      {editRack && (
        <EditRackDialog
          pageId={page.id}
          rack={editRack}
          onClose={() => setEditRack(null)}
        />
      )}
    </div>
  );
}

function EditRackDialog({ pageId, rack, onClose }: { pageId: string; rack: RackData; onClose: () => void }) {
  const updateRack = useSchematicStore((s) => s.updateRack);
  const [label, setLabel] = useState(rack.label);
  const [rackType, setRackType] = useState<RackType>(rack.rackType);
  const [heightU, setHeightU] = useState(rack.heightU);
  const [depthMm, setDepthMm] = useState(rack.depthMm);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const cleanH = Math.max(2, Math.min(60, Math.round(heightU)));
    const cleanD = Math.max(100, Math.min(2000, Math.round(depthMm)));
    updateRack(pageId, rack.id, {
      label: label.trim() || rack.label,
      rackType,
      heightU: cleanH,
      depthMm: cleanD,
    });
    onClose();
  }, [pageId, rack.id, rack.label, label, rackType, heightU, depthMm, updateRack, onClose]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <form className="bg-white rounded-lg shadow-xl p-4 w-80 text-xs" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 className="font-semibold text-sm mb-3">Edit Rack</h3>

        <label className="block mb-2">
          <span className="text-neutral-600">Label</span>
          <input
            className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 outline-none focus:border-blue-400"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            autoFocus
          />
        </label>

        <label className="block mb-2">
          <span className="text-neutral-600">Type</span>
          <select
            className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 outline-none focus:border-blue-400"
            value={rackType}
            onChange={(e) => setRackType(e.target.value as RackType)}
          >
            {(Object.entries(RACK_TYPE_LABELS) as [RackType, string][]).map(([value, lbl]) => (
              <option key={value} value={value}>{lbl}</option>
            ))}
          </select>
        </label>

        <div className="flex gap-2 mb-3">
          <label className="block flex-1">
            <span className="text-neutral-600">Height (U)</span>
            <input
              type="number"
              className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 outline-none focus:border-blue-400"
              value={heightU}
              onChange={(e) => setHeightU(Number(e.target.value))}
              onKeyDown={(e) => e.stopPropagation()}
              min={2}
              max={60}
            />
          </label>
          <label className="block flex-1">
            <span className="text-neutral-600">Depth (mm)</span>
            <input
              type="number"
              className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 outline-none focus:border-blue-400"
              value={depthMm}
              onChange={(e) => setDepthMm(Number(e.target.value))}
              onKeyDown={(e) => e.stopPropagation()}
              min={100}
              max={2000}
              step={50}
            />
          </label>
        </div>

        <p className="text-neutral-400 text-[10px] mb-3">
          Reducing the U height does not delete devices already placed at higher U positions —
          they'll just sit outside the visible frame until you move or remove them.
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={onClose}>Cancel</button>
          <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
        </div>
      </form>
    </div>
  );
}

interface RackPreset {
  label: string;
  rackType: RackType;
  heightU: number;
  depthMm: number;
  description: string;
}

const RACK_PRESETS: RackPreset[] = [
  { label: "42U Floor Rack", rackType: "floor-19", heightU: 42, depthMm: 600, description: "Standard full-height AV rack" },
  { label: "25U Floor Rack", rackType: "floor-19", heightU: 25, depthMm: 600, description: "Half-height floor standing" },
  { label: "16U Floor Rack", rackType: "floor-19", heightU: 16, depthMm: 600, description: "Short floor standing" },
  { label: "12U Wall Mount", rackType: "wall-mount", heightU: 12, depthMm: 600, description: "Wall-mounted enclosure" },
  { label: "6U Wall Mount", rackType: "wall-mount", heightU: 6, depthMm: 600, description: "Small wall-mount" },
  { label: "4U Desktop", rackType: "desktop", heightU: 4, depthMm: 600, description: "Tabletop / portable" },
  { label: "8U Desktop", rackType: "desktop", heightU: 8, depthMm: 600, description: "Larger tabletop rack" },
  { label: "45U Open 2-Post", rackType: "open-2post", heightU: 45, depthMm: 600, description: "2-post relay rack" },
  { label: "12U Open 2-Post", rackType: "open-2post", heightU: 12, depthMm: 600, description: "Small 2-post relay rack" },
  { label: "42U Open 4-Post", rackType: "open-4post", heightU: 42, depthMm: 800, description: "4-post open frame" },
];

function AddRackDialog({ pageId, rackCount, onClose }: { pageId: string; rackCount: number; onClose: () => void }) {
  const addRack = useSchematicStore((s) => s.addRack);
  const [mode, setMode] = useState<"presets" | "custom">("presets");
  const [label, setLabel] = useState(`Rack ${rackCount + 1}`);
  const [rackType, setRackType] = useState<RackType>("floor-19");
  const [heightU, setHeightU] = useState(42);
  const [depthMm, setDepthMm] = useState(600);

  const applyPreset = useCallback((preset: RackPreset) => {
    addRack(pageId, {
      label: `Rack ${rackCount + 1}`,
      rackType: preset.rackType,
      heightU: preset.heightU,
      depthMm: preset.depthMm,
      widthClass: "19in",
      position: { x: rackCount * 400, y: 0 },
    });
    onClose();
  }, [pageId, rackCount, addRack, onClose]);

  const handleCustomSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    addRack(pageId, {
      label: label.trim() || `Rack ${rackCount + 1}`,
      rackType,
      heightU: Math.max(2, Math.min(60, Math.round(heightU))),
      depthMm: Math.max(100, Math.min(2000, Math.round(depthMm))),
      widthClass: "19in",
      position: { x: rackCount * 400, y: 0 },
    });
    onClose();
  }, [pageId, label, rackType, heightU, depthMm, rackCount, addRack, onClose]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-4 w-80 text-xs" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Add Rack</h3>
          <div className="flex rounded overflow-hidden border border-neutral-300">
            <button
              className={`px-2 py-0.5 ${mode === "presets" ? "bg-blue-600 text-white" : "bg-white text-neutral-600"}`}
              onClick={() => setMode("presets")}
            >
              Presets
            </button>
            <button
              className={`px-2 py-0.5 ${mode === "custom" ? "bg-blue-600 text-white" : "bg-white text-neutral-600"}`}
              onClick={() => setMode("custom")}
            >
              Custom
            </button>
          </div>
        </div>

        {mode === "presets" ? (
          <div className="flex flex-col gap-1">
            {RACK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className="flex items-center justify-between px-3 py-2 rounded border border-neutral-200 hover:border-blue-400 hover:bg-blue-50 text-left transition-colors"
                onClick={() => applyPreset(preset)}
              >
                <div>
                  <div className="font-medium text-neutral-800">{preset.label}</div>
                  <div className="text-neutral-400 text-[10px]">{preset.description}</div>
                </div>
                <span className="text-neutral-400 shrink-0 ml-2">{preset.heightU}U</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit}>
            <label className="block mb-2">
              <span className="text-neutral-600">Label</span>
              <input
                className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 outline-none focus:border-blue-400"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
            </label>

            <label className="block mb-2">
              <span className="text-neutral-600">Type</span>
              <select
                className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 outline-none focus:border-blue-400"
                value={rackType}
                onChange={(e) => setRackType(e.target.value as RackType)}
              >
                {(Object.entries(RACK_TYPE_LABELS) as [RackType, string][]).map(([value, lbl]) => (
                  <option key={value} value={value}>{lbl}</option>
                ))}
              </select>
            </label>

            <div className="flex gap-2 mb-3">
              <label className="block flex-1">
                <span className="text-neutral-600">Height (U)</span>
                <input
                  type="number"
                  className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 outline-none focus:border-blue-400"
                  value={heightU}
                  onChange={(e) => setHeightU(Number(e.target.value))}
                  min={2}
                  max={60}
                />
              </label>
              <label className="block flex-1">
                <span className="text-neutral-600">Depth (mm)</span>
                <input
                  type="number"
                  className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 outline-none focus:border-blue-400"
                  value={depthMm}
                  onChange={(e) => setDepthMm(Number(e.target.value))}
                  min={100}
                  max={2000}
                  step={50}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">
                Add
              </button>
            </div>
          </form>
        )}

        {mode === "presets" && (
          <div className="flex justify-end mt-2">
            <button className="px-3 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
