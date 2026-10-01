import { describe, expect, it } from "vitest";
import { parseServerMessage, topics } from "@/lib/websocket/messages";
import { applyToBoard, applyToMarkets } from "@/lib/websocket/apply-updates";
import { mockRepository } from "@/lib/api/mock/repository";
import type { ServerMessage } from "@/lib/websocket/messages";

const board = await mockRepository.listBoard({ sportId: "soccer" });

const oddsUpdate = (
  eventId: string,
  outcomeCode: string,
  odds: number | null,
  movement: "up" | "down" | null = null,
): ServerMessage => ({
  type: "ODDS_UPDATED",
  eventId,
  marketType: "1x2",
  line: null,
  outcomeCode,
  odds,
  movement,
});

const find = (sections: typeof board, eventId: string) =>
  sections.flatMap((s) => s.events).find((e) => e.event.id === eventId)!;

describe("parseServerMessage", () => {
  it("parses a price move", () => {
    expect(
      parseServerMessage(
        '{"type":"ODDS_UPDATED","eventId":"m3","marketType":"1x2","outcomeCode":"1","odds":1.67,"movement":"up"}',
      ),
    ).toEqual({
      type: "ODDS_UPDATED",
      eventId: "m3",
      marketType: "1x2",
      line: null,
      outcomeCode: "1",
      odds: 1.67,
      movement: "up",
    });
  });

  it("drops a frame whose odds arrived as a string", () => {
    expect(
      parseServerMessage(
        '{"type":"ODDS_UPDATED","eventId":"m3","marketType":"1x2","outcomeCode":"1","odds":"1.67"}',
      ),
    ).toBeNull();
  });

  it("drops malformed JSON and unknown types without throwing", () => {
    expect(parseServerMessage("{not json")).toBeNull();
    expect(parseServerMessage('{"type":"WHO_KNOWS"}')).toBeNull();
  });

  it("names topics predictably", () => {
    expect(topics.event("m3")).toBe("event:m3");
    expect(topics.live("soccer")).toBe("sport:soccer:live");
  });
});

describe("applyToBoard", () => {
  it("updates the addressed price", () => {
    const next = applyToBoard(board, oddsUpdate("m3", "1", 1.67, "up"));
    const outcome = find(next, "m3").markets.matchResult!.outcomes[0];

    expect(outcome.odds).toBe(1.67);
    expect(outcome.movement).toBe("up");
    expect(outcome.previousOdds).toBe(1.62);
  });

  /**
   * The performance contract: one price moving must not invalidate the rest of
   * the board. If these identity checks fail, every row re-renders on every
   * tick, which is exactly what the architecture sets out to avoid.
   */
  it("returns every untouched object by reference", () => {
    const next = applyToBoard(board, oddsUpdate("m3", "1", 1.67));

    // Sections other than the one holding m3 are the same objects.
    for (let i = 0; i < board.length; i++) {
      const touched = board[i].events.some((e) => e.event.id === "m3");
      if (!touched) expect(next[i], `section ${i}`).toBe(board[i]);
    }

    const section = next.find((s) =>
      s.events.some((e) => e.event.id === "m3"),
    )!;
    const original = board.find((s) =>
      s.events.some((e) => e.event.id === "m3"),
    )!;

    // Sibling rows in the same competition are untouched.
    for (let i = 0; i < original.events.length; i++) {
      if (original.events[i].event.id !== "m3") {
        expect(section.events[i]).toBe(original.events[i]);
      }
    }

    const before = original.events.find((e) => e.event.id === "m3")!;
    const after = section.events.find((e) => e.event.id === "m3")!;

    // Within the changed row: the event, the other markets and the sibling
    // outcomes all keep their identity.
    expect(after.event).toBe(before.event);
    expect(after.markets.doubleChance).toBe(before.markets.doubleChance);
    expect(after.markets.totalGoals).toBe(before.markets.totalGoals);
    expect(after.markets.matchResult!.outcomes[1]).toBe(
      before.markets.matchResult!.outcomes[1],
    );
    expect(after.markets.matchResult!.outcomes[0]).not.toBe(
      before.markets.matchResult!.outcomes[0],
    );
  });

  it("returns the same array when the price did not actually change", () => {
    expect(applyToBoard(board, oddsUpdate("m3", "1", 1.62))).toBe(board);
  });

  it("returns the same array for an event that is not on the board", () => {
    expect(applyToBoard(board, oddsUpdate("nope", "1", 2))).toBe(board);
  });

  it("closes a price", () => {
    const next = applyToBoard(board, oddsUpdate("m3", "1", null));
    expect(find(next, "m3").markets.matchResult!.outcomes[0].odds).toBeNull();
  });

  it("suspends and reopens a market", () => {
    const suspended = applyToBoard(board, {
      type: "MARKET_STATUS_CHANGED",
      eventId: "m3",
      marketType: "1x2",
      line: null,
      status: "suspended",
    });
    expect(find(suspended, "m3").markets.matchResult!.status).toBe("suspended");
    // The other markets on the same event are untouched objects.
    expect(find(suspended, "m3").markets.totalGoals).toBe(
      find(board, "m3").markets.totalGoals,
    );
  });

  it("applies a score and a minute", () => {
    const next = applyToBoard(board, {
      type: "SCORE_UPDATED",
      eventId: "m1",
      home: 2,
      away: 0,
      minute: "71'",
    });
    const event = find(next, "m1").event;
    expect(event.score).toEqual({ home: 2, away: 0 });
    expect(event.minute).toBe("71'");
    // Markets are untouched by a score.
    expect(find(next, "m1").markets).toBe(find(board, "m1").markets);
  });

  it("ignores a score identical to the one on screen", () => {
    expect(
      applyToBoard(board, {
        type: "SCORE_UPDATED",
        eventId: "m1",
        home: 1,
        away: 0,
        minute: "63'",
      }),
    ).toBe(board);
  });

  it("flips an event into suspension", () => {
    const next = applyToBoard(board, {
      type: "EVENT_STATUS_CHANGED",
      eventId: "m3",
      status: "live",
      suspended: true,
    });
    expect(find(next, "m3").event.suspended).toBe(true);
    expect(find(next, "m3").event.status).toBe("live");
  });

  it("does nothing on a heartbeat", () => {
    expect(applyToBoard(board, { type: "PONG" })).toBe(board);
  });
});

