import { cn } from "@/lib/utils/cn";

/**
 * One market's prices as a column group on the board.
 *
 * Three equal tracks whatever the market holds, so 1X2, double chance and
 * over/under all line up down the page. A two-outcome market with a line label
 * puts the line in the middle track.
 */
export function OddsGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-divider grid grid-cols-3 items-center gap-1 border-l px-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
