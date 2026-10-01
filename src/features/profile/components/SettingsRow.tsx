import { cn } from "@/lib/utils/cn";

/** Small all-caps heading that opens each block of settings. */
export function SettingsSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted px-4 pt-5.5 pb-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase">
      {children}
    </div>
  );
}

/**
 * One setting: what it is on the left, the control on the right.
 *
 * Every row in this screen measures the same so the column reads as a list rather
 * than a stack of differently-built widgets.
 */
export function SettingsRow({
  label,
  note,
  children,
  className,
}: {
  label: React.ReactNode;
  note?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-divider flex min-h-14 items-center justify-between gap-3 border-b px-4 py-1.5",
        className,
      )}
    >
      <span>
        <span className="block">{label}</span>
        {note && <span className="text-muted block text-[11px]">{note}</span>}
      </span>
      {children}
    </div>
  );
}

/** A read-only fact about the account. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-divider flex min-h-12 items-center justify-between gap-3 border-b px-4">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
