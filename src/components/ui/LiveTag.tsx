import { cn } from "@/lib/utils/cn";

/** The one live convention in the product: a red dot, everywhere. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("bg-live size-1.5 shrink-0 rounded-full", className)}
    />
  );
}

export function LiveTag({ label }: { label: string }) {
  return (
    <span className="bg-live inline-flex items-center gap-1 rounded-[4px] py-px pr-1.5 pl-[5px] text-[9px] font-extrabold tracking-[0.06em] text-white">
      <span aria-hidden className="size-[5px] rounded-full bg-white" />
      {label}
    </span>
  );
}
