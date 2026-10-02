import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthDialog } from "@/features/auth/components/AuthDialog";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { toPlayer } from "@/lib/api/mappers/auth";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { sessionKeys } from "@/lib/query/keys";
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
  useAuthStore.setState({ step: "login", next: null });
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

    await fillLogin();

    await waitFor(() => expect(useAuthStore.getState().step).toBeNull());
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

    await waitFor(() => expect(useAuthStore.getState().step).toBeNull());
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
    expect(useAuthStore.getState().step).toBe("login");
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
        "Too many failed attempts. Your account is locked for a short while. Try again in 15 minutes.",
      ),
    );
    expect(useAuthStore.getState().step).toBe("login");
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

    useAuthStore.setState({ step: "login", next: "/wallet" });
    const first = render(<AuthDialog />, { session: "guest" });
    await fillLogin();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/wallet"));
    first.unmount();

    replace.mockReset();
    useAuthStore.setState({
      step: "login",
      next: "https://evil.example/wallet",
    });
    render(<AuthDialog />, { session: "guest" });
    await fillLogin();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
