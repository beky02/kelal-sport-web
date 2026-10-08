"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { sanitiseAmount } from "@/lib/money";
import type { OutcomeRef } from "@/features/markets/types";
import type {
  BookingNotice,
  SlipFromBooking,
} from "@/features/bookings/lib/to-slip";
import type { BookingReceipt } from "@/features/bookings/types";

import { refusesPicks, type OddsUpdate } from "../lib/placement";
import {
  oddsMoved,
  type BetReceipt,
  type BetSelection,
  type BetSlipMode,
  type OddsPolicy,
  type PlaceAttempt,
  type PlaceRefusal,
} from "../types";

/**
 * Booking this slip: which slip (its request's signature), the
 * `Idempotency-Key` made for it, and — once the server answers — its code.
 *
 * Kept here rather than in the booking hook, so the code and the key outlive
 * the slip sheet closing: the key is the player's intent (it must be the same
 * on a retry after a remount), and the code is what they will read out at a
 * shop. It is not a cache of server data — it is dropped when the slip
 * changes or the code expires.
 */
export interface BookingIntent {
  signature: string;
  key: string;
  receipt: BookingReceipt | null;
  /** This device's clock when the receipt arrived, to time its expiry. */
  receivedAt: number | null;
}

/**
 * Placing this slip: the bet on its way, a bet the engine never answered, its
 * last refusal of the slip as it stands, and the ticket once issued.
 *
 * Kept here, not in the Place button, for the booking intent's reason: the
 * slip is mounted twice (the desktop aside and the phone sheet), and a sheet
 * closed mid-request unmounts its own. So every mounted slip sees a bet on its
 * way and cannot send a second one; a ticket that lands after the sheet closed
 * is still there when it opens; and an unanswered bet keeps its key.
 */
export interface Placement {
  /**
   * The signed-in player it was placed for. Shown and acted on only for them
   * (`ownPlacement`): never for a guest, and dropped when someone else signs
   * in — a shared phone hands over nothing.
   */
  owner: string | null;
  /** A bet on its way. */
  sending: PlaceAttempt | null;
  /**
   * A bet sent and never answered in a way that settles it — no response, a
   * 5xx, a reply this app could not read. It may exist, so it stays until a
   * ticket comes back: its own, or one for a bet the player chose to place
   * as new. No change to the slip drops it, and neither does a refusal — of
   * a retry or of the new bet — nor a lost session: none says the first try
   * failed (the engine records a key only once a bet commits, C08 §7).
   */
  unconfirmed: PlaceAttempt | null;
  /**
   * A Try again of the unconfirmed bet was refused for its prices or picks
   * (odds changed, a match started, a market suspended). Try again can still
   * find out whether the first try went through, but the slip no longer
   * offers it as the way to place what is on screen.
   */
  stale: boolean;
  /** The engine's no to an attempt, and the key of the attempt it answered. */
  refused: { key: string; problem: PlaceRefusal } | null;
  receipt: BetReceipt | null;
}

export const NO_PLACEMENT: Placement = {
  owner: null,
  sending: null,
  unconfirmed: null,
  stale: false,
  refused: null,
  receipt: null,
};

/** The placement if it is this player's; nothing for anyone else or a guest. */
export const ownPlacement = (
  placement: Placement,
  playerId: string | null,
): Placement =>
  playerId !== null && placement.owner === playerId ? placement : NO_PLACEMENT;

/**
 * One slip: its picks, its stake and what booking or placing it has done.
 * There are three (F3c, the user's decision of 2026-10-08), tabs a customer
 * switches between; the one on screen lives in the store's own fields, so
 * everything that reads the slip reads it, and the other two are parked in
 * `slips`.
 */
