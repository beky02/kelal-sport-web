import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthDialog } from "@/features/auth/components/AuthDialog";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { toPlayer } from "@/lib/api/mappers/auth";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { sessionKeys, walletKeys } from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import { example } from "../contract";
import { render } from "./render";

const replace = vi.fn();
let pathname = "/";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

interface Sent {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
}

/** Stubs this app's own `/api/*`; every call is recorded in `sent`. */
let sent: Sent[] = [];
function api(answer: (call: Sent) => [number, unknown]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const call: Sent = {
      method: init?.method ?? "GET",
      path: url.pathname,
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    sent.push(call);
    const [status, body] = answer(call);
    if (status === 204) return new Response(null, { status });
    return Response.json(body, {
      status,
      headers: {
        "Content-Type":
          status >= 400 ? "application/problem+json" : "application/json",
      },
    });
  });
}

const PLAYER = () => toPlayer(example("/v1/me"));
const OK = {
  status: "ok",
  player: {
    id: "p1",
    phone: "+251911234567",
    fullName: "Abebe Kebede",
    kycStatus: "verified",
    language: "am",
  },
};
const OTP_REQUIRED = {
  status: "otp_required",
  challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1T",
  expiresIn: 300,
};

const problem = (
  status: number,
  code: string,
  title: string,
  detail?: string,
) => ({
  type: "about:blank",
  title,
  status,
  code,
  detail,
});

const posts = () => sent.filter((c) => c.method === "POST");

