"use client";

import { create } from "zustand";
import { BETTING } from "@/config/constants";
import type { OutcomeRef } from "@/features/markets/types";
import type {
  BookingNotice,
  SlipFromBooking,
} from "@/features/bookings/lib/to-slip";
import type { BookingReceipt } from "@/features/bookings/types";

import { oddsMoved, type BetSelection, type BetSlipMode } from "../types";

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

  /** Odds moves the user accepted one at a time, by outcomeId. */
  acceptedIds: Set<string>;
  /** Standing consent to any move, from the toggle at the foot of the slip. */
  acceptAnyChange: boolean;

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

  acceptSelection: (outcomeId: string) => void;
  acceptAllPending: () => void;
  setAcceptAnyChange: (on: boolean) => void;

  /** Realtime: a price moved. Updates in place, keeping `initialOdds`. */
  applyOddsUpdate: (ref: OutcomeRef, odds: string | null) => void;
  /** Realtime: an event's markets were suspended or reopened. */
  applyEventSuspension: (eventId: string, suspended: boolean) => void;
}

const reindex = (selections: BetSelection[]): Record<string, true> =>
  Object.fromEntries(selections.map((s) => [s.outcomeId, true as const]));

/** `"0012.345x"` → `"12.34"`: digits, one point, two decimals at most. */
export function sanitiseStake(raw: string): string {
  const [whole = "", ...rest] = raw.replace(/[^\d.]/g, "").split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  return rest.length
    ? `${integer || "0"}.${rest.join("").slice(0, 2)}`
    : integer;
}

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
  stake: BETTING.defaultStake,
  systemK: 2,
  acceptedIds: new Set<string>(),
  acceptAnyChange: false,
  bookingNotice: null,
  bookingIntent: null,

  toggleSelection: (selection) => {
    const { selections } = get();
    const next = selections.some((s) => s.outcomeId === selection.outcomeId)
      ? selections.filter((s) => s.outcomeId !== selection.outcomeId)
      : [...selections, selection];
    // Once the player changes a loaded slip it is theirs: the notice about
    // what the booking brought no longer describes it.
    set({ selections: next, index: reindex(next), bookingNotice: null });
  },

  removeSelection: (outcomeId) => {
    const next = get().selections.filter((s) => s.outcomeId !== outcomeId);
    set({ selections: next, index: reindex(next), bookingNotice: null });
  },

  clear: () =>
    set({
      selections: [],
      index: {},
      acceptedIds: new Set<string>(),
      acceptAnyChange: false,
      bookingNotice: null,
      bookingIntent: null,
    }),

  replaceSlip: ({ selections, mode, systemK, stake, notice }) =>
    set((state) => ({
      selections,
      index: reindex(selections),
      mode,
      systemK: systemK ?? state.systemK,
      stake: stake ?? state.stake,
      acceptedIds: new Set<string>(),
      acceptAnyChange: false,
      bookingNotice: notice,
    })),

  dismissBookingNotice: () => set({ bookingNotice: null }),
  showBookingNotice: (bookingNotice) => set({ bookingNotice }),
  setBookingIntent: (bookingIntent) => set({ bookingIntent }),

  setMode: (mode) => set({ mode }),
  setStake: (raw) => set({ stake: sanitiseStake(raw) }),
  setSystemK: (systemK) => set({ systemK }),

  acceptSelection: (outcomeId) =>
    set({ acceptedIds: new Set(get().acceptedIds).add(outcomeId) }),

  acceptAllPending: () => {
    const accepted = new Set(get().acceptedIds);
    for (const s of get().selections) {
      if (oddsMoved(s)) accepted.add(s.outcomeId);
    }
    set({ acceptedIds: accepted });
  },

  setAcceptAnyChange: (acceptAnyChange) => set({ acceptAnyChange }),

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