export interface SlipState {
  selections: BetSelection[];
  /**
   * Always `multiple` (F3c: Ethiopia bets accumulators); one live pick is
   * priced as a single, since a multiple needs two.
   */
  mode: BetSlipMode;
  /**
   * The **total** stake for the slip, as typed (`"100"`, `"12.5"`, or `""`).
   * slipcalc splits it across lines (D1.3); quick stakes set it (D7).
   */
  stake: string;
  /**
   * The stake has been set — to the rule set's minimum when the slip first
   * showed, by the customer, or by a loaded code — so the minimum is never
   * put back over it (`startStake`).
   */
  stakeStarted: boolean;
  systemK: number;
  /**
   * The player's answer to "when odds change" (`none` / `higher` / `any`), or
   * null for the tenant's `default_odds_policy`. Sent with the bet, and decides
   * which moves the slip asks about first.
   */
  oddsPolicy: OddsPolicy | null;
  /** What loading a booking code did, until the player dismisses it. */
  bookingNotice: BookingNotice | null;
  /**
   * Kept here, not in the Book button, so a code and its key survive the
   * sheet closing and the page changing: the same slip is never booked twice.
   */
  bookingIntent: BookingIntent | null;
  placement: Placement;
}

/** How many slips there are (F3c). */
export const SLIP_COUNT = 3;

const EMPTY_SLIP: SlipState = {
  selections: [],
  mode: "multiple",
  // None until the rules arrive; then the rule set's minimum (`startStake`).
  stake: "",
  stakeStarted: false,
  systemK: 2,
  oddsPolicy: null,
  bookingNotice: null,
  bookingIntent: null,
  placement: NO_PLACEMENT,
};

interface BetSlipState extends SlipState {
  /**
   * The slip on screen's outcomeId → true. Kept alongside the array so an odds
   * button's "am I in the slip?" check is O(1); the slip on screen's only, so
   * a price shows as picked for that slip alone.
   */
  index: Record<string, true>;
  /** Which slip is on screen: 0, 1 or 2. */
  active: number;
  /** Every slip; the one at `active` is stale — the store's fields are it. */
  slips: SlipState[];
  /**
   * The rule set's minimum, once the rules have arrived: each slip starts at
   * it the first time it is on screen (`startStake`, `switchSlip`,
   * `resetAll`).
   */
  minStake: string | null;

  /** Puts slip `n` on screen and parks the one that was. */
  switchSlip: (n: number) => void;
  /** Every slip empty and Slip 1 on screen (F8cc's idle reset; tests). */
  resetAll: () => void;

  setBookingIntent: (intent: BookingIntent | null) => void;
  /** The server issued a code: to the slip whose booking has this key. */
  bookingReceived: (key: string, receipt: BookingReceipt) => void;

  /**
   * Adds a pick, or takes it out when it is in the slip already. A pick from
   * a match the slip holds replaces that match's pick, in its place: a
   * multiple can't hold two (the user's decision, 2026-10-08).
   */
  toggleSelection: (selection: BetSelection) => void;
  removeSelection: (outcomeId: string) => void;
  /** Empties the slip on screen. */
  clear: () => void;
  /**
   * Replaces the slip with a loaded booking: its picks and stake, priced as a
   * multiple whatever type it was saved as (the notice says so).
   */
  replaceSlip: (slip: SlipFromBooking) => void;
  dismissBookingNotice: () => void;
  /** Says what a code held without touching the slip (nothing could be added). */
  showBookingNotice: (notice: BookingNotice) => void;

  setMode: (mode: BetSlipMode) => void;
  /** From the keyboard: keeps digits and up to two decimals. */
  setStake: (raw: string) => void;
  /**
   * The rules arrived with this minimum: remembered for every slip, and the
   * slip on screen starts at it unless its stake was set (`"10.00"` reads
   * `"10"`).
   */
  startStake: (minStake: string) => void;
  setSystemK: (k: number) => void;

  /** The player agrees to this pick's price as it is now. */
  acceptSelection: (outcomeId: string) => void;
  /** …and to every moved price at once. */
  acceptAllPending: () => void;
  setOddsPolicy: (policy: OddsPolicy | null) => void;

