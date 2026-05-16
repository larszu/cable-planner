import { useState, useMemo } from "react";
import { useSchematicStore } from "../store";
import { findAdaptersForSignalBridge, findAdaptersForConnectorBridge } from "../connectorTypes";
import { SIGNAL_LABELS, CONNECTOR_LABELS } from "../types";
import type { DeviceTemplate } from "../types";
import { DEVICE_TEMPLATES } from "../deviceLibrary";

export default function IncompatibleConnectionDialog() {
  const pending = useSchematicStore((s) => s.pendingIncompatibleConnection);
  const customTemplates = useSchematicStore((s) => s.customTemplates);
  const dismiss = useSchematicStore((s) => s.dismissIncompatibleDialog);
  const forceConnect = useSchematicStore((s) => s.forceIncompatibleConnection);
  const insertAdapter = useSchematicStore((s) => s.insertAdapterBetween);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const adapters = useMemo(() => {
    if (!pending) return [];
    const allTemplates = [...DEVICE_TEMPLATES, ...customTemplates];
    if (pending.reason === "connector-mismatch") {
      return findAdaptersForConnectorBridge(
        pending.sourcePort.connectorType!,
        pending.targetPort.connectorType!,
        pending.sourcePort.signalType,
        allTemplates,
      );
    }
    return findAdaptersForSignalBridge(
      pending.sourcePort.signalType,
      pending.targetPort.signalType,
      allTemplates,
    );
  }, [pending, customTemplates]);

  if (!pending) return null;

  const isConnectorMismatch = pending.reason === "connector-mismatch";
  const srcSignal = SIGNAL_LABELS[pending.sourcePort.signalType];
  const tgtSignal = SIGNAL_LABELS[pending.targetPort.signalType];
  const srcConn = pending.sourcePort.connectorType ? CONNECTOR_LABELS[pending.sourcePort.connectorType] : "";
  const tgtConn = pending.targetPort.connectorType ? CONNECTOR_LABELS[pending.targetPort.connectorType] : "";

  const handleInsert = () => {
    if (selectedIdx === null) return;
    insertAdapter(adapters[selectedIdx]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={dismiss}
    >
      <div
        className="bg-white border border-[var(--color-border)] rounded-lg shadow-2xl w-[440px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <span className="text-sm font-semibold text-[var(--color-text-heading)]">
            {isConnectorMismatch ? "Connector Mismatch" : "Incompatible Connection"}
          </span>
          <button
            onClick={dismiss}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            {isConnectorMismatch
              ? <>{srcConn} &rarr; {tgtConn} ({srcSignal})</>
              : <>{srcSignal}{srcConn ? ` (${srcConn})` : ""} &rarr; {tgtSignal}{tgtConn ? ` (${tgtConn})` : ""}</>
            }
          </p>
          <p className="text-xs text-[var(--color-text)]">
            {isConnectorMismatch
              ? "These ports use different connector types. Select an adapter to insert between them."
              : "These ports use different signal types. You can insert an adapter/converter or force the connection."
            }
          </p>

          {/* Adapter list */}
          {adapters.length > 0 ? (
            <div className="border border-[var(--color-border)] rounded max-h-[200px] overflow-y-auto">
              {adapters.map((t: DeviceTemplate, i: number) => (
                <button
                  key={t.id ?? t.label + i}
                  className={`w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 cursor-pointer border-b last:border-b-0 border-[var(--color-border)] transition-colors ${
                    selectedIdx === i
                      ? "bg-blue-50 text-blue-900"
                      : "hover:bg-[var(--color-surface-hover)]"
                  }`}
                  onClick={() => setSelectedIdx(i)}
                  onDoubleClick={() => { setSelectedIdx(i); insertAdapter(t); }}
                >
                  <span className="font-medium text-[var(--color-text-heading)]">{t.label}</span>
                  {(t.manufacturer || t.modelNumber) && (
                    <span className="text-[var(--color-text-muted)]">
                      {[t.manufacturer, t.modelNumber].filter(Boolean).join(" — ")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[var(--color-text-muted)] italic px-1 py-3">
              No matching adapters found in the device library
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border)]">
          <button
            onClick={dismiss}
            className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            onClick={forceConnect}
            className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer text-[var(--color-text)]"
          >
            Connect Anyway
          </button>
          <button
            onClick={handleInsert}
            disabled={selectedIdx === null}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Insert Adapter
          </button>
        </div>
      </div>
    </div>
  );
}
