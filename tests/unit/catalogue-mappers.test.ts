import { describe, expect, it } from "vitest";
import {
  fillTemplate,
  flagFor,
  lookup,
  sportIdFromSlug,
  sportSlug,
  toBoard,
  toCountries,
  toEventDetail,
  toSports,
  toTopCompetitions,
  type Dictionary,
} from "@/lib/api/mappers/catalogue";
import { example } from "../contract";

/** Three days before the contract's fixtures kick off. */
const NOW = new Date("2026-10-01T09:00:00Z");

const dictEn = example("/v1/dictionary");
/** Prism answers in English whatever the language; Amharic is made up here. */
const dictAm: Dictionary = {
  ...structuredClone(dictEn),
  lang: "am",
  tournaments: dictEn.tournaments.map((t) =>
    t.id === "t_epl" ? { ...t, name: "ፕሪሚየር ሊግ", category: "እንግሊዝ" } : t,
  ),
};
const dict = lookup({ en: dictEn, am: dictAm });
const counts = example("/v1/sports").items;

const events = example("/v1/events").items;
const board = toBoard({ en: events, am: events }, dict, NOW, false);

describe("toBoard", () => {
  it("shows the contract's three matches, one section per tournament", () => {
    expect(board.map((s) => s.competition.id)).toEqual([
      "t_eth_pl",
      "t_epl",
      "t_laliga",
    ]);
    expect(
      board.flatMap((s) =>
        s.events.map(
          ({ event }) => `${event.home.name.en} v ${event.away.name.en}`,
        ),
      ),
    ).toEqual([
      "Saint George v Fasil Kenema",
      "Arsenal v Chelsea",
      "Real Madrid v Barcelona",
    ]);
  });

  it("names the tournament and country from the dictionary, in both languages", () => {
    const epl = board[1].competition;
    expect(epl.name).toEqual({ en: "Premier League", am: "ፕሪሚየር ሊግ" });
    expect(epl.region).toEqual({
      code: "GB",
      name: { en: "England", am: "እንግሊዝ" },
      flag: "/flags/gb-eng.svg",
    });
  });

  it("puts kickoff in East Africa Time", () => {
    const { event } = board[1].events[0];
    // 14:00Z is 17:00 in Addis Ababa.
    expect(event.startDate).toBe("2026-10-04");
    expect(event.kickoff).toBe("17:00");
    expect(event.status).toBe("scheduled");
    expect(event.marketCount).toBe(184);
  });

  it("carries the real outcome IDs, prices as the contract's strings, and team-name labels", () => {
    const market = board[1].events[0].markets.matchResult!;
    expect(market.id).toBe("mk_ac_1x2");
    expect(market.type).toBe("1x2");
    expect(market.status).toBe("open");
    expect(
      market.outcomes.map((o) => [o.id, o.code, o.label.en, o.odds]),
    ).toEqual([
      ["oc_ac_1", "1", "Arsenal", "2.10"],
      ["oc_ac_x", "X", "Draw", "3.40"],
      ["oc_ac_2", "2", "Chelsea", "3.30"],
    ]);
  });

  it("locks every price on a suspended market", () => {
    const market = board[2].events[0].markets.matchResult!;
    expect(market.status).toBe("suspended");
    expect(market.outcomes.every((o) => o.odds === null)).toBe(true);
    // The fixture itself is still on: only its market is paused.
    expect(board[2].events[0].event.suspended).toBe(false);
  });

  it("leaves the columns /v1/events does not carry empty", () => {
    const { markets } = board[0].events[0];
    expect(markets.doubleChance).toBeNull();
    expect(markets.totalGoals).toBeNull();
  });

  it("drops crests in data-saver mode", () => {
    const lite = toBoard({ en: events, am: events }, dict, NOW, true);
    expect(lite[0].events[0].event.home.crest).toEqual({ kind: "none" });
  });
});

describe("toEventDetail", () => {
  const detail = example("/v1/events/{id}");
  const view = toEventDetail({ en: detail, am: detail }, dict, NOW, false);

  it("orders markets as the dictionary does, lines ascending", () => {
    expect(view.markets.map((m) => m.id)).toEqual([
      "mk_ac_1x2",
      "mk_ac_dc",
      "mk_ac_t25",
      "mk_ac_t35",
      "mk_ac_btts",
    ]);
  });

  it("fills specifiers into market and outcome names", () => {
    const total = view.markets.find((m) => m.id === "mk_ac_t25")!;
    expect(total.name.en).toBe("Total 2.5");
    // Every line shares one card, titled without the line.
    expect(total.title.en).toBe("Total");
    expect(total.line).toBe("2.5");
    expect(total.category).toBe("goals");
    expect(total.outcomes.map((o) => o.label.en)).toEqual([
      "Over 2.5",
      "Under 2.5",
    ]);
  });

  it("offers the groups the fixture has, named by the dictionary", () => {
    expect(view.groups.map((g) => [g.code, g.name.en])).toEqual([
      ["main", "Main"],
      ["goals", "Goals"],
      ["halves", "Halves"],
      ["handicap", "Handicap"],
      ["corners", "Corners"],
    ]);
  });

  it("locks an inactive line", () => {
    const total = view.markets.find((m) => m.id === "mk_ac_t35")!;
    expect(total.status).toBe("suspended");
    expect(total.outcomes.map((o) => o.odds)).toEqual([null, null]);
  });
});

describe("navigation", () => {
  it("maps sports with their counts and icons", () => {
    const sports = toSports(dict, counts);
    expect(sports.map((s) => [s.id, s.slug, s.name.en, s.eventCount])).toEqual([
      ["s_football", "football", "Football", 412],
      ["s_basketball", "basketball", "Basketball", 57],
    ]);
    expect(sports[0].iconPaths.length).toBeGreaterThan(1);
  });

  it("round-trips the sport slug in the URL", () => {
    expect(sportIdFromSlug(sportSlug("s_football"))).toBe("s_football");
  });

  it("lists top competitions in the book's order", () => {
    expect(toTopCompetitions(dict, counts).map((c) => c.id)).toEqual([
      "t_eth_pl",
      "t_epl",
      "t_laliga",
      "t_nba",
    ]);
  });

  it("groups tournaments by country, A–Z", () => {
    const countries = toCountries(dict, counts);
    expect(countries.map((c) => [c.code, c.flag])).toEqual([
      ["GB", "/flags/gb-eng.svg"],
      ["ET", "/flags/et.svg"],
      ["ES", "/flags/es.svg"],
      // No flag file for the USA yet: the row shows a globe.
      ["US", null],
    ]);
    expect(countries[1].leagues).toEqual([
      {
        id: "t_eth_pl",
        name: {
          en: "Ethiopian Premier League",
          am: "Ethiopian Premier League",
        },
        eventCount: 8,
      },
    ]);
  });
});

describe("helpers", () => {
  it("fills signed handicap lines", () => {
    expect(fillTemplate("1 ({+hcp})", { hcp: "-1" })).toBe("1 (-1)");
    expect(fillTemplate("2 ({-hcp})", { hcp: "-1" })).toBe("2 (+1)");
    expect(fillTemplate("1 ({+hcp})", { hcp: "1.5" })).toBe("1 (+1.5)");
    expect(fillTemplate("Total {total}", {})).toBe("Total {total}");
  });

  it("only points at flag files that exist", () => {
    expect(flagFor("ET")).toBe("/flags/et.svg");
    expect(flagFor("GB", "Scotland")).toBeNull();
    expect(flagFor(null)).toBeNull();
  });
});