  /**
   * This request is on its way with this key, for this player, from the slip
   * on screen. An unconfirmed bet stays while it goes, even when this is a
   * different bet.
   */
  placementSent: (attempt: PlaceAttempt, owner: string) => void;
  /**
   * The bet on its way (`key`) had no answer that settles it: it is the
   * unconfirmed one now (each slip tracks one, the latest). Every answer
   * below goes to the slip that sent `key`, on screen or not.
   */
  placementUnanswered: (key: string) => void;
  /**
   * The engine refused the bet on its way (`key`). The picks it re-priced
   * show old → new (the price sent becomes the agreed one), and the ones
   * whose match started or market closed are suspended. A refusal of the
   * unconfirmed bet's prices or picks makes it `stale`.
   */
  placementRefused: (
    key: string,
    refusal: PlaceRefusal,
    updates?: { odds: OddsUpdate[]; closed: string[] },
  ) => void;
  /** The session ended while the bet (`key`) was on its way. */
  placementSessionEnded: (key: string) => void;
  /**
   * The engine issued a ticket for the bet on its way (`key`). Any ticket
   * ends an unconfirmed bet: it is that bet's, or the one the player chose to
   * place instead.
   */
  placementPlaced: (key: string, receipt: BetReceipt) => void;
  /** Back from the ticket to the same picks (Keep selections). */
  dismissReceipt: () => void;
  /**
   * Nothing of anyone's placing stays, in any slip: a full reset (tests). A
   * player change uses `forgetOtherPlayers`, which keeps the player's own.
   */
  forgetPlacement: () => void;
  /**
   * `playerId` is signed in: every slip's placing that was someone else's
   * goes; this player's own — a bet on its way, an unconfirmed one, a ticket
   * — stays wherever it is (review Q1/M1).
   */
  forgetOtherPlayers: (playerId: string) => void;

  /** Realtime: a price moved. Updates every slip in place, keeping `initialOdds`. */
  applyOddsUpdate: (ref: OutcomeRef, odds: string | null) => void;
  /** Realtime: an event's markets were suspended or reopened, in every slip. */
  applyEventSuspension: (eventId: string, suspended: boolean) => void;
}

const reindex = (selections: BetSelection[]): Record<string, true> =>
  Object.fromEntries(selections.map((s) => [s.outcomeId, true as const]));

/**
 * The slip changed: a refusal describes a slip that no longer exists, so it
 * goes. A bet on its way and an unconfirmed one stay — they are bets, not
 * descriptions of the slip.
 */
const changed = (p: Placement): Placement =>
  p.refused === null ? p : { ...p, refused: null };

const sameRef = (s: BetSelection, ref: OutcomeRef) =>
  s.eventId === ref.eventId &&
  s.marketType === ref.marketType &&
  s.line === ref.line &&
  s.outcomeCode === ref.outcomeCode;

/** The slip on screen, from the store's own fields. */
const onScreen = (s: BetSlipState): SlipState => ({
  selections: s.selections,
  mode: s.mode,
  stake: s.stake,
  stakeStarted: s.stakeStarted,
  systemK: s.systemK,
  oddsPolicy: s.oddsPolicy,
  bookingNotice: s.bookingNotice,
  bookingIntent: s.bookingIntent,
  placement: s.placement,
});

/**
 * Changes the slip that matches — the one on screen first, then the parked
 * ones — and returns the store's next fields; nothing when none matches.
 */
function inSlipWhere(
  state: BetSlipState,
  matches: (slip: SlipState) => boolean,
  update: (slip: SlipState) => Partial<SlipState>,
): Partial<BetSlipState> | null {
  const shown = onScreen(state);
  if (matches(shown)) {
    const next = update(shown);
    return next.selections
      ? { ...next, index: reindex(next.selections) }
      : next;
  }
  const i = state.slips.findIndex(
    (slip, n) => n !== state.active && matches(slip),
  );
  if (i < 0) return null;
  const slips = [...state.slips];
  slips[i] = { ...slips[i], ...update(slips[i]) };
  return { slips };
}

