import Link from "next/link";
import { cn } from "@/lib/utils/cn";

// 8px, matching the design's sidebar row — one step softer than an odds button.
const BASE =
  "font-body text-text flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] no-underline";

/**
 * The sidebar's one row shape, as a button or a link.
 *
 * Every navigational row in the sidebar looks and measures the same, so the
 * column reads as a single list rather than four differently-built ones.
 */
export function SidebarRow({
  active,
  className,
  ...rest
}: React.ComponentPropsWithoutRef<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        BASE,
        "cursor-pointer",
        active ? "bg-raised font-bold" : "hover:bg-raised bg-transparent",
        className,
      )}
    />
  );
}

export function SidebarLinkRow({
  active,
  className,
  href,
  children,
}: {
  active?: boolean;
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        BASE,
        active ? "bg-raised font-bold" : "hover:bg-raised",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Right-aligned count that closes a sidebar row. */
export function RowCount({ children }: { children: React.ReactNode }) {
  return <span className="text-muted text-[11px] font-medium">{children}</span>;
}
