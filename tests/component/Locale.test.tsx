import { afterEach, describe, expect, it } from "vitest";
import { act, render as rtlRender, screen } from "@testing-library/react";
import { formatShortDate, toEat } from "@/lib/i18n/dates";
import { formatKickoff } from "@/lib/i18n/format";
import { LocaleProvider, type Locale } from "@/lib/i18n/locale";
import am from "@/lib/i18n/messages/am.json";
import en from "@/lib/i18n/messages/en.json";
import { useRichTranslation } from "@/lib/i18n/rich";
import { useDateTimeText } from "@/lib/i18n/use-date-time-text";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUiStore } from "@/stores/ui.store";
import { render } from "./render";

const KICKOFF = "2026-10-04T14:00:00Z";

/** What a shared component shows: a message, a rich message and a kickoff. */
function Sample() {
  const t = useTranslation();
  const rich = useRichTranslation();
  const when = useDateTimeText();
  return (
    <>
      <p data-testid="lang">{t.lang}</p>
      <p data-testid="text">{t.t("board.filters.today")}</p>
      <p data-testid="rich">
        {rich("common.dateAtTime", { date: <b>D</b>, time: <b>T</b> })}
      </p>
      <p data-testid="when">{when(KICKOFF)}</p>
    </>
  );
}

const kickoff = (locale: Locale) => {
  const { date, time } = toEat(KICKOFF);
  return `${formatShortDate(date, locale.calendar)} · ${formatKickoff(time, locale.lang, locale.clock)}`;
};

afterEach(() => {
  act(() =>
    useUiStore.setState({ lang: "en", clock: "eat", calendar: "gregorian" }),
  );
});

describe("the language shared components read (F8ca decision 5)", () => {
  it("a text hook reads the nearest locale provider, not the player's store", () => {
    // The player's store says English; the provider says Amharic, the
    // Ethiopian clock and calendar. The provider wins.
    useUiStore.setState({ lang: "en", clock: "eat", calendar: "gregorian" });
    const locale: Locale = { lang: "am", clock: "eth", calendar: "ethiopian" };
    rtlRender(
      <LocaleProvider value={locale}>
        <Sample />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("lang")).toHaveTextContent("am");
    expect(screen.getByTestId("text")).toHaveTextContent(
      am.board.filters.today,
    );
    expect(screen.getByTestId("rich").textContent).toBe(
      am.common.dateAtTime.replace("{date}", "D").replace("{time}", "T"),
    );
    expect(screen.getByTestId("when")).toHaveTextContent(kickoff(locale));
  });

  it("without a provider, reads English, East Africa Time and the Gregorian calendar", () => {
    useUiStore.setState({ lang: "am", clock: "eth", calendar: "ethiopian" });
    rtlRender(<Sample />);

    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    expect(screen.getByTestId("text")).toHaveTextContent(
      en.board.filters.today,
    );
    expect(screen.getByTestId("when")).toHaveTextContent(
      kickoff({ lang: "en", clock: "eat", calendar: "gregorian" }),
    );
  });

  it("the player's provider follows the stored language, clock and calendar", () => {
    useUiStore.setState({ lang: "am", clock: "eat", calendar: "gregorian" });
    render(<Sample />);
    expect(screen.getByTestId("text")).toHaveTextContent(
      am.board.filters.today,
    );

    act(() =>
      useUiStore.setState({ lang: "en", clock: "eth", calendar: "ethiopian" }),
    );
    expect(screen.getByTestId("text")).toHaveTextContent(
      en.board.filters.today,
    );
    expect(screen.getByTestId("when")).toHaveTextContent(
      kickoff({ lang: "en", clock: "eth", calendar: "ethiopian" }),
    );
  });
});
