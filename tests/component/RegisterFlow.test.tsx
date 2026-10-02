import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthDialog } from "@/features/auth/components/AuthDialog";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import type { KycResultView } from "@/features/auth/types";
import { toPublicConfigView } from "@/lib/api/mappers/config";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { configKeys, sessionKeys } from "@/lib/query/keys";
import { useUiStore } from "@/stores/ui.store";
import { example } from "../contract";
import { CONTRACT_PLAYER, render } from "./render";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  usePathname: () => "/",
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
function api(
  answer: (call: Sent) => [number, unknown, Record<string, string>?],
) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const call: Sent = {
      method: init?.method ?? "GET",
      path: url.pathname,
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    sent.push(call);
    const [status, body, headers = {}] = answer(call);
    if (status === 204) return new Response(null, { status });
    return Response.json(body, {
      status,
      headers: {
        "Content-Type":
          status >= 400 ? "application/problem+json" : "application/json",
        ...headers,
      },
    });
  });
}

/** A Problem in the contract's shape — what the route handler passes through. */
const problem = (
  status: number,
  code: string,
  errors?: { field?: string; code: string; message?: string }[],
) => ({
  type: "https://api.example.et/errors/x",
  title: "The API's title",
  status,
  code,
  request_id: "req_1",
  ...(errors ? { errors } : {}),
});

const CHALLENGE = {
  challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1S",
  expiresIn: 300,
  resendAfter: 60,
};
const CREATED = {
  player: {
    id: "01J9A7R0000000000000000001",
    phone: "+251911234567",
    fullName: "Abebe Kebede",
    kycStatus: "unverified",
    language: "am",
  },
};
const FAYDA = {
  caseId: "01J9A7T0000000000000000001",
  otpSentTo: "+2519••••567",
  expiresIn: 300,
};
const VERIFIED: KycResultView = { status: "verified", reasonCode: null };

/** The happy path's answers; a test overrides one route by returning early. */
function happy(
  call: Sent,
  result: KycResultView = VERIFIED,
): [number, unknown] {
  switch (call.path) {
    case "/api/auth/otp":
      return [200, CHALLENGE];
    case "/api/auth/register":
      return [201, CREATED];
    case "/api/me":
      return [200, { player: CONTRACT_PLAYER }];
    case "/api/kyc/fayda/otp":
      return [200, FAYDA];
    case "/api/kyc/fayda/verify":
      return [200, result];
  }
  return [404, problem(404, "NOT_FOUND")];
}

const posts = (path?: string) =>
  sent.filter((c) => c.method === "POST" && (!path || c.path === path));

async function phoneStep(phone = "911234567") {
  await userEvent.type(screen.getByLabelText("Phone number"), phone);
  await userEvent.click(
    screen.getByRole("checkbox", { name: /21 years or older/ }),
  );
  await userEvent.click(screen.getByRole("checkbox", { name: /I accept/ }));
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}

async function codeStep(code = "482913") {
  await userEvent.type(await screen.findByLabelText("SMS code"), code);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}

