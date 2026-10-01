import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "raised" | "outline" | "ghost";
type Size = "sm" | "md" | "lg" | "cta";

const VARIANT: Record<Variant, string> = {
  // Accent is reserved for action and selection. Nothing decorative uses it.
  primary: "bg-accent text-on-accent hover:brightness-110",
  raised: "bg-raised text-text hover:brightness-110",
  outline: "border-accent text-text border bg-transparent",
  ghost: "text-muted hover:text-text bg-transparent",
};

const SIZE: Record<Size, string> = {
  sm: "h-[30px] px-3 text-xs",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-4 text-[13px]",
  cta: "h-[50px] px-4 text-[15px] font-extrabold",
};

export function Button({
  variant = "raised",
  size = "md",
  className,
  ...rest
}: React.ComponentPropsWithoutRef<"button"> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "font-body inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-bold transition-[filter,background-color] disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    />
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: React.ComponentPropsWithoutRef<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...rest}
      className={cn(
        "bg-raised text-text grid size-9 shrink-0 cursor-pointer place-items-center rounded-md",
        className,
      )}
    >
      {children}
    </button>
  );
}
