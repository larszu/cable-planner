import { useState } from "react";

const DISMISS_KEY = "easyschematic-beta-banner-dismissed";

function isBetaHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.startsWith("beta.");
}

export default function BetaBanner() {
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1",
  );

  if (!isBetaHost() || dismissed) return null;

  const handleDismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* private mode */ }
    setDismissed(true);
  };

  return (
    <div
      className="text-sm px-4 py-2 flex items-center justify-between gap-4"
      style={{
        backgroundColor: "#f59e0b",
        color: "#1f2937",
        borderBottom: "1px solid #b45309",
      }}
      data-print-hide
    >
      <span>
        <strong>Beta:</strong> testing new features before they hit production. Your saved schematics
        are real — don't save anything you can't lose.
      </span>
      <button
        onClick={handleDismiss}
        className="text-xs cursor-pointer hover:underline shrink-0"
        style={{ color: "#1f2937" }}
      >
        Dismiss
      </button>
    </div>
  );
}