/** The same change to every slip, on screen and parked. */
function inEverySlip(
  state: BetSlipState,
  update: (slip: SlipState) => Partial<SlipState> | null,
): Partial<BetSlipState> {
  const next: Partial<BetSlipState> = {};
  const shown = update(onScreen(state));
  if (shown) {
    Object.assign(next, shown);
    if (shown.selections) next.index = reindex(shown.selections);
  }
  let moved = false;
  const slips = state.slips.map((slip, n) => {
    if (n === state.active) return slip;
    const change = update(slip);
    if (!change) return slip;
    moved = true;
    return { ...slip, ...change };
  });
  if (moved) next.slips = slips;
  return next;
}

/** A slip's starting stake: the minimum, once, unless it has one. */
const started = (
  slip: SlipState,
  minStake: string | null,
): Partial<SlipState> =>
  minStake && !slip.stakeStarted && slip.stake === ""
    ? { stake: minStake.replace(/\.00$/, ""), stakeStarted: true }
    : {};

/** Only a real change notifies: an update for no slip changes nothing. */
const changes = (next: object) => Object.keys(next).length > 0;

const sending = (key: string) => (slip: SlipState) =>
  slip.placement.sending?.key === key;

/**
 * The bet slips.
 *
 * Its own store rather than a slice of UI state, because a betting selection is
 * a domain object with rules — same-match picks, suspension, accepting a
 * price move — not a piece of chrome.
 *
 * It holds no money maths: `lib/calculate.ts` derives every total from the slip
 * on screen, and the backend is authoritative when the bet is actually placed.
 */
