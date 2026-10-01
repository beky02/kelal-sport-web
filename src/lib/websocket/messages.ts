import { z } from "zod";

/**
 * The realtime contract.
 *
 * Validated on arrival for the same reason REST responses are: a gateway that
 * starts sending `"1.67"` where the contract says `1.67` should be a loud
 * failure in one place, not a `NaN` that reaches an odds button.
 */
const marketRef = {
  eventId: z.string(),
  marketType: z.enum(["1x2", "dc", "ou", "btts", "hc", "cs"]),
  line: z.string().nullable().default(null),
};

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ODDS_UPDATED"),
    ...marketRef,
    outcomeCode: z.string(),
    /** Null closes the price. */
    odds: z.number().positive().nullable(),
    movement: z.enum(["up", "down"]).nullable().default(null),
  }),
  z.object({
    type: z.literal("MARKET_STATUS_CHANGED"),
    ...marketRef,
    status: z.enum(["open", "suspended"]),
  }),
  z.object({
    type: z.literal("SCORE_UPDATED"),
    eventId: z.string(),
    home: z.number().int().nonnegative(),
    away: z.number().int().nonnegative(),
    minute: z.string().nullable().default(null),
  }),
  z.object({
    type: z.literal("EVENT_STATUS_CHANGED"),
    eventId: z.string(),
    status: z.enum(["scheduled", "starting_soon", "live", "finished"]),
    suspended: z.boolean(),
  }),
  z.object({ type: z.literal("PONG") }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;

export type ClientMessage =
  | { type: "SUBSCRIBE"; topics: string[] }
  | { type: "UNSUBSCRIBE"; topics: string[] }
  | { type: "PING" };

/** Topics are coarse on the board and precise on a fixture's own page. */
export const topics = {
  sport: (sportId: string) => `sport:${sportId}`,
  live: (sportId: string) => `sport:${sportId}:live`,
  event: (eventId: string) => `event:${eventId}`,
};

/**
 * Parses one frame.
 *
 * Returns null rather than throwing on a malformed frame: a bad message should
 * drop that message, not tear down a working connection.
 */
export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const parsed = serverMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
