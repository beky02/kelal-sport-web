import { cn } from "@/lib/utils/cn";

/**
 * A placeholder block. Never show a blank screen while data loads — the board
 * should keep its shape so nothing jumps when prices arrive.
 */
export function Skeleton({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden
      {...rest}
      className={cn("bg-raised animate-pulse rounded-sm", className)}
    />
  );
}
