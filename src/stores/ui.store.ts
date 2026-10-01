"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  CalendarSystem,
  ClockConvention,
  Lang,
  Theme,
} from "@/types/common";

export const UI_STORAGE_KEY = "kelal.ui";

export type AsidePanel = "slip" | "bets";

interface UiState {
  // ── preferences (persisted) ──────────────────────────────────────────────
  theme: Theme;
  lang: Lang;
  clock: ClockConvention;
  calendar: CalendarSystem;
  /** Drops flags and crests. Matters on a metered connection. */
  dataSaver: boolean;

  // ── transient UI ─────────────────────────────────────────────────────────
  /** The slip is a bottom sheet below the 3-column breakpoint. */
  mobileSlipOpen: boolean;
  sidebarOpen: boolean;
  asidePanel: AsidePanel;
  expandedCountries: Record<string, boolean>;
  favouriteEvents: Record<string, boolean>;
  favouriteCompetitions: Record<string, boolean>;

  setTheme: (theme: Theme) => void;
  setLang: (lang: Lang) => void;
  setClock: (clock: ClockConvention) => void;
  setCalendar: (calendar: CalendarSystem) => void;
  setDataSaver: (on: boolean) => void;

  setMobileSlipOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setAsidePanel: (panel: AsidePanel) => void;
  toggleCountry: (code: string) => void;
  toggleFavouriteEvent: (id: string) => void;
  toggleFavouriteCompetition: (id: string) => void;
}

/**
 * Client state only: preferences and what is open.
 *
 * Events, odds, balances and bets are NOT here — those are server-owned and
 * live in TanStack Query. Board filters are not here either: sport, date and
 * filter belong in the URL so refresh, back and sharing all work.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      lang: "en",
      clock: "eat",
      calendar: "gregorian",
      dataSaver: false,

      mobileSlipOpen: false,
      sidebarOpen: false,
      asidePanel: "slip",
      expandedCountries: {},
      favouriteEvents: {},
      favouriteCompetitions: {},

      setTheme: (theme) => set({ theme }),
      setLang: (lang) => set({ lang }),
      setClock: (clock) => set({ clock }),
      setCalendar: (calendar) => set({ calendar }),
      setDataSaver: (dataSaver) => set({ dataSaver }),

      setMobileSlipOpen: (mobileSlipOpen) => set({ mobileSlipOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setAsidePanel: (asidePanel) => set({ asidePanel }),

      toggleCountry: (code) =>
        set({
          expandedCountries: {
            ...get().expandedCountries,
            [code]: !get().expandedCountries[code],
          },
        }),
      toggleFavouriteEvent: (id) =>
        set({
          favouriteEvents: {
            ...get().favouriteEvents,
            [id]: !get().favouriteEvents[id],
          },
        }),
      toggleFavouriteCompetition: (id) =>
        set({
          favouriteCompetitions: {
            ...get().favouriteCompetitions,
            [id]: !get().favouriteCompetitions[id],
          },
        }),
    }),
    {
      name: UI_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only preferences survive a reload. What was open should not.
      partialize: (state) => ({
        theme: state.theme,
        lang: state.lang,
        clock: state.clock,
        calendar: state.calendar,
        dataSaver: state.dataSaver,
        favouriteEvents: state.favouriteEvents,
        favouriteCompetitions: state.favouriteCompetitions,
      }),
    },
  ),
);
