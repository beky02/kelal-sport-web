import { translate, type Interpolations, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import type { Lang } from "@/types/common";

/**
 * English first, then Amharic: English is the terminal's first language (F8ca
 * rework 2), and these screens come before the kiosk has one of its own. Each
 * line carries its `lang`, so a screen reader reads each in its own voice.
 */
const ORDER: readonly Lang[] = ["en", "am"];

/** One message in both languages, a line each. */
export function Bilingual({
  k,
  values,
  className,
}: {
  k: MessageKey;
  values?: Interpolations;
  className?: string;
}) {
  return (
    <>
      {ORDER.map((lang, index) => (
        <span
          key={lang}
          lang={lang}
          // The second line a step down, so English reads first and Amharic,
          // the larger script, doesn't outweigh it (review U2).
          className={cn(
            "block",
            index > 0 && "text-muted text-[0.85em]",
            className,
          )}
        >
          {translate(lang, k, values)}
        </span>
      ))}
    </>
  );
}
