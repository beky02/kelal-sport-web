import { Lock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { OddsMovement } from "@/features/markets/types";

/** `lg` is the shop kiosk's: 56 px, read from a step away (F8ca). */
export type OddsButtonSize = "sm" | "md" | "lg";

export interface OddsButtonViewProps {
  /** Formatted price. Null renders the suspended state. */
  odds: string | null;
  selected: boolean;
  movement: OddsMovement | null;
  /** Shown on the left in lined markets, e.g. `Over` beside `1.72`. */
  label?: string;
  size?: OddsButtonSize;
  ariaLabel: string;
  onClick?: () => void;
}

/**
 * One price, and nothing else.
 *
 * Pure and store-free so every state can be rendered side by side in a test or
 * a story. It has no idea what a bet slip is; the connected `OddsButton` wires
 * it up.
 *
 *   default · selected · odds up · odds down · suspended
 */
export function OddsButtonView({
  odds,
  selected,
  movement,
  label,
  size = "md",
  ariaLabel,
  onClick,
}: OddsButtonViewProps) {
  const suspended = odds === null;

  return (
    <button
      type="button"
      onClick={suspended ? undefined : onClick}
      disabled={suspended}
      aria-pressed={suspended ? undefined : selected}
      aria-label={ariaLabel}
      className={cn(
        "font-body numeric relative flex w-full cursor-pointer items-center rounded-sm leading-none font-bold",
        size === "sm" && "h-9 text-[13px]",
        size === "md" && "h-11 text-sm",
        size === "lg" && "h-14 text-lg",
        // A lock alone is centred, label or not (review U4).
        label && !suspended
          ? cn("justify-between gap-1.5", size === "lg" ? "px-4" : "px-2.5")
          : "justify-center",

        suspended
          ? "border-divider text-muted cursor-not-allowed border border-dashed bg-transparent opacity-55"
          : selected
            ? "bg-accent border-accent text-on-accent border"
            : movement === "up"
              ? "bg-win-bg border-line text-win border"
              : movement === "down"
                ? "bg-loss-bg border-line text-loss border"
                : "bg-odd border-line text-text border",
      )}
    >
      {suspended ? (
        <Lock size={size === "lg" ? 18 : 13} strokeWidth={1.5} aria-hidden />
      ) : (
        <>
          {label && (
            <span
              className={cn(
                "truncate font-medium",
                size === "lg" ? "text-sm" : "text-xs",
                selected ? "text-on-accent" : "text-muted",
              )}
            >
              {label}
            </span>
          )}
          <span>{odds}</span>
          {movement && (
            <span
              aria-hidden
              className={cn(
                "absolute top-[3px] right-1 text-[8px] leading-none",
                selected
                  ? "text-on-accent"
                  : movement === "up"
                    ? "text-win"
                    : "text-loss",
              )}
            >
              {movement === "up" ? "▲" : "▼"}
            </span>
          )}
        </>
      )}
    </button>
  );
}
