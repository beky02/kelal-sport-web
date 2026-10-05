import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import type { Player } from "@/features/auth/types";
import { RealityCheckWatcher } from "@/features/system/hooks/use-reality-check";
import { SystemOverlays } from "@/features/system/components/SystemOverlays";
import { routes } from "@/config/routes";
import en from "@/lib/i18n/messages/en.json";
import { sessionKeys } from "@/lib/query/keys";
import {
  REALITY_CHECK_STORAGE_KEY,
  useRealityCheckStore,
} from "@/stores/reality-check.store";
import { useSystemStore } from "@/stores/system.store";
import { useUiStore } from "@/stores/ui.store";
import { CONTRACT_PLAYER, render } from "./render";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

const MIN = 60_000;
const T0 = Date.parse("2026-10-05T09:00:00Z");

/** Prism's player: the account's interval is 60 minutes. */
const every = (minutes: number | null): Player => ({
  ...CONTRACT_PLAYER,
  flags: { ...CONTRACT_PLAYER.flags, realityCheckMinutes: minutes },
});

const dialog = () => screen.queryByRole("alertdialog");
const play = (minutes: number) =>
  act(() => {
    vi.advanceTimersByTime(minutes * MIN);
  });
const press = (name: string) =>
  act(() => {
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name }),
    );
  });

const NO_VISIT = {
  playerId: null,
  startedAt: null,
  answeredAt: null,
  shownAt: null,
};

/**
 * A reload: the page's state is gone, the tab's `sessionStorage` isn't. (The
 * store writes every change through, so what it held is put back first.)
 */
async function reload() {
  const saved = sessionStorage.getItem(REALITY_CHECK_STORAGE_KEY);
  useRealityCheckStore.setState(NO_VISIT);
  useSystemStore.setState({ overlay: null });
  if (saved) sessionStorage.setItem(REALITY_CHECK_STORAGE_KEY, saved);
  await act(() => useRealityCheckStore.persist.rehydrate());
}

const mount = (session: Player | "guest" = every(60)) =>
  render(
    <>
      <RealityCheckWatcher />
      <SystemOverlays />
    </>,
    { session },
  );

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  sessionStorage.clear();
  useRealityCheckStore.setState(NO_VISIT);
  useSystemStore.setState({ overlay: null, loggedOut: false, online: true });
  useUiStore.setState({ lang: "en" });
  push.mockReset();
  // Nothing about the reality check is read from anywhere but `/api/me`.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    throw new Error(`unexpected fetch ${String(input)}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the reality check (AC-10)", () => {
  it("opens after the account's interval of play, not a minute before", () => {
    mount();

    play(59);
    expect(dialog()).toBeNull();

    play(1);
    expect(dialog()).toHaveTextContent(en.system.realityTitle);
    expect(dialog()).toHaveTextContent("You’ve been playing for 1 h.");
  });

  it("Keep playing closes it and it opens again one interval later", () => {
    mount();
    play(60);

    press(en.system.realityKeepPlaying);
    expect(dialog()).toBeNull();

    play(59);
    expect(dialog()).toBeNull();
    play(1);
    expect(dialog()).toHaveTextContent("You’ve been playing for 2 h.");
  });

  it("follows the account's interval (30 min)", () => {
    mount(every(30));

    play(29);
    expect(dialog()).toBeNull();
    play(1);
    expect(dialog()).toHaveTextContent("You’ve been playing for 30 min.");

    press(en.system.realityKeepPlaying);
    play(60);
    // Answered at 30: due at 60 and opened then, 90 not yet.
    expect(dialog()).toHaveTextContent("You’ve been playing for 1 h.");
  });

  it("says hours and minutes when it opened late", () => {
    mount(every(60));
    // Another dialog is up when the check comes due: it waits for it.
    act(() => useSystemStore.getState().show("session"));

    play(90);
    expect(screen.getByRole("alertdialog")).not.toHaveTextContent(
      en.system.realityTitle,
    );

    act(() => useSystemStore.getState().dismiss());
    play(0);
    expect(dialog()).toHaveTextContent("You’ve been playing for 1 h 30 min.");
  });

  it("never opens without an interval or for a guest", () => {
    const { unmount } = mount(every(null));
    play(5 * 60);
    expect(dialog()).toBeNull();
    unmount();

    mount("guest");
    play(5 * 60);
    expect(dialog()).toBeNull();
  });

  it("a reload neither restarts the clock nor skips a check that came due", async () => {
    const first = mount();
    play(40);
    first.unmount();

    await reload();
    const second = mount();

    play(19);
    expect(dialog()).toBeNull();
    play(1);
    expect(dialog()).toHaveTextContent("You’ve been playing for 1 h.");

    // Reloaded with the check on screen: it is still there afterwards.
    second.unmount();
    await reload();
    mount();
    play(0);
    expect(dialog()).toHaveTextContent(en.system.realityTitle);
  });

  it("another player signing in starts a visit of their own", () => {
    const { queryClient } = mount();
    play(50);

    act(() => {
      queryClient.setQueryData(sessionKeys.me(), {
        player: { ...every(60), id: "01J9A7R0000000000000000099" },
      });
    });
    // The query tells its screens on the next tick; a browser renders then.
    play(0);
    play(10);
    expect(dialog()).toBeNull();

    play(50);
    expect(dialog()).toHaveTextContent("You’ve been playing for 1 h.");
  });

  it("signing out and in again starts a new visit", () => {
    const { queryClient } = mount();
    play(50);

    act(() => {
      queryClient.setQueryData(sessionKeys.me(), { player: null });
    });
    play(0);
    act(() => {
      queryClient.setQueryData(sessionKeys.me(), { player: every(60) });
    });
    play(0);

    play(10);
    expect(dialog()).toBeNull();
    play(50);
    expect(dialog()).toHaveTextContent("You’ve been playing for 1 h.");
  });

  it("Take a break and View my limits answer it and open Responsible gaming", () => {
    mount();
    play(60);

    press(en.system.realityTakeBreak);
    expect(dialog()).toBeNull();
    expect(push).toHaveBeenLastCalledWith(routes.responsibleGaming);

    play(60);
    press(en.system.realityMyLimits);
    expect(dialog()).toBeNull();
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenLastCalledWith(routes.responsibleGaming);

    play(59);
    expect(dialog()).toBeNull();
  });

  it("shows the time played and no money figures", () => {
    mount();
    play(60);

    const shown = screen.getByRole("alertdialog");
    for (const word of ["Staked", "Won", "Net", "ETB"]) {
      expect(shown).not.toHaveTextContent(word);
    }
    expect(within(shown).getAllByRole("button")).toHaveLength(3);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
