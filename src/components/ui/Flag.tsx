import { Globe } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * A country flag, or a globe where a competition belongs to no single country
 * (continental cups) — the design uses one convention for both so the row
 * never loses its leading column.
 */
export function Flag({
  src,
  width = 20,
  height = 14,
  className,
}: {
  src: string | null;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <Globe
        width={width}
        height={height}
        strokeWidth={1.5}
        aria-hidden
        className={cn("text-muted shrink-0", className)}
      />
    );
  }

  return (
    // Local SVG at a fixed size: next/image would add a request and a wrapper
    // without optimising anything.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      className={cn(
        "shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgb(0_0_0/0.25)]",
        className,
      )}
      style={{ width, height }}
    />
  );
}
