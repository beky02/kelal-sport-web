import type { Crest } from "@/types/common";
import { cn } from "@/lib/utils/cn";

/**
 * Team badge: a flag for national sides, tinted initials for clubs, nothing at
 * all in data-saver mode. The `none` case renders no element so the row's gap
 * collapses rather than leaving a hole.
 */
export function TeamCrest({
  crest,
  size = 18,
  className,
}: {
  crest: Crest;
  size?: number;
  className?: string;
}) {
  if (crest.kind === "none") return null;

  if (crest.kind === "flag") {
    return (
      // See Flag: local fixed-size SVG.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={crest.src}
        alt=""
        className={cn(
          "shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgb(0_0_0/0.25)]",
          className,
        )}
        style={{ width: size, height: Math.round(size * 0.67) }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "font-body inline-grid shrink-0 place-items-center rounded-full leading-none font-extrabold tracking-[-0.02em]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: crest.background,
        color: crest.foreground,
        fontSize: Math.round(size * 0.45),
      }}
    >
      {crest.initials}
    </span>
  );
}
