import { translate } from "@/lib/i18n";
import type { Lang } from "@/types/common";

/**
 * Both languages, Amharic first: the kiosk has no language of its own until
 * F8c, and Amharic is the `demo` tenant's default (FD2).
 */
const LANGS: readonly Lang[] = ["am", "en"];

/**
 * What a terminal host shows at `/` until F8b builds the terminal: which site
 * this is, and that it isn't set up. No API call, no client code.
 */
export default function TerminalPlaceholder() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="flex flex-col gap-1 text-2xl">
        {LANGS.map((lang) => (
          <span key={lang} lang={lang}>
            {translate(lang, "terminal.placeholder.title")}
          </span>
        ))}
      </h1>
      <div className="flex flex-col gap-1">
        {LANGS.map((lang) => (
          <p key={lang} lang={lang} className="text-muted text-base">
            {translate(lang, "terminal.placeholder.body")}
          </p>
        ))}
      </div>
    </main>
  );
}
