import { useState, useMemo } from "react";
import type { FillSeriesConfig } from "./types";

interface FillSeriesDialogProps {
  config: FillSeriesConfig;
  startValue: string;
  cellCount: number;
  onApply: (values: string[]) => void;
  onClose: () => void;
}

export default function FillSeriesDialog({
  config,
  startValue,
  cellCount,
  onApply,
  onClose,
}: FillSeriesDialogProps) {
  const [step, setStep] = useState(config.defaultStep);

  const preview = useMemo(
    () => config.generateSeries(startValue, cellCount, step),
    [config, startValue, cellCount, step],
  );

  const invalidIndices = useMemo(() => {
    if (!config.validate) return new Set<number>();
    const bad = new Set<number>();
    preview.forEach((v, i) => {
      if (!config.validate!(v)) bad.add(i);
    });
    return bad;
  }, [config, preview]);

  const canApply = invalidIndices.size === 0;

  const handleApply = () => {
    if (!canApply) return;
    onApply(preview);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[var(--color-border)] rounded-lg shadow-2xl w-[340px] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-heading)]">
            Fill Series — {config.label}
          </h3>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Fill {cellCount} cell{cellCount > 1 ? "s" : ""} starting from{" "}
            <span className="font-mono font-medium text-[var(--color-text)]">{startValue}</span>
          </p>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
              {config.stepLabel}
            </label>
            <input
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500"
              type="number"
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleApply();
                if (e.key === "Escape") onClose();
              }}
              autoFocus
            />
          </div>

          {/* Preview */}
          <div>
            <label className="block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
              Preview
            </label>
            <div className="max-h-[160px] overflow-y-auto border border-[var(--color-border)] rounded bg-[var(--color-surface)]">
              {preview.map((value, i) => (
                <div
                  key={i}
                  className={`px-2 py-0.5 text-xs font-mono flex items-center gap-2 ${
                    i % 2 === 1 ? "bg-white/50" : ""
                  } ${invalidIndices.has(i) ? "text-red-500" : "text-[var(--color-text)]"}`}
                >
                  <span className="text-[var(--color-text-muted)] text-[10px] w-5 text-right shrink-0">
                    {i + 1}.
                  </span>
                  {value}
                </div>
              ))}
            </div>
          </div>

          {invalidIndices.size > 0 && (
            <p className="text-[11px] text-red-500">
              {invalidIndices.size} value{invalidIndices.size > 1 ? "s" : ""} invalid — adjust step
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!canApply}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer font-medium"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
