import { describe, expect, it } from "vitest";
import { kioskLanguage } from "@/features/terminal/stores/kiosk.store";
import type { TerminalConfigView } from "@/features/terminal/types";
import type { Lang } from "@/types/common";

const tenant = (
  languages: Lang[],
  defaultLanguage: Lang,
): TerminalConfigView => ({
  retail: true,
  bookingCodes: true,
  languages,
  defaultLanguage,
  rules: null,
});

describe("the kiosk's language (F8ca AC-3, the user's second review)", () => {
  it.each([
    ["no config yet, nothing chosen", null, null, "en"],
    ["no config yet, Amharic chosen", "am", null, "am"],
    [
      "both offered, Amharic the default, nothing chosen",
      null,
      tenant(["am", "en"], "am"),
      "en",
    ],
    ["both offered, Amharic chosen", "am", tenant(["am", "en"], "am"), "am"],
    ["Amharic chosen, now English only", "am", tenant(["en"], "en"), "en"],
    ["English chosen, now Amharic only", "en", tenant(["am"], "am"), "am"],
    ["Amharic only, nothing chosen", null, tenant(["am"], "am"), "am"],
  ] as const)("%s → %s", (_, chosen, config, expected) => {
    expect(kioskLanguage(chosen, config)).toBe(expected);
  });
});
