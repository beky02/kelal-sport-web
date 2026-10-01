"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Amber is attention, used sparingly — a pinned favourite is one of the few. */
export function StarButton({
  pinned,
  label,
  onClick,
  size = 28,
  iconSize = 15,
}: {
  pinned: boolean;
  label: string;
  onClick: () => void;
  size?: number;
  iconSize?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pinned}
      onClick={onClick}
      style={{ width: size, height: size }}
      className={cn(
        "grid shrink-0 cursor-pointer place-items-center rounded-sm bg-transparent",
        pinned ? "text-warn" : "text-muted hover:text-text",
      )}
    >
      <Star
        size={iconSize}
        strokeWidth={1.5}
        fill={pinned ? "currentColor" : "none"}
      />
    </button>
  );
}