export const useBetSlipStore = create<BetSlipState>()((set, get) => ({
  ...EMPTY_SLIP,
  index: {},
  active: 0,
  slips: Array.from({ length: SLIP_COUNT }, () => EMPTY_SLIP),
  minStake: null,

  switchSlip: (n) => {
    const state = get();
    if (n === state.active || n < 0 || n >= SLIP_COUNT) return;
    const slips = [...state.slips];
    slips[state.active] = onScreen(state);
    const next = { ...slips[n], ...started(slips[n], state.minStake) };
    set({ ...next, index: reindex(next.selections), active: n, slips });
  },

  resetAll: () =>
    set((state) => ({
      ...EMPTY_SLIP,
      ...started(EMPTY_SLIP, state.minStake),
      index: {},
      active: 0,
      slips: Array.from({ length: SLIP_COUNT }, () => EMPTY_SLIP),
    })),

  toggleSelection: (selection) => {
    const { selections, placement } = get();
    let next: BetSelection[];
    if (selections.some((s) => s.outcomeId === selection.outcomeId)) {
      next = selections.filter((s) => s.outcomeId !== selection.outcomeId);
    } else {
      const sameMatch = selections.findIndex(
        (s) => s.eventId === selection.eventId,
      );
      next =
        sameMatch < 0
          ? [...selections, selection]
          : selections.map((s, i) => (i === sameMatch ? selection : s));
    }
    // Once the player changes a loaded slip it is theirs: the notice about
    // what the booking brought no longer describes it.
    set({
      selections: next,
      index: reindex(next),
      bookingNotice: null,
      placement: changed(placement),
    });
  },

  removeSelection: (outcomeId) => {
    const next = get().selections.filter((s) => s.outcomeId !== outcomeId);
    set({
      selections: next,
      index: reindex(next),
      bookingNotice: null,
      placement: changed(get().placement),
    });
  },

  clear: () =>
    set((state) => ({
      selections: [],
      index: {},
      oddsPolicy: null,
      bookingNotice: null,
      bookingIntent: null,
      // Clearing the picks clears what was said about them; a bet on its way
      // or unconfirmed is still a bet.
      placement: { ...state.placement, refused: null, receipt: null },
    })),

  replaceSlip: ({ selections, stake, notice }) =>
    set((state) => ({
      selections,
      index: reindex(selections),
      // Priced as a multiple, whatever it was saved as (F3c).
      mode: "multiple",
      stake: stake ?? state.stake,
      stakeStarted: state.stakeStarted || stake !== null,
      // A loaded slip starts on the tenant's own policy, never on a standing
      // "accept any" from the slip it replaced.
      oddsPolicy: null,
      bookingNotice: notice,
      placement: changed(state.placement),
    })),

  dismissBookingNotice: () => set({ bookingNotice: null }),
  showBookingNotice: (bookingNotice) => set({ bookingNotice }),
  setBookingIntent: (bookingIntent) => set({ bookingIntent }),
  bookingReceived: (key, receipt) => {
    const next = inSlipWhere(
      get(),
      (slip) => slip.bookingIntent?.key === key,
      (slip) => ({
        bookingIntent: {
          ...slip.bookingIntent!,
          receipt,
          receivedAt: Date.now(),
        },
      }),
    );
    if (next) set(next);
  },

  setMode: (mode) => set({ mode, placement: changed(get().placement) }),
  setStake: (raw) =>
    set({
      stake: sanitiseAmount(raw),
      stakeStarted: true,
      placement: changed(get().placement),
    }),
  startStake: (minStake) =>
    set((state) => ({ minStake, ...started(onScreen(state), minStake) })),
  setSystemK: (systemK) =>
    set({ systemK, placement: changed(get().placement) }),

  // Agreeing makes the shown price the agreed one, so a later move from it is
  // a new move to ask about — accepted once is not accepted for good.
  acceptSelection: (outcomeId) =>
    set({
      selections: get().selections.map((s) =>
        s.outcomeId === outcomeId ? { ...s, initialOdds: s.currentOdds } : s,
      ),
      placement: changed(get().placement),
    }),

  acceptAllPending: () =>
    set({
      selections: get().selections.map((s) =>
        oddsMoved(s) ? { ...s, initialOdds: s.currentOdds } : s,
      ),
      placement: changed(get().placement),
    }),

  setOddsPolicy: (oddsPolicy) =>
    set({ oddsPolicy, placement: changed(get().placement) }),

  placementSent: (attempt, owner) =>
    set((state) => {
      const current =
        state.placement.owner === owner ? state.placement : NO_PLACEMENT;
      return {
        placement: {
          ...current,
          owner,
          sending: attempt,
          refused: null,
          receipt: null,
        },
      };
    }),

  // An answer lands only on the bet that asked, in the slip that sent it: one
  // for an attempt no longer on its way (forgotten when another player signed
  // in) changes nothing.
  placementUnanswered: (key) => {
    const next = inSlipWhere(get(), sending(key), ({ placement }) => {
      const again = placement.unconfirmed?.key === key;
      return {
        placement: {
          ...placement,
          sending: null,
          unconfirmed: placement.sending,
          stale: again && placement.stale,
        },
      };
    });
    if (next) set(next);
  },

  placementRefused: (key, refusal, updates) => {
    const next = inSlipWhere(
      get(),
      sending(key),
      ({ placement, selections }) => {
        const retried = placement.unconfirmed?.key === key;
        const odds = new Map(updates?.odds.map((u) => [u.outcomeId, u]));
        const closed = new Set(updates?.closed);
        return {
          selections:
            odds.size + closed.size === 0
              ? selections
              : selections.map((s) => {
                  const update = odds.get(s.outcomeId);
                  if (update) {
                    return {
                      ...s,
                      initialOdds: update.sent,
                      currentOdds: update.current,
                    };
                  }
                  return closed.has(s.outcomeId)
                    ? { ...s, suspended: true }
                    : s;
                }),
          placement: {
            ...placement,
            sending: null,
            stale: placement.stale || (retried && refusesPicks(refusal)),
            refused: { key, problem: refusal },
          },
        };
      },
    );
    if (next) set(next);
  },

  placementSessionEnded: (key) => {
    const next = inSlipWhere(get(), sending(key), ({ placement }) => ({
      placement: { ...placement, sending: null },
    }));
    if (next) set(next);
  },

  placementPlaced: (key, receipt) => {
    const next = inSlipWhere(get(), sending(key), ({ placement }) => ({
      placement: {
        ...placement,
        sending: null,
        unconfirmed: null,
        stale: false,
        refused: null,
        receipt,
      },
    }));
    if (next) set(next);
  },

  dismissReceipt: () =>
    set({ placement: { ...get().placement, receipt: null } }),

  forgetPlacement: () =>
    set(inEverySlip(get(), () => ({ placement: NO_PLACEMENT }))),

  forgetOtherPlayers: (playerId) => {
    const next = inEverySlip(get(), ({ placement }) =>
      placement.owner !== null && placement.owner !== playerId
        ? { placement: NO_PLACEMENT }
        : null,
    );
    if (changes(next)) set(next);
  },

  applyOddsUpdate: (ref, odds) => {
    const next = inEverySlip(get(), (slip) =>
      slip.selections.some((s) => sameRef(s, ref))
        ? {
            selections: slip.selections.map((s) =>
              sameRef(s, ref)
                ? {
                    ...s,
                    // A closed price suspends the leg rather than pricing it at zero.
                    suspended: odds === null,
                    currentOdds: odds ?? s.currentOdds,
                  }
                : s,
            ),
          }
        : null,
    );
    if (changes(next)) set(next);
  },

  applyEventSuspension: (eventId, suspended) => {
    const next = inEverySlip(get(), (slip) =>
      slip.selections.some((s) => s.eventId === eventId)
        ? {
            selections: slip.selections.map((s) =>
              s.eventId === eventId ? { ...s, suspended } : s,
            ),
          }
        : null,
    );
    if (changes(next)) set(next);
  },
}));

