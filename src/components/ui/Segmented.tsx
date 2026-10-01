"use client";

import { cn } from "@/lib/utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

/**
 * The pill group used for board filters, the language switch, the slip's
 * bet-type tabs and the aside tabs. Only the active pill takes a fill, so odds
 * remain the only strongly-filled thing on the board.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  fill = "surface",
  className,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** `xs` is the phone app bar's, where every pixel of the row is spoken for. */
  size?: "xs" | "sm" | "md";
  /** Which fill the selected pill takes, given the track's own background. */
  fill?: "surface" | "raised" | "ground";
  className?: string;
}) {
  return (
    <div className={cn("bg-raised flex gap-0.5 rounded-md p-[3px]", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "font-body flex flex-1 cursor-pointer items-center justify-center rounded-sm font-bold whitespace-nowrap",
              size === "xs" && "h-[26px] rounded-[7px] px-2 text-[11px]",
              size === "sm" && "h-[30px] px-3 text-xs",
              size === "md" && "h-9 px-3 text-[13px]",
              active
                ? cn(
                    "text-text",
                    fill === "surface" && "bg-surface",
                    fill === "raised" && "bg-raised",
                    fill === "ground" && "bg-ground",
                  )
                : "text-muted",
              option.disabled && "cursor-not-allowed opacity-45",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
