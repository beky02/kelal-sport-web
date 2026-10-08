"use client";

import { create } from "zustand";
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

interface BetSlipState {
  selections: BetSelection[];
  /**
   * outcomeId → true. Kept alongside the array so an odds button's "am I in the
   * slip?" check is O(1) and does not walk the list on every render.
   */
  index: Record<string, true>;

  mode: BetSlipMode;
  /**
   * The **total** stake for the slip, as typed (`"100"`, `"12.5"`, or `""`).
   * slipcalc splits it across lines (D1.3); quick stakes set it (D7).
   */
  stake: string;
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
  setBookingIntent: (intent: BookingIntent | null) => void;

  toggleSelection: (selection: BetSelection) => void;
  removeSelection: (outcomeId: string) => void;
  clear: () => void;
  /**
   * Replaces the slip with a loaded booking: a booking is a whole slip — its
   * picks, bet type and stake — so it is not merged into what was there.
   */
  replaceSlip: (slip: SlipFromBooking) => void;
  dismissBookingNotice: () => void;
  /** Says what a code held without touching the slip (nothing could be added). */
  showBookingNotice: (notice: BookingNotice) => void;

  setMode: (mode: BetSlipMode) => void;
  /** From the keyboard: keeps digits and up to two decimals. */
  setStake: (raw: string) => void;
  setSystemK: (k: number) => void;

  /** The player agrees to this pick's price as it is now. */
  acceptSelection: (outcomeId: string) => void;
  /** …and to every moved price at once. */
  acceptAllPending: () => void;
  setOddsPolicy: (policy: OddsPolicy | null) => void;

  placement: Placement;
  /**
   * This request is on its way with this key, for this player. An
   * unconfirmed bet stays while it goes, even when this is a different bet.
   */
  placementSent: (attempt: PlaceAttempt, owner: string) => void;
  /**
   * The bet on its way (`key`) had no answer that settles it: it is the
   * unconfirmed one now (the slip tracks one, the latest).
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
  /** Another player is signed in: nothing of the last one's placing stays. */
  forgetPlacement: () => void;

  /** Realtime: a price moved. Updates in place, keeping `initialOdds`. */
  applyOddsUpdate: (ref: OutcomeRef, odds: string | null) => void;
  /** Realtime: an event's markets were suspended or reopened. */
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

/**
 * The bet slip.
 *
 * Its own store rather than a slice of UI state, because a betting selection is
 * a domain object with rules — same-match conflicts, suspension, accepting a
 * price move — not a piece of chrome.
 *
 * It holds no money maths: `lib/calculate.ts` derives every total from this
 * state, and the backend is authoritative when the bet is actually placed.
 */
export const useBetSlipStore = create<BetSlipState>()((set, get) => ({
  selections: [],
  index: {},
  mode: "multiple",
  // None until the rules arrive; then the rule set's minimum
  // (`useStartingStake`, the user's decision of 2026-10-08).
  stake: "",
  systemK: 2,
  oddsPolicy: null,
  bookingNotice: null,
  bookingIntent: null,
  placement: NO_PLACEMENT,

  toggleSelection: (selection) => {
    const { selections, placement } = get();
    const next = selections.some((s) => s.outcomeId === selection.outcomeId)
      ? selections.filter((s) => s.outcomeId !== selection.outcomeId)
      : [...selections, selection];
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

  replaceSlip: ({ selections, mode, systemK, stake, notice }) =>
    set((state) => ({
      selections,
      index: reindex(selections),
      mode,
      systemK: systemK ?? state.systemK,
      stake: stake ?? state.stake,
      // A loaded slip starts on the tenant's own policy, never on a standing
      // "accept any" from the slip it replaced.
      oddsPolicy: null,
      bookingNotice: notice,
      placement: changed(state.placement),
    })),

  dismissBookingNotice: () => set({ bookingNotice: null }),
  showBookingNotice: (bookingNotice) => set({ bookingNotice }),
  setBookingIntent: (bookingIntent) => set({ bookingIntent }),

  setMode: (mode) => set({ mode, placement: changed(get().placement) }),
  setStake: (raw) =>
    set({ stake: sanitiseAmount(raw), placement: changed(get().placement) }),
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

  // An answer lands only on the bet that asked: one for an attempt no longer
  // on its way (forgotten when another player signed in) changes nothing.
  placementUnanswered: (key) => {
    const { placement } = get();
    if (placement.sending?.key !== key) return;
    const again = placement.unconfirmed?.key === key;
    set({
      placement: {
        ...placement,
        sending: null,
        unconfirmed: placement.sending,
        stale: again && placement.stale,
      },
    });
  },

  placementRefused: (key, refusal, updates) => {
    const { placement, selections } = get();
    if (placement.sending?.key !== key) return;
    const retried = placement.unconfirmed?.key === key;
    const odds = new Map(updates?.odds.map((u) => [u.outcomeId, u]));
    const closed = new Set(updates?.closed);
    set({
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
              return closed.has(s.outcomeId) ? { ...s, suspended: true } : s;
            }),
      placement: {
        ...placement,
        sending: null,
        stale: placement.stale || (retried && refusesPicks(refusal)),
        refused: { key, problem: refusal },
      },
    });
  },

  placementSessionEnded: (key) => {
    const { placement } = get();
    if (placement.sending?.key !== key) return;
    set({ placement: { ...placement, sending: null } });
  },

  placementPlaced: (key, receipt) => {
    const { placement } = get();
    if (placement.sending?.key !== key) return;
    set({
      placement: {
        ...placement,
        sending: null,
        unconfirmed: null,
        stale: false,
        refused: null,
        receipt,
      },
    });
  },

  dismissReceipt: () =>
    set({ placement: { ...get().placement, receipt: null } }),

  forgetPlacement: () => set({ placement: NO_PLACEMENT }),

  applyOddsUpdate: (ref, odds) => {
    if (!get().selections.some((s) => sameRef(s, ref))) return;

    set({
      selections: get().selections.map((s) =>
        sameRef(s, ref)
          ? {
              ...s,
              // A closed price suspends the leg rather than pricing it at zero.
              suspended: odds === null,
              currentOdds: odds ?? s.currentOdds,
            }
          : s,
      ),
    });
  },

  applyEventSuspension: (eventId, suspended) => {
    const { selections } = get();
    if (!selections.some((s) => s.eventId === eventId)) return;
    set({
      selections: selections.map((s) =>
        s.eventId === eventId ? { ...s, suspended } : s,
      ),
    });
  },
}));

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
