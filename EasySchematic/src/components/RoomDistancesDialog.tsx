import { useMemo } from "react";
import { useSchematicStore } from "../store";
import { DEFAULT_DISTANCE_SETTINGS } from "../types";
import { listTopLevelRooms, pairKey } from "../roomDistance";

interface RoomDistancesDialogProps {
  onClose: () => void;
}

export default function RoomDistancesDialog({ onClose }: RoomDistancesDialogProps) {
  const nodes = useSchematicStore((s) => s.nodes);
  const roomDistances = useSchematicStore((s) => s.roomDistances);
  const distanceSettings = useSchematicStore((s) => s.distanceSettings);
  const setRoomDistance = useSchematicStore((s) => s.setRoomDistance);
  const setDistanceSettings = useSchematicStore((s) => s.setDistanceSettings);

  const settings = distanceSettings ?? DEFAULT_DISTANCE_SETTINGS;
  const rooms = useMemo(() => listTopLevelRooms(nodes), [nodes]);

  const pairs = useMemo(() => {
    const out: Array<{ a: { id: string; label: string }; b: { id: string; label: string }; key: string }> = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        out.push({ a: rooms[i], b: rooms[j], key: pairKey(rooms[i].id, rooms[j].id) });
      }
    }
    return out;
  }, [rooms]);

  const labelClass = "block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1";
  const inputClass =
    "bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-heading)] outline-none focus:border-blue-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border border-[var(--color-border)] rounded-lg shadow-2xl w-[520px] max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-heading)]">Room Distances</h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-heading)] text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
            Set the physical distance between top-level rooms. Estimated cable length
            for each connection is shown in the Cable Schedule alongside any manual
            length you&rsquo;ve entered. Devices in nested subrooms inherit the distance
            of their top-level room.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Unit</label>
              <div className="flex items-center gap-1">
                {(["m", "ft"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setDistanceSettings({ unit: u })}
                    className={`px-3 py-1 text-xs rounded border cursor-pointer transition-colors ${
                      settings.unit === u
                        ? "bg-blue-50 border-blue-400 text-blue-700"
                        : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:text-[var(--color-text-heading)]"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Slack %</label>
              <input
                type="number"
                min={0}
                step={1}
                value={settings.slackPercent}
                onChange={(e) => setDistanceSettings({ slackPercent: Number(e.target.value) })}
                className={`${inputClass} w-24`}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <div>
              <label className={labelClass}>Slack +{settings.unit}</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={settings.slackFixed}
                onChange={(e) => setDistanceSettings({ slackFixed: Number(e.target.value) })}
                className={`${inputClass} w-24`}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-border)]">
            <div className={labelClass}>Room pairs ({settings.unit})</div>
            {rooms.length < 2 ? (
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                Create at least two top-level rooms to define distances.
              </p>
            ) : (
              <div className="space-y-1 mt-1 max-h-[50vh] overflow-y-auto pr-1">
                {pairs.map(({ a, b, key }) => {
                  const current = roomDistances?.[key];
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-xs text-[var(--color-text)] flex-1 truncate">
                        {a.label} <span className="text-[var(--color-text-muted)]">↔</span> {b.label}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={current ?? ""}
                        placeholder="—"
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === "" ? undefined : Number(raw);
                          setRoomDistance(a.id, b.id, value);
                        }}
                        className={`${inputClass} w-24 text-right`}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
