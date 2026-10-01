import { cn } from "@/lib/utils/cn";

/**
 * Renders a sport's glyph from the path data the API supplies.
 *
 * Sport icons are data, not components: the book can add a sport without a
 * frontend release. Everything else uses lucide.
 */
export function SportIcon({
  paths,
  size = 16,
  className,
}: {
  paths: readonly string[];
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
