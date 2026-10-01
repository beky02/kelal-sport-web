import { cn } from "@/lib/utils/cn";

export function CountBadge({
  children,
  tone = "accent",
  className,
}: {
  children: React.ReactNode;
  tone?: "accent" | "muted" | "live";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10px] font-extrabold",
        tone === "accent" && "bg-accent text-on-accent",
        tone === "muted" && "bg-ground text-muted",
        tone === "live" && "bg-live text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}