async function detailsStep({
  name = "Abebe Kebede",
  born = "12/04/1998",
  password = "correct horse battery",
} = {}) {
  const fullName = await screen.findByLabelText("Full name as on your ID");
  await userEvent.clear(fullName);
  await userEvent.type(fullName, name);
  const dob = screen.getByLabelText("Date of birth (Gregorian)");
  await userEvent.clear(dob);
  await userEvent.type(dob, born);
  for (const label of ["Password", "Confirm password"]) {
    const field = screen.getByLabelText(label);
    await userEvent.clear(field);
    await userEvent.type(field, password);
  }
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

async function idStep(fin = "4821 0937 5516") {
  await userEvent.type(
    await screen.findByLabelText("Fayda ID number (FIN, 12 digits)"),
    fin,
  );
  await userEvent.click(
    screen.getByRole("checkbox", { name: /share my Fayda details/ }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Verify with Fayda" }),
  );
}

async function faydaCodeStep(code = "123456") {
  await userEvent.type(await screen.findByLabelText("SMS code"), code);
  await userEvent.click(screen.getByRole("button", { name: "Verify" }));
}

beforeEach(() => {
  sent = [];
  replace.mockReset();
  push.mockReset();
  useUiStore.setState({ lang: "en" });
  useAuthStore.setState({ entry: "register", next: null, prefill: null });
});

afterEach(() => vi.restoreAllMocks());

describe("registering through the dialog", () => {
  it("walks phone → code → details → ID → Fayda code → verified, sending each request once (AC-1)", async () => {
    api((call) => happy(call));
    const { queryClient } = render(<AuthDialog />, { session: "guest" });

    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    await phoneStep();
    expect(posts("/api/auth/otp")[0].body).toEqual({
      phone: "911234567",
      purpose: "register",
    });
    expect(posts("/api/auth/otp")[0].headers.get(CSRF_HEADER)).toBe(CSRF_VALUE);

    expect(await screen.findByText("Sent to +251 9•• ••• 567")).toBeVisible();
    await codeStep();
    // The code is held, not checked: nothing was sent for it.
    expect(posts()).toHaveLength(1);

    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    await detailsStep();
    expect(posts("/api/auth/register")[0].body).toEqual({
      challengeId: "01J9A7QK3M8X2B7Y4Z5N6P0R1S",
      otp: "482913",
      fullName: "Abebe Kebede",
      dateOfBirth: "1998-04-12",
      password: "correct horse battery",
      acceptTerms: true,
      // The terms the phone step showed: the tenant's (contract example).
      termsVersion: "2026-10",
    });
    // Signed in: /api/me is read and the session query says so.
    await waitFor(() =>
      expect(queryClient.getQueryData(sessionKeys.me())).toEqual({
        player: CONTRACT_PLAYER,
      }),
    );

    expect(await screen.findByText("Step 4 of 4")).toBeInTheDocument();
    // The account exists: no going back before the ID step.
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await idStep();
    expect(posts("/api/kyc/fayda/otp")[0].body).toEqual({
      faydaNumber: "482109375516",
    });

    expect(await screen.findByText(/Fayda sent a code to/)).toHaveTextContent(
      "+2519••••567",
    );
    await faydaCodeStep();
    expect(posts("/api/kyc/fayda/verify")[0].body).toEqual({
      caseId: "01J9A7T0000000000000000001",
      otp: "123456",
    });

    expect(await screen.findByText("Identity verified")).toBeVisible();
    // The verdict may change the KYC badge and the wallet's lock: whatever
    // reads /api/me (the header, always mounted) reads it again.
    expect(queryClient.getQueryState(sessionKeys.me())?.isInvalidated).toBe(
      true,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Start betting" }),
    );
    expect(useAuthStore.getState().entry).toBeNull();

    // The password, the codes, the date of birth and the Fayda number go with
    // the dialog: nothing left in the mutation cache for the next page to read.
    await waitFor(() =>
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0),
    );
  });

  it("Do this later finishes with the account created and nothing sent to Fayda", async () => {
    api((call) => happy(call));
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();
    await codeStep();
    await detailsStep();
    await userEvent.click(
      await screen.findByRole("button", { name: "Do this later" }),
    );

    expect(useAuthStore.getState().entry).toBeNull();
    expect(posts("/api/kyc/fayda/otp")).toHaveLength(0);
  });

  it("waits for resend_after, then resends with the same phone and purpose", async () => {
    let calls = 0;
    api((call) =>
      call.path === "/api/auth/otp"
        ? [200, { ...CHALLENGE, resendAfter: calls++ === 0 ? 60 : 0 }]
        : happy(call),
    );
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();
    expect(await screen.findByText("Resend code in 1:00")).toBeVisible();

    // Back to the phone, and a new challenge that may be resent at once.
    await userEvent.click(
      screen.getByRole("button", { name: "Change number" }),
    );
    expect(screen.getByLabelText("Phone number")).toHaveValue("911234567");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Send code" }),
    );

    await waitFor(() => expect(posts("/api/auth/otp")).toHaveLength(3));
    expect(posts("/api/auth/otp")[2].body).toEqual({
      phone: "911234567",
      purpose: "register",
    });
  });

  it("refuses a date that is not a real one before anything is sent", async () => {
    api((call) => happy(call));
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();
    await codeStep();
    await userEvent.type(
      await screen.findByLabelText("Date of birth (Gregorian)"),
      "31/02/1998",
    );
    await userEvent.tab();

    expect(screen.getByText("Enter a real date as DD/MM/YYYY.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeDisabled();
  });

  it("asks for 8 characters and a match, and nothing about letters or numbers (C01 §2)", async () => {
    api((call) => happy(call));
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();
    await codeStep();
    await screen.findByLabelText("Password");

    expect(screen.getByText("At least 8 characters")).toBeVisible();
    expect(screen.getByText("Both passwords match")).toBeVisible();
    expect(screen.queryByText("A letter and a number")).toBeNull();
  });
});

describe("what registration says when the API refuses", () => {
  it("REG_PHONE_TAKEN says the phone has an account, and Log in instead opens login with the phone kept (AC-2)", async () => {
    api((call) =>
      call.path === "/api/auth/otp"
        ? [409, problem(409, "REG_PHONE_TAKEN")]
        : happy(call),
    );
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "This phone number already has an account.",
    );
    await userEvent.click(
      within(alert).getByRole("button", { name: "Log in instead" }),
    );

    expect(useAuthStore.getState().entry).toBe("login");
    expect(await screen.findByLabelText("Phone number")).toHaveValue(
      "911234567",
    );
  });

  it("AUTH_OTP_INVALID at Create account returns to the code step, cleared, with the message; the details are kept (AC-2)", async () => {
    let refused = false;
    api((call) => {
      if (call.path === "/api/auth/register" && !refused) {
        refused = true;
        return [422, problem(422, "AUTH_OTP_INVALID")];
      }
      return happy(call);
    });
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();
    await codeStep("111111");
    await detailsStep();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code isn’t right. Check the SMS and try again.",
    );
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(screen.getByLabelText("SMS code")).toHaveValue("");
    expect(screen.getByLabelText("SMS code")).toHaveFocus();

    await codeStep("482913");
    expect(screen.getByLabelText("Full name as on your ID")).toHaveValue(
      "Abebe Kebede",
    );
    expect(screen.getByLabelText("Date of birth (Gregorian)")).toHaveValue(
      "12/04/1998",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );
    await waitFor(() => expect(posts("/api/auth/register")).toHaveLength(2));
    expect(posts("/api/auth/register")[1].body).toMatchObject({
      otp: "482913",
      fullName: "Abebe Kebede",
    });
    expect(await screen.findByText("Step 4 of 4")).toBeInTheDocument();
  });

  it("AUTH_OTP_EXPIRED offers Send a new code, which sends one for the same phone", async () => {
    api((call) =>
      call.path === "/api/auth/register"
        ? [422, problem(422, "AUTH_OTP_EXPIRED")]
        : happy(call),
    );
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();
    await codeStep();
    await detailsStep();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That code has expired.");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Send a new code" }),
    );

    await waitFor(() => expect(posts("/api/auth/otp")).toHaveLength(2));
    expect(posts("/api/auth/otp")[1].body).toEqual({
      phone: "911234567",
      purpose: "register",
    });
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("REG_UNDERAGE says so and offers the responsible-gaming page", async () => {
    api((call) =>
      call.path === "/api/auth/register"
        ? [422, problem(422, "REG_UNDERAGE")]
        : happy(call),
    );
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();
    await codeStep();
    await detailsStep();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "You must be of legal age to open an account.",
    );
    await userEvent.click(
      within(alert).getByRole("button", { name: "Responsible gaming" }),
    );
    expect(push).toHaveBeenCalledWith("/responsible-gaming");
    expect(useAuthStore.getState().entry).toBeNull();
  });

  it("puts VALIDATION_FAILED's messages on the fields they name", async () => {
    api((call) =>
      call.path === "/api/auth/register"
        ? [
            422,
            problem(422, "VALIDATION_FAILED", [
              { field: "password", code: "BREACHED", message: "Too common." },
            ]),
          ]
        : happy(call),
    );
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();
    await codeStep();
    await detailsStep();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Some details need fixing.",
    );
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "Too common.",
    );
  });

  it("can't send SMS: says so, and Continue tries again", async () => {
    let down = true;
    api((call) =>
      call.path === "/api/auth/otp" && down
        ? ((down = false), [503, problem(503, "AUTH_OTP_UNAVAILABLE")])
        : happy(call),
    );
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We can’t send SMS right now.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByLabelText("SMS code")).toBeVisible();
  });
});

