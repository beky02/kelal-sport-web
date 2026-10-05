import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Player } from "@/features/auth/types";
import { CoolOffBanner } from "@/features/system/components/StatusBanners";
import { useSystemStore } from "@/stores/system.store";
import { useUiStore } from "@/stores/ui.store";
import { CONTRACT_PLAYER, render } from "./render";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: vi.fn(() => "/"),
}));

/** The contract's player on a break until `until`, as `/v1/me` reports it. */
const onBreakUntil = (until: string): Player => ({
  ...CONTRACT_PLAYER,
  flags: { ...CONTRACT_PLAYER.flags, excludedUntil: until },
});

beforeEach(() => {
  push.mockClear();
  useUiStore.setState({ lang: "en", clock: "eat", calendar: "gregorian" });
  useSystemStore.setState({ overlay: null, loggedOut: false, online: true });
});

afterEach(() => vi.restoreAllMocks());

describe("the break banner", () => {
  it("shows the break /api/me reports, with its end, and View limits", async () => {
    // 15:00 UTC is 18:00 in East Africa Time.
    render(<CoolOffBanner />, {
      session: onBreakUntil("2026-10-10T15:00:00Z"),
    });

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Break active until 10 Oct 2026, 18:00.");
    expect(banner).toHaveTextContent("Betting and deposits are paused.");
    await userEvent.click(screen.getByRole("button", { name: "View limits" }));
    expect(push).toHaveBeenCalledWith("/responsible-gaming");
  });

  it("says a permanent self-exclusion is active, with no end date", () => {
    render(<CoolOffBanner />, {
      session: { ...CONTRACT_PLAYER, status: "self_excluded" },
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Self-exclusion active. Betting and deposits are stopped.",
    );
  });

  it("shows the end in the player's calendar and clock", () => {
    useUiStore.setState({ lang: "am", clock: "eth", calendar: "ethiopian" });
    render(<CoolOffBanner />, {
      session: onBreakUntil("2026-10-10T15:00:00Z"),
    });

    // 18:00 EAT is 12 in the evening on the Ethiopian clock; 10 Oct 2026 is
    // Tikimt 1, 2019.
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("ዕረፍት እስከ");
    expect(banner).toHaveTextContent("2019");
    expect(banner).toHaveTextContent("12:00");
  });

  it("shows nothing without a break, and nothing for a guest", () => {
    const { unmount } = render(<CoolOffBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    unmount();

    render(<CoolOffBanner />, { session: "guest" });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
