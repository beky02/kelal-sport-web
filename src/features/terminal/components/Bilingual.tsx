import { translate, type Interpolations, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import type { Lang } from "@/types/common";

/**
 * Amharic first, then English: the kiosk has no language of its own until F8c,
 * and Amharic is the `demo` tenant's default (FD2). Each line carries its
 * `lang`, so a screen reader reads each in its own voice.
 */
const ORDER: readonly Lang[] = ["am", "en"];

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
      {ORDER.map((lang) => (
        <span key={lang} lang={lang} className={cn("block", className)}>
          {translate(lang, k, values)}
        </span>
      ))}
    </>
  );
}