async function fillLogin(
  phone = "911234567",
  password = "correct horse battery",
) {
  await userEvent.type(screen.getByLabelText("Phone number"), phone);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

beforeEach(() => {
  sent = [];
  pathname = "/";
  replace.mockReset();
  useUiStore.setState({ lang: "en" });
  useAuthStore.setState({ entry: "login", next: null, prefill: null });
});

afterEach(() => vi.restoreAllMocks());

describe("logging in through the dialog", () => {
  it("logs in, closes, and the session query says who is signed in (AC-8)", async () => {
    api((call) => {
      if (call.path === "/api/auth/login") return [200, OK];
      if (call.path === "/api/me") return [200, { player: PLAYER() }];
      return [404, problem(404, "NOT_FOUND", "Not found")];
    });
    const { queryClient } = render(<AuthDialog />, { session: "guest" });
    // Whatever a previous player left in the cache goes before the new one is read.
    queryClient.setQueryData(walletKeys.balance(), { balance: 999 });

    await fillLogin();

    await waitFor(() => expect(useAuthStore.getState().entry).toBeNull());
    expect(queryClient.getQueryData(walletKeys.balance())).toBeUndefined();
    const login = posts()[0];
    expect(login.path).toBe("/api/auth/login");
    expect(login.body).toEqual({
      phone: "911234567",
      password: "correct horse battery",
    });
    // C18 §4.4: every mutation carries the CSRF header; the language rides along.
    expect(login.headers.get(CSRF_HEADER)).toBe(CSRF_VALUE);
    expect(login.headers.get("Accept-Language")).toBe("en");
    await waitFor(() =>
      expect(queryClient.getQueryData(sessionKeys.me())).toEqual({
        player: PLAYER(),
      }),
    );
    // Opened from the sportsbook: the player stays where they were.
    expect(replace).not.toHaveBeenCalled();
  });

  it("asks for the SMS code when login answers 202 and logs in with it (AC-6)", async () => {
    api((call) => {
      if (call.path === "/api/auth/login") {
        return call.body && typeof call.body === "object" && "otp" in call.body
          ? [200, OK]
          : [200, OTP_REQUIRED];
      }
      if (call.path === "/api/me") return [200, { player: PLAYER() }];
      return [404, problem(404, "NOT_FOUND", "Not found")];
    });
    render(<AuthDialog />, { session: "guest" });

    await fillLogin();

    expect(
      await screen.findByRole("heading", { name: "Enter the SMS code" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/\+251 9•• ••• 567/)).toBeInTheDocument();
    expect(screen.getByText(/New device/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("SMS code"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => expect(useAuthStore.getState().entry).toBeNull());
    expect(posts()).toHaveLength(2);
    expect(posts()[1].body).toEqual({
      phone: "911234567",
      password: "correct horse battery",
      challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1T",
      otp: "482913",
    });
  });

  it("says the code is wrong on AUTH_OTP_INVALID and keeps the code step, cleared for another go", async () => {
    api((call) => {
      if (call.path === "/api/auth/login") {
        return call.body && typeof call.body === "object" && "otp" in call.body
          ? [422, problem(422, "AUTH_OTP_INVALID", "Wrong code")]
          : [200, OTP_REQUIRED];
      }
      return [404, problem(404, "NOT_FOUND", "Not found")];
    });
    render(<AuthDialog />, { session: "guest" });
    await fillLogin();
    await screen.findByRole("heading", { name: "Enter the SMS code" });

    await userEvent.type(screen.getByLabelText("SMS code"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "That code isn’t right. Check the SMS and try again.",
    );
    expect(
      screen.getByRole("heading", { name: "Enter the SMS code" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("SMS code")).toHaveValue("");
    expect(useAuthStore.getState().entry).toBe("login");
  });

  it("offers to log in again when the code has expired", async () => {
    api((call) => {
      if (call.path === "/api/auth/login") {
        return call.body && typeof call.body === "object" && "otp" in call.body
          ? [422, problem(422, "AUTH_OTP_EXPIRED", "Code expired")]
          : [200, OTP_REQUIRED];
      }
      return [404, problem(404, "NOT_FOUND", "Not found")];
    });
    render(<AuthDialog />, { session: "guest" });
    await fillLogin();
    await screen.findByRole("heading", { name: "Enter the SMS code" });
    await userEvent.type(screen.getByLabelText("SMS code"), "482913");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));

    await screen.findByText(
      "That code has expired. Log in again to get a new one.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Log in again" }));

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Phone number")).toHaveValue("911234567");
  });

  it("shows the refusal for a wrong password, and the lock-out with how long it lasts", async () => {
    let attempts = 0;
    api((call) => {
      if (call.path === "/api/auth/login") {
        attempts += 1;
        return attempts === 1
          ? [
              401,
              problem(
                401,
                "AUTH_INVALID_CREDENTIALS",
                "Wrong phone or password",
              ),
            ]
          : [
              423,
              problem(
                423,
                "AUTH_LOCKED",
                "Account temporarily locked",
                "Try again in 15 minutes.",
              ),
            ];
      }
      return [404, problem(404, "NOT_FOUND", "Not found")];
    });
    render(<AuthDialog />, { session: "guest" });

    await fillLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wrong phone number or password.",
    );

    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Too many failed attempts. Your account is locked for a short while.",
      ),
    );
    // The API's own detail, as its own line — never glued into our sentence.
    expect(screen.getByText("Try again in 15 minutes.")).toBeInTheDocument();
    expect(useAuthStore.getState().entry).toBe("login");

    // Locked: nothing to resubmit until a field changes.
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Password"), "x");
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
  });

  it("focuses the phone field when it opens on login, with no back arrow to nowhere", () => {
    api(() => [404, problem(404, "NOT_FOUND", "Not found")]);
    render(<AuthDialog />, { session: "guest" });
    expect(screen.getByLabelText("Phone number")).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("keeps the masked number on one line in the code step", async () => {
    api((call) =>
      call.path === "/api/auth/login"
        ? [200, OTP_REQUIRED]
        : [404, problem(404, "NOT_FOUND", "Not found")],
    );
    render(<AuthDialog />, { session: "guest" });
    await fillLogin();
    const phone = await screen.findByText("+251 9•• ••• 567");
    expect(phone).toHaveClass("whitespace-nowrap");
    // Back from the code goes to the form, so the arrow is there.
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("still closes when the login worked but reading the profile failed: the cookie is set", async () => {
    api((call) => {
      if (call.path === "/api/auth/login") return [200, OK];
      if (call.path === "/api/me") {
        return [503, problem(503, "SERVICE_UNAVAILABLE", "Down")];
      }
      return [404, problem(404, "NOT_FOUND", "Not found")];
    });
    render(<AuthDialog />, { session: "guest" });
    await fillLogin();
    await waitFor(() => expect(useAuthStore.getState().entry).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says so in Amharic too", async () => {
    useUiStore.setState({ lang: "am" });
    api((call) =>
      call.path === "/api/auth/login"
        ? [
            401,
            problem(401, "AUTH_INVALID_CREDENTIALS", "Wrong phone or password"),
          ]
        : [404, problem(404, "NOT_FOUND", "Not found")],
    );
    render(<AuthDialog />, { session: "guest" });

    await userEvent.type(screen.getByLabelText("ስልክ ቁጥር"), "911234567");
    await userEvent.type(screen.getByLabelText("የይለፍ ቃል"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "ግባ" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/[ሀ-፿]/);
    expect(sent[0].headers.get("Accept-Language")).toBe("am");
  });

  it("returns to where the player was going, only when that is on this site", async () => {
    pathname = "/login";
    api((call) => {
      if (call.path === "/api/auth/login") return [200, OK];
      if (call.path === "/api/me") return [200, { player: PLAYER() }];
      return [404, problem(404, "NOT_FOUND", "Not found")];
    });

    useAuthStore.setState({ entry: "login", next: "/wallet", prefill: null });
    const first = render(<AuthDialog />, { session: "guest" });
    await fillLogin();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/wallet"));
    first.unmount();

    replace.mockReset();
    useAuthStore.setState({
      entry: "login",
      next: "https://evil.example/wallet",
      prefill: null,
    });
    render(<AuthDialog />, { session: "guest" });
    await fillLogin();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