describe("the consents", () => {
  it("states the tenant's minimum age", async () => {
    api((call) => happy(call));
    const { queryClient } = render(<AuthDialog />, { session: "guest" });
    expect(
      screen.getByRole("checkbox", { name: /21 years or older/ }),
    ).toBeVisible();

    const view = toPublicConfigView(example("/v1/config/public"));
    queryClient.setQueryData(configKeys.public(), {
      ...view,
      legal: { ...view.legal, minAge: 18 },
    });
    expect(
      await screen.findByRole("checkbox", { name: /18 years or older/ }),
    ).toBeVisible();
  });

  it("opens Terms in a new tab without ticking the box or leaving the flow", async () => {
    api((call) => happy(call));
    render(<AuthDialog />, { session: "guest" });

    const terms = screen.getByRole("link", { name: "Terms" });
    expect(terms).toHaveAttribute("target", "_blank");
    expect(terms).toHaveAttribute("rel", "noopener noreferrer");
    await userEvent.click(terms);

    expect(screen.getByRole("checkbox", { name: /I accept/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("asks again when the terms changed before Create account — no second SMS, the details kept", async () => {
    const view = toPublicConfigView(example("/v1/config/public"));
    let refused = false;
    api((call) => {
      if (call.path === "/api/config") {
        return [
          200,
          { ...view, legal: { ...view.legal, termsVersion: "2026-11" } },
        ];
      }
      if (call.path === "/api/auth/register" && !refused) {
        refused = true;
        return [
          422,
          problem(422, "VALIDATION_FAILED", [
            { field: "accept_terms_version", code: "STALE" },
          ]),
        ];
      }
      return happy(call);
    });
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();
    await codeStep();
    await detailsStep();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Our terms were updated. Please read and accept them again.",
    );
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /I accept/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByLabelText("Phone number")).toHaveValue("911234567");

    await userEvent.click(
      screen.getByRole("checkbox", { name: /21 years or older/ }),
    );
    await userEvent.click(screen.getByRole("checkbox", { name: /I accept/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Straight back to the details, as typed; the code sent before stands.
    expect(await screen.findByLabelText("Full name as on your ID")).toHaveValue(
      "Abebe Kebede",
    );
    expect(posts("/api/auth/otp")).toHaveLength(1);
    await userEvent.type(
      screen.getByLabelText("Password"),
      "correct horse battery",
    );
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "correct horse battery",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );

    await waitFor(() => expect(posts("/api/auth/register")).toHaveLength(2));
    expect(posts("/api/auth/register")[1].body).toMatchObject({
      otp: "482913",
      termsVersion: "2026-11",
    });
    expect(await screen.findByText("Step 4 of 4")).toBeInTheDocument();
  });

  it("says how long to wait when too many codes were asked for", async () => {
    api((call) =>
      call.path === "/api/auth/otp"
        ? [429, problem(429, "AUTH_OTP_RATE_LIMITED"), { "Retry-After": "45" }]
        : happy(call),
    );
    render(<AuthDialog />, { session: "guest" });

    await phoneStep();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many attempts. Try again in 45 seconds.",
    );
  });
});

describe("verifying with Fayda", () => {
  async function verifyAs(result: KycResultView) {
    api((call) => happy(call, result));
    useAuthStore.setState({ entry: "verify", next: null, prefill: null });
    render(<AuthDialog />);
    await idStep();
    await faydaCodeStep();
  }

  it("from the profile is the ID step alone, ending with Done", async () => {
    await verifyAs(VERIFIED);

    expect(screen.queryByText(/Step \d of 4/)).toBeNull();
    expect(await screen.findByText("Identity verified")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(useAuthStore.getState().entry).toBeNull();
  });

  it("shows pending as in review (AC-10)", async () => {
    await verifyAs({ status: "pending", reasonCode: null });
    expect(await screen.findByText("Verification in progress")).toBeVisible();
    expect(
      screen.getByText(
        "We’re reviewing your ID. We’ll let you know when it’s done.",
      ),
    ).toBeVisible();
  });

  it("shows needs_info with its reason, and Try again goes back to the ID step (AC-10)", async () => {
    await verifyAs({ status: "needs_info", reasonCode: "NAME_MISMATCH" });

    expect(
      await screen.findByText("We couldn’t match your details"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "The name on your Fayda ID doesn’t match the name on your account.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Do this later" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      screen.getByLabelText("Fayda ID number (FIN, 12 digits)"),
    ).toHaveValue("482109375516");
  });

  it("shows rejected with where to get help (AC-10)", async () => {
    await verifyAs({ status: "rejected", reasonCode: "OTHER" });
    expect(await screen.findByText("We couldn’t verify your ID")).toBeVisible();
    expect(
      screen.getByText("Contact support from your profile and we’ll help."),
    ).toBeVisible();
  });

  it("KYC_PROVIDER_UNAVAILABLE offers Do this later", async () => {
    api((call) =>
      call.path === "/api/kyc/fayda/otp"
        ? [503, problem(503, "KYC_PROVIDER_UNAVAILABLE")]
        : happy(call),
    );
    useAuthStore.setState({ entry: "verify", next: null, prefill: null });
    render(<AuthDialog />);

    await idStep();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Fayda isn’t reachable right now.");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Do this later" }),
    );
    expect(useAuthStore.getState().entry).toBeNull();
  });

  it("a session that has ended offers Log in again", async () => {
    api((call) =>
      call.path === "/api/kyc/fayda/otp"
        ? [401, problem(401, "AUTH_TOKEN_EXPIRED")]
        : happy(call),
    );
    useAuthStore.setState({ entry: "verify", next: null, prefill: null });
    render(<AuthDialog />);

    await idStep();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your session has ended.");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Log in again" }),
    );
    expect(useAuthStore.getState().entry).toBe("login");
  });

  it("a wrong Fayda code stays on the code step, cleared", async () => {
    api((call) =>
      call.path === "/api/kyc/fayda/verify"
        ? [422, problem(422, "AUTH_OTP_INVALID")]
        : happy(call),
    );
    useAuthStore.setState({ entry: "verify", next: null, prefill: null });
    render(<AuthDialog />);

    await idStep();
    await faydaCodeStep("000000");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code isn’t right.",
    );
    expect(screen.getByLabelText("SMS code")).toHaveValue("");
  });
});
