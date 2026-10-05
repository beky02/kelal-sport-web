"use client";

import { cn } from "@/lib/utils/cn";

export function Switch({
  checked,
  onChange,
  label,
  note,
  size = "md",
  pending = false,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  /** Secondary line under the label, for settings that need explaining. */
  note?: string;
  size?: "md" | "lg";
  /** Waiting for the server to say what the setting now is: pressing does nothing. */
  pending?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={pending || undefined}
      // Not `disabled`: a pressed control that disables itself drops keyboard
      // and screen-reader focus to the page (review Q3).
      aria-disabled={pending || undefined}
      onClick={() => {
        if (!pending) onChange(!checked);
      }}
      className={cn(
        "font-body flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 text-left text-[13px] aria-disabled:cursor-wait aria-disabled:opacity-60",
        className,
      )}
    >
      <span>
        <span className="block">{label}</span>
        {note && <span className="text-muted block text-[11px]">{note}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 rounded-full border p-[3px] transition-colors",
          size === "lg" ? "h-7 w-12" : "h-[26px] w-11",
          checked
            ? "bg-accent border-accent justify-end"
            : "bg-raised justify-start border-transparent",
        )}
      >
        <span
          className={cn(
            "size-5 rounded-full transition-colors",
            checked ? "bg-white" : "bg-muted",
          )}
        />
      </span>
    </button>
  );
}
