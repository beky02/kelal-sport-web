import { cn } from "@/lib/utils/cn";

/**
 * A surface panel. Layers differ by fill plus a hairline border — the design
 * uses no drop shadows anywhere, so depth reads the same in both themes.
 */
export function Card({
  className,
  children,
  ...rest
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...rest}
      className={cn("bg-surface border-border rounded-lg border", className)}
    >
      {children}
    </div>
  );
}

/** Small all-caps section label. Cased and tracked per script by the tokens. */
export function CardLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "label-caps text-muted flex items-center gap-1.5 px-2.5 pt-2 pb-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
