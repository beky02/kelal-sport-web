import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppHeader } from "@/components/layout/AppHeader";
import { SessionWatcher } from "@/features/auth/hooks/use-session";
import { ProfileView } from "@/features/profile/components/ProfileView";
import { SystemOverlays } from "@/features/system/components/SystemOverlays";
import { sessionKeys } from "@/lib/query/keys";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import am from "@/lib/i18n/messages/am.json";
import { useSystemStore } from "@/stores/system.store";
import { useUiStore } from "@/stores/ui.store";
import { render } from "./render";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
}));

interface Sent {
  method: string;
  path: string;
  headers: Headers;
}
let sent: Sent[] = [];
function api(answer: (call: Sent) => [number, unknown]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const call: Sent = {
      method: init?.method ?? "GET",
      path: new URL(String(input)).pathname,
      headers: new Headers(init?.headers),
    };
    sent.push(call);
    const [status, body] = answer(call);
    if (status === 204) return new Response(null, { status });
    return Response.json(body, { status });
  });
}

beforeEach(() => {
  sent = [];
  push.mockReset();
  useUiStore.setState({ lang: "en" });
  useSystemStore.setState({ overlay: null });
  api(() => [
    404,
    { type: "about:blank", title: "Not found", status: 404, code: "NOT_FOUND" },
  ]);
});

afterEach(() => vi.restoreAllMocks());

describe("who is signed in comes from /api/me (AC-8)", () => {
  it("shows Log in and Register to a guest", () => {
    render(<AppHeader />, { session: "guest" });
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Register" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Balance/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the balance and the profile to a player", async () => {
    render(<AppHeader />, { session: "player" });
    expect(
      await screen.findByRole("link", { name: /ETB\s1,250\.00/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log in" }),
    ).not.toBeInTheDocument();
  });

  it("shows neither until /api/me has answered, so nothing flashes", () => {
    render(<AppHeader />, { session: null });
    expect(
      screen.queryByRole("button", { name: "Log in" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Balance/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the player's own name and phone on the profile, from the API", () => {
    render(<ProfileView />, { session: "player" });
    expect(screen.getAllByText("Abebe Kebede").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+251911234567").length).toBeGreaterThan(0);
    expect(screen.getByText("ID verified")).toBeInTheDocument();
  });

  it("logging out clears the session and returns the screens to the guest state", async () => {
    api((call) =>
      call.path === "/api/auth/logout" && call.method === "POST"
        ? [204, null]
        : call.path === "/api/me"
          ? [200, { player: null }]
          : [404, {}],
    );
    const { queryClient } = render(<ProfileView />, { session: "player" });

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(
      await screen.findByRole("button", { name: "Register" }),
    ).toBeInTheDocument();
    const logout = sent.find((c) => c.path === "/api/auth/logout");
    expect(logout?.method).toBe("POST");
    expect(logout?.headers.get(CSRF_HEADER)).toBe(CSRF_VALUE);
    expect(queryClient.getQueryData(sessionKeys.me())).toEqual({
      player: null,
    });
    expect(push).toHaveBeenCalledWith("/");
  });

  it("tells a player whose session is found gone that it has ended, and not one who logged out", async () => {
    const { queryClient } = render(
      <>
        <SessionWatcher />
        <SystemOverlays />
      </>,
      { session: "player" },
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    act(() => {
      queryClient.setQueryData(sessionKeys.me(), { player: null });
    });

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Your session has ended");
    expect(dialog).toHaveTextContent("Your bet slip is saved.");
    expect(dialog).not.toHaveTextContent("30 minutes");
  });

  it("switches to the guest state in Amharic too", async () => {
    useUiStore.setState({ lang: "am" });
    render(<AppHeader />, { session: "guest" });
    expect(
      screen.getByRole("button", { name: am.header.login }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: am.header.register }),
      ).toBeInTheDocument(),
    );
  });
});