/** How many picks each slip holds, for its tab. */
export const slipCounts = (state: {
  active: number;
  selections: BetSelection[];
  slips: SlipState[];
}): number[] =>
  state.slips.map((slip, n) =>
    n === state.active ? state.selections.length : slip.selections.length,
  );

/** Each slip's count, re-rendering only when one changes. */
export const useSlipCounts = (): number[] =>
  useBetSlipStore(useShallow(slipCounts));

/** Narrow selector so one odds button re-renders when its own state flips. */
export const useIsSelected = (outcomeId: string): boolean =>
  useBetSlipStore((s) => s.index[outcomeId] === true);

/** True when any pick on this event is in the slip — used to tint the row. */
export const useEventHasSelection = (eventId: string): boolean =>
  useBetSlipStore((s) => s.selections.some((x) => x.eventId === eventId));

/** Builds a slip selection from a board or detail market outcome. */
export function selectionFrom(args: {
  outcomeId: string;
  ref: OutcomeRef;
  marketId: string;
  eventName: BetSelection["eventName"];
  marketName: BetSelection["marketName"];
  outcomeName: BetSelection["outcomeName"];
  /** The contract's decimal string. */
  odds: string;
}): BetSelection {
  return {
    outcomeId: args.outcomeId,
    eventId: args.ref.eventId,
    marketId: args.marketId,
    marketType: args.ref.marketType,
    line: args.ref.line,
    outcomeCode: args.ref.outcomeCode,
    eventName: args.eventName,
    marketName: args.marketName,
    outcomeName: args.outcomeName,
    initialOdds: args.odds,
    currentOdds: args.odds,
    suspended: false,
  };
}
