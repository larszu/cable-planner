import { useRef, useEffect, useCallback } from "react";
import { formatIpInput, isValidIpv4 } from "../networkValidation";

interface IpInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Override validation function (e.g. isValidSubnetMask). Defaults to isValidIpv4. */
  validate?: (value: string) => boolean;
  /** Show yellow duplicate warning border + tooltip */
  duplicateWarning?: string;
  className?: string;
  /** Called on Enter/Tab to commit the edit */
  onCommit?: () => void;
  /** Called on Escape to cancel the edit */
  onCancel?: () => void;
  autoFocus?: boolean;
}

export default function IpInput({
  value,
  onChange,
  placeholder,
  disabled,
  validate = isValidIpv4,
  duplicateWarning,
  className,
  onCommit,
  onCancel,
  autoFocus,
}: IpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);

  // Restore cursor position after React re-render
  useEffect(() => {
    if (cursorRef.current != null && inputRef.current) {
      inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
      cursorRef.current = null;
    }
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const formatted = formatIpInput(raw, value);

      // Estimate new cursor position
      const oldCursor = e.target.selectionStart ?? raw.length;
      const lengthDiff = formatted.length - raw.length;
      cursorRef.current = Math.max(0, oldCursor + lengthDiff);

      onChange(formatted);
    },
    [value, onChange],
  );

  const isInvalid = value.length > 0 && !validate(value);
  const isDuplicate = !isInvalid && !!duplicateWarning;

  const borderColor = disabled
    ? "border-[var(--color-border)]"
    : isInvalid
      ? "border-red-400"
      : isDuplicate
        ? "border-yellow-400"
        : "border-[var(--color-border)] focus:border-blue-500";

  return (
    <input
      ref={inputRef}
      className={`bg-[var(--color-surface)] border rounded px-1 py-0.5 text-[10px] outline-none ${borderColor} ${
        disabled ? "opacity-50" : ""
      } ${className ?? ""}`}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      title={isDuplicate ? duplicateWarning : undefined}
      autoFocus={autoFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onCommit) { e.preventDefault(); onCommit(); }
        else if (e.key === "Escape" && onCancel) { e.preventDefault(); onCancel(); }
        else if (e.key === "Tab" && onCommit) { e.preventDefault(); onCommit(); }
        e.stopPropagation();
      }}
    />
  );
}
