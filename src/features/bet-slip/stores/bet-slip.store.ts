"use client";

import { create } from "zustand";
import { BETTING } from "@/config/constants";
import { outcomeKey, type OutcomeRef } from "@/features/markets/types";
import type { BetSelection, BetSlipMode } from "../types";

interface BetSlipState {
  selections: BetSelection[];
  /**
   * uid → true. Kept alongside the array so an odds button's "am I in the slip?"
   * check is O(1) and does not walk the list on every render.
   */
  index: Record<string, true>;

  mode: BetSlipMode;
  /** Per bet: per selection in single, per combination in system. */
  stake: number;
  systemK: number;

  /** Odds moves the user accepted one at a time. */
  acceptedUids: Set<string>;
  /** Standing consent to any move, from the toggle at the foot of the slip. */
  acceptAnyChange: boolean;

  toggleSelection: (selection: BetSelection) => void;
  removeSelection: (uid: string) => void;
  clear: () => void;

  setMode: (mode: BetSlipMode) => void;
  setStake: (stake: number) => void;
  addToStake: (amount: number) => void;
  setSystemK: (k: number) => void;

  acceptSelection: (uid: string) => void;
  acceptAllPending: () => void;
  setAcceptAnyChange: (on: boolean) => void;

  /** Realtime: a price moved. Updates in place, keeping `initialOdds`. */
  applyOddsUpdate: (ref: OutcomeRef, odds: number | null) => void;
  /** Realtime: an event's markets were suspended or reopened. */
  applyEventSuspension: (eventId: string, suspended: boolean) => void;
}

const reindex = (selections: BetSelection[]): Record<string, true> =>
  Object.fromEntries(selections.map((s) => [s.uid, true as const]));

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
  acceptedUids: new Set<string>(),
  acceptAnyChange: false,

  toggleSelection: (selection) => {
    const { selections } = get();
    const next = selections.some((s) => s.uid === selection.uid)
      ? selections.filter((s) => s.uid !== selection.uid)
      : [...selections, selection];
    set({ selections: next, index: reindex(next) });
  },

  removeSelection: (uid) => {
    const next = get().selections.filter((s) => s.uid !== uid);
    set({ selections: next, index: reindex(next) });
  },

  clear: () =>
    set({
      selections: [],
      index: {},
      acceptedUids: new Set<string>(),
      acceptAnyChange: false,
    }),

  setMode: (mode) => set({ mode }),
  // Stakes are whole birr and never negative.
  setStake: (stake) => set({ stake: Math.max(0, Math.floor(stake) || 0) }),
  addToStake: (amount) => set({ stake: get().stake + amount }),
  setSystemK: (systemK) => set({ systemK }),

  acceptSelection: (uid) =>
    set({ acceptedUids: new Set(get().acceptedUids).add(uid) }),

  acceptAllPending: () => {
    const accepted = new Set(get().acceptedUids);
    for (const s of get().selections) {
      if (s.currentOdds !== s.initialOdds) accepted.add(s.uid);
    }
    set({ acceptedUids: accepted });
  },

  setAcceptAnyChange: (acceptAnyChange) => set({ acceptAnyChange }),

  applyOddsUpdate: (ref, odds) => {
    const uid = outcomeKey(ref);
    if (!get().index[uid]) return;

    set({
      selections: get().selections.map((s) =>
        s.uid === uid
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
export const useIsSelected = (uid: string): boolean =>
  useBetSlipStore((s) => s.index[uid] === true);

/** True when any pick on this event is in the slip — used to tint the row. */
export const useEventHasSelection = (eventId: string): boolean =>
  useBetSlipStore((s) => s.selections.some((x) => x.eventId === eventId));

/** Builds a slip selection from a board or detail market outcome. */
export function selectionFrom(args: {
  ref: OutcomeRef;
  marketId: string;
  eventName: BetSelection["eventName"];
  marketName: BetSelection["marketName"];
  outcomeName: BetSelection["outcomeName"];
  odds: number;
}): BetSelection {
  return {
    uid: outcomeKey(args.ref),
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
