"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Three mutually exclusive durations.
 *
 * Tiles rather than a dropdown: these are irreversible choices and the options
 * should be visible side by side before one is picked.
 */
export function ChoiceTiles<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-3 gap-1.5"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "font-body h-12 cursor-pointer rounded-md border text-[13px] font-semibold",
              on
                ? "border-accent bg-accent text-on-accent"
                : "bg-raised text-text border-transparent",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
