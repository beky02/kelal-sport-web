import { code128 } from "@/lib/barcode/code128";
import { cn } from "@/lib/utils/cn";

/** Code 128 wants at least ten modules of white either side of the bars. */
const QUIET_ZONE = 10;
const HEIGHT = 40;

/** One path for every bar: `M x 0 h width v height h -width z`. */
function barsPath(widths: readonly number[]): { d: string; modules: number } {
  let x = QUIET_ZONE;
  let d = "";
  widths.forEach((width, i) => {
    if (i % 2 === 0) d += `M${x} 0h${width}v${HEIGHT}h-${width}z`;
    x += width;
  });
  return { d, modules: x + QUIET_ZONE };
}

function bars(code: string): { d: string; modules: number } | null {
  try {
    return barsPath(code128(code.replace(/[\s-]/g, "")));
  } catch {
    // Not a printable-ASCII code: there is nothing a scanner could read, and
    // the code is printed beside the barcode anyway.
    return null;
  }
}

/**
 * A ticket number or booking code as a Code 128 barcode, for a shop's scanner.
 *
 * It encodes the code without its hyphens (`K7Q2-M9XP-M` → `K7Q2M9XPM`), the
 * form a retail ticket's barcode carries before its MAC (C19), so a scanner
 * meets one format; the code itself is printed beside it for reading or
 * typing. Black on white in every theme, because a scanner needs the
 * contrast. Drawn as one SVG path, so it is the same bars on the server and
 * in the browser.
 */
export function Barcode({
  code,
  label,
  className,
}: {
  code: string;
  label: string;
  className?: string;
}) {
  const drawing = bars(code);
  return (
    <div
      role="img"
      aria-label={`${label}: ${code}`}
      className={cn(
        "bg-barcode-paper flex h-[62px] rounded-md px-3.5 py-2.5",
        className,
      )}
    >
      {drawing && (
        <svg
          viewBox={`0 0 ${drawing.modules} ${HEIGHT}`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          aria-hidden
          focusable="false"
          className="fill-barcode-ink h-full w-full"
        >
          <path d={drawing.d} />
        </svg>
      )}
    </div>
  );
}