describe("applyToMarkets", () => {
  it("updates the addressed line only", async () => {
    const markets = await mockRepository.listMarkets("m3");
    const next = applyToMarkets(markets, {
      type: "ODDS_UPDATED",
      eventId: "m3",
      marketType: "ou",
      line: "2.5",
      outcomeCode: "Over",
      odds: 1.8,
      movement: "up",
    });

    const over25 = next.find((m) => m.type === "ou" && m.line === "2.5")!;
    expect(over25.outcomes[0].odds).toBe(1.8);
    expect(over25.outcomes[0].previousOdds).toBe(1.72);

    // Every other line keeps its identity.
    for (let i = 0; i < markets.length; i++) {
      if (markets[i].id !== over25.id) expect(next[i]).toBe(markets[i]);
    }
  });

  it("ignores messages that do not concern prices", async () => {
    const markets = await mockRepository.listMarkets("m3");
    expect(
      applyToMarkets(markets, {
        type: "SCORE_UPDATED",
        eventId: "m3",
        home: 1,
        away: 0,
        minute: null,
      }),
    ).toBe(markets);
  });
});

describe("market identity", () => {
  it("gives every market on an event a unique id", async () => {
    for (const eventId of ["m3", "m1", "m12"]) {
      const markets = await mockRepository.listMarkets(eventId);
      const ids = markets.map((m) => m.id);
      expect(new Set(ids).size, `${eventId}: ${ids.join(", ")}`).toBe(
        ids.length,
      );
    }
  });

  it("treats each goal line and handicap as its own market", async () => {
    const markets = await mockRepository.listMarkets("m3");
    const overUnder = markets.filter((m) => m.type === "ou");
    expect(overUnder.map((m) => m.line)).toEqual([
      "0.5",
      "1.5",
      "2.5",
      "3.5",
      "4.5",
    ]);
    expect(markets.filter((m) => m.type === "hc").map((m) => m.line)).toEqual([
      "−1",
      "−2",
      "+1",
    ]);
  });

  it("treats correct score as one market, not one per row", async () => {
    const markets = await mockRepository.listMarkets("m3");
    const correctScore = markets.filter((m) => m.type === "cs");
    expect(correctScore).toHaveLength(1);
    expect(correctScore[0].outcomes).toHaveLength(15);
    expect(correctScore[0].outcomes.map((o) => o.code)).toContain("1–0");
    expect(correctScore[0].outcomes.map((o) => o.code)).toContain("2–3");
  });

  it("keeps the board and the detail page agreeing on 1X2", async () => {
    const board = await mockRepository.listBoard({ sportId: "soccer" });
    const boardOdds = board
      .flatMap((s) => s.events)
      .find((e) => e.event.id === "m3")!
      .markets.matchResult!.outcomes.map((o) => o.odds);

    const detail = await mockRepository.listMarkets("m3");
    const detailOdds = detail
      .find((m) => m.type === "1x2")!
      .outcomes.map((o) => o.odds);

    expect(detailOdds).toEqual(boardOdds);
  });
});
