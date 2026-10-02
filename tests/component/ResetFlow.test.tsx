import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthDialog } from "@/features/auth/components/AuthDialog";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
import { render } from "./render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

interface Sent {
  method: string;
  path: string;
  body: unknown;
}

let sent: Sent[] = [];
function api(answer: (call: Sent) => [number, unknown]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const call: Sent = {
      method: init?.method ?? "GET",
      path: new URL(String(input)).pathname,
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

const problem = (status: number, code: string) => ({
  type: "https://api.example.et/errors/x",
  title: "The API's title",
  status,
  code,
});

const CHALLENGE = {
  challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1U",
  expiresIn: 300,
  resendAfter: 60,
};

function happy(call: Sent): [number, unknown] {
  if (call.path === "/api/auth/otp") return [200, CHALLENGE];
  if (call.path === "/api/auth/password/reset") return [204, undefined];
  return [404, problem(404, "NOT_FOUND")];
}

const posts = (path: string) =>
  sent.filter((c) => c.method === "POST" && c.path === path);

/** From the login form, typed phone and all, to the code step. */
async function forgot(phone = "911234567") {
  await userEvent.type(screen.getByLabelText("Phone number"), phone);
  await userEvent.click(
    screen.getByRole("button", { name: "Forgot password?" }),
  );
  // The phone typed on the login form comes along.
  expect(await screen.findByLabelText("Phone number")).toHaveValue(phone);
  await userEvent.click(screen.getByRole("button", { name: "Send code" }));
}

async function newPassword(code: string, password = "another long passphrase") {
  await userEvent.type(await screen.findByLabelText("SMS code"), code);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  // Where the player is now, said out loud: the new step's heading.
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "Set a new password" }),
    ).toHaveFocus(),
  );
  for (const label of ["New password", "Confirm password"]) {
    const field = await screen.findByLabelText(label);
    await userEvent.clear(field);
    await userEvent.type(field, password);
  }
  await userEvent.click(screen.getByRole("button", { name: "Save password" }));
}

beforeEach(() => {
  sent = [];
  useUiStore.setState({ lang: "en" });
  useAuthStore.setState({ entry: "login", next: null, prefill: null });
});

afterEach(() => vi.restoreAllMocks());

describe("resetting a password", () => {
  it("resets by SMS code and ends at log in with the phone kept and a notice (AC-9)", async () => {
    api(happy);
    render(<AuthDialog />, { session: "guest" });

    await forgot();
    expect(posts("/api/auth/otp")[0].body).toEqual({
      phone: "911234567",
      purpose: "reset",
    });

    await newPassword("551203");
    expect(posts("/api/auth/password/reset")[0].body).toEqual({
      challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1U",
      otp: "551203",
      newPassword: "another long passphrase",
    });

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(
      "Password changed. Log in with your new password.",
    );
    // Read with the field the caret lands in, not lost as a live region that
    // was already full when it appeared.
    expect(screen.getByLabelText("Phone number")).toHaveFocus();
    expect(screen.getByLabelText("Phone number")).toHaveAccessibleDescription(
      "Password changed. Log in with your new password.",
    );
    expect(useAuthStore.getState().entry).toBe("login");
    expect(screen.getByLabelText("Phone number")).toHaveValue("911234567");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("never says whether the phone has an account", async () => {
    api(happy);
    render(<AuthDialog />, { session: "guest" });

    await forgot();

    expect(
      await screen.findByText(
        "If +251 9•• ••• 567 has an account, we’ve sent it a code.",
      ),
    ).toBeVisible();
  });

  it("a wrong code at Save password goes back to the code step, cleared", async () => {
    let refused = false;
    api((call) => {
      if (call.path === "/api/auth/password/reset" && !refused) {
        refused = true;
        return [422, problem(422, "AUTH_OTP_INVALID")];
      }
      return happy(call);
    });
    render(<AuthDialog />, { session: "guest" });

    await forgot();
    await newPassword("000000");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code isn’t right.",
    );
    expect(screen.getByLabelText("SMS code")).toHaveValue("");

    // The new password was kept: the code is all that is asked again.
    await userEvent.type(screen.getByLabelText("SMS code"), "551203");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("New password")).toHaveValue(
      "another long passphrase",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save password" }),
    );
    expect(await screen.findByRole("status")).toBeVisible();
    expect(posts("/api/auth/password/reset")[1].body).toMatchObject({
      otp: "551203",
    });
  });

  it("an expired code offers a new one", async () => {
    api((call) =>
      call.path === "/api/auth/password/reset"
        ? [422, problem(422, "AUTH_OTP_EXPIRED")]
        : happy(call),
    );
    render(<AuthDialog />, { session: "guest" });

    await forgot();
    await newPassword("551203");

    const alert = await screen.findByRole("alert");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Send a new code" }),
    );
    await waitFor(() => expect(posts("/api/auth/otp")).toHaveLength(2));
    expect(posts("/api/auth/otp")[1].body).toEqual({
      phone: "911234567",
      purpose: "reset",
    });
  });

  it("goes back to log in from the phone step", async () => {
    api(happy);
    render(<AuthDialog />, { session: "guest" });

    await userEvent.click(
      screen.getByRole("button", { name: "Forgot password?" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(useAuthStore.getState().entry).toBe("login");
    expect(screen.getByRole("button", { name: "Log in" })).toBeVisible();
  });
});
