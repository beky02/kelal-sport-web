import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resetTerminalClock } from "@/features/terminal/api/client";
import { TerminalApp } from "@/features/terminal/components/TerminalApp";
import {
  createDeviceKey,
  publicKeyBase64,
} from "@/features/terminal/lib/device-key";
import {
  EMPTY_BODY_SHA256,
  canonicalRequest,
} from "@/features/terminal/lib/signing";
import type { TerminalStatus } from "@/features/terminal/types";
import {
  toTerminalActivation,
  toTerminalInfo,
} from "@/lib/api/mappers/terminal";
import type { components } from "@/lib/api/schema";
import { P256_SPKI_BASE64 } from "@/lib/api/terminal-schemas";
import am from "@/lib/i18n/messages/am.json";
import en from "@/lib/i18n/messages/en.json";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import { example, responseExample } from "../contract";

/** The device key store, in memory: jsdom has no IndexedDB. */
const keys = vi.hoisted(() => ({
  pair: null as CryptoKeyPair | null,
  broken: false,
}));
vi.mock("@/features/terminal/lib/device-key", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/terminal/lib/device-key")
  >()),
  deviceKeyStore: {
    load: async () => keys.pair,
    save: async (pair: CryptoKeyPair) => {
      if (keys.broken) throw new DOMException("Blocked", "UnknownError");
      keys.pair = pair;
    },
  },
}));

const ACTIVATION = toTerminalActivation(
  responseExample(
    "/v1/retail/terminals/activate",
    "post",
    200,
  ) as components["schemas"]["TerminalActivation"],
);
const ACTIVE: TerminalStatus = {
  state: "active",
  terminal: toTerminalInfo(example("/v1/retail/terminal")),
  rotateDue: false,
};

let asked: { route: string; init: RequestInit }[] = [];

const json = (status: number, body: unknown, headers = {}) =>
  Response.json(body, {
    status,
    headers: {
      "Content-Type":
        status >= 400 ? "application/problem+json" : "application/json",
      ...headers,
    },
  });

/** A Problem as the route handler passes it through from the API. */
const problem = (status: number, code: string, headers = {}) =>
  json(
    status,
    { type: "about:blank", title: "Refused", status, code },
    headers,
  );

/** `/api/terminal/status` answers `status`; `/api/terminal/activate` answers `activation`. */
function routes({
  status = (): Response => json(200, ACTIVE),
  activation = (): Response => json(200, ACTIVATION),
}: {
  status?: () => Response;
  activation?: () => Response;
} = {}) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const route = String(input);
    asked.push({ route, init: init ?? {} });
    if (route === "/api/terminal/status") return status();
    if (route === "/api/terminal/activate") return activation();
    throw new Error(`unexpected ${route}`);
  });
}

const activations = () =>
  asked.filter((a) => a.route === "/api/terminal/activate");

function renderTerminal() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TerminalApp />
    </QueryClientProvider>,
  );
}

/** Types a code on the activation screen and presses Activate. */
async function activateWith(code: string) {
  const user = userEvent.setup();
  const field = await screen.findByLabelText(
    new RegExp(en.terminal.activate.label),
  );
  await user.type(field, code);
  await user.click(
    screen.getByRole("button", {
      name: new RegExp(en.terminal.activate.submit),
    }),
  );
  return field;
}

/** What the activation screen says, in both languages, as an alert. */
async function expectAlert(english: string, amharic: string) {
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(english);
  expect(alert).toHaveTextContent(amharic);
}

beforeEach(() => {
  asked = [];
  keys.pair = null;
  keys.broken = false;
  resetTerminalClock();
});

afterEach(() => vi.restoreAllMocks());

describe("activating a terminal (AC-4)", () => {
  it("activates with the code and a new device key, then reads the status and shows the shop", async () => {
    routes();
    renderTerminal();

    await activateWith(" k7q2-m9xp ");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.ready.title),
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Adama Kebele 04")).toBeInTheDocument();
    expect(screen.getByText("PC 3")).toBeInTheDocument();

    // The code as the contract spells it, and the public half of the key the
    // browser now keeps.
    const [sent] = activations();
    expect(sent.init.method).toBe("POST");
    const headers = sent.init.headers as Record<string, string>;
    expect(headers[CSRF_HEADER]).toBe(CSRF_VALUE);
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(String(sent.init.body));
    expect(body).toEqual({
      activationCode: "K7Q2M9XP",
      devicePublicKey: expect.stringMatching(P256_SPKI_BASE64),
    });
    expect(keys.pair).not.toBeNull();
    expect(keys.pair!.privateKey.extractable).toBe(false);
    expect(await publicKeyBase64(keys.pair!)).toBe(body.devicePublicKey);

    // The status that followed was signed with that key (AC-2).
    const read = asked.find((a) => a.route === "/api/terminal/status")!;
    const readHeaders = read.init.headers as Record<string, string>;
    expect(
      await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        keys.pair!.publicKey,
        Uint8Array.from(atob(readHeaders["X-Device-Signature"]), (c) =>
          c.charCodeAt(0),
        ),
        new TextEncoder().encode(
          canonicalRequest(
            "GET",
            "/v1/retail/terminal",
            Number(readHeaders["X-Device-Timestamp"]),
            EMPTY_BODY_SHA256,
          ),
        ),
      ),
    ).toBe(true);
  });

  it("never shows the form again once activated, even when the status read that follows fails (Q1)", async () => {
    const reads = [problem(503, "SERVICE_UNAVAILABLE")];
    routes({ status: () => reads.shift() ?? json(200, ACTIVE) });
    renderTerminal();

    await activateWith("K7Q2M9XP");
    // Activated, but the status can't be read: the server-can't-be-reached
    // screen with Try again — no form, so no second activation can replace
    // the key the terminal is now bound to.
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.offline.title),
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(new RegExp(en.terminal.activate.label)),
    ).toBeNull();
    const key = keys.pair;

    await userEvent.click(
      screen.getByRole("button", {
        name: new RegExp(en.terminal.offline.retry),
      }),
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.ready.title),
      }),
    ).toBeInTheDocument();
    expect(activations()).toHaveLength(1);
    expect(keys.pair).toBe(key);
  });

  it("says the server couldn't be reached, not the browser, when the activation's answer doesn't parse (S2/Q7)", async () => {
    routes({ activation: () => json(200, { id: 42 }) });
    renderTerminal();
    await activateWith("K7Q2M9XP");
    await expectAlert(
      en.terminal.activate.unreachable,
      am.terminal.activate.unreachable,
    );
  });

  it("says the code is wrong when the API answers 404, and keeps it to correct", async () => {
    routes({ activation: () => problem(404, "NOT_FOUND") });
    renderTerminal();

    const field = await activateWith("K7Q2M9XP");

    await expectAlert(
      en.terminal.activate.wrongCode,
      am.terminal.activate.wrongCode,
    );
    expect(field).toHaveValue("K7Q2M9XP");
    expect(field).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(field).toHaveFocus());
  });

  it("says the code has expired when the API answers 410 RETAIL_ACTIVATION_EXPIRED", async () => {
    routes({ activation: () => problem(410, "RETAIL_ACTIVATION_EXPIRED") });
    renderTerminal();
    await activateWith("K7Q2M9XP");
    await expectAlert(
      en.terminal.activate.expired,
      am.terminal.activate.expired,
    );
  });

  it("says too many tries, with the minutes to wait, on 429", async () => {
    routes({
      activation: () => problem(429, "RATE_LIMITED", { "Retry-After": "1750" }),
    });
    renderTerminal();
    await activateWith("K7Q2M9XP");
    await expectAlert(
      en.terminal.activate.tooMany.replace("{minutes}", "30"),
      am.terminal.activate.tooMany.replace("{minutes}", "30"),
    );
  });

  it("says too many tries, try later, on a 429 without Retry-After", async () => {
    routes({ activation: () => problem(429, "RATE_LIMITED") });
    renderTerminal();
    await activateWith("K7Q2M9XP");
    await expectAlert(
      en.terminal.activate.tooManyLater,
      am.terminal.activate.tooManyLater,
    );
  });

  it("checks the code's format before sending it", async () => {
    routes();
    renderTerminal();

    for (const typo of ["12345", "K7Q2M9XPQ", "K7Q2M9XU"]) {
      const field = await activateWith(typo);
      await expectAlert(
        en.terminal.activate.format,
        am.terminal.activate.format,
      );
      await userEvent.clear(field);
    }
    expect(activations()).toHaveLength(0);
    expect(keys.pair).toBeNull();
  });

  it("announces a refusal said again, as a new message in the same alert region (Q5)", async () => {
    routes();
    renderTerminal();
    await activateWith("123");
    const alert = await screen.findByRole("alert");
    const first = within(alert).getByText(en.terminal.activate.format);

    await userEvent.click(
      screen.getByRole("button", {
        name: new RegExp(en.terminal.activate.submit),
      }),
    );
    const again = within(alert).getByText(en.terminal.activate.format);
    expect(screen.getByRole("alert")).toBe(alert);
    expect(again).not.toBe(first);
  });

  it("says the server couldn't be reached when activation fails otherwise", async () => {
    routes({ activation: () => problem(503, "SERVICE_UNAVAILABLE") });
    renderTerminal();
    await activateWith("K7Q2M9XP");
    await expectAlert(
      en.terminal.activate.unreachable,
      am.terminal.activate.unreachable,
    );
  });

  it("says the browser can't keep the key, and sends nothing, when storing it fails", async () => {
    keys.broken = true;
    routes();
    renderTerminal();
    await activateWith("K7Q2M9XP");
    await expectAlert(
      en.terminal.activate.unsupported,
      am.terminal.activate.unsupported,
    );
    expect(activations()).toHaveLength(0);
  });

  it("asks for a new code when the terminal's activation lapsed", async () => {
    keys.pair = await createDeviceKey();
    routes({
      status: () => json(200, { state: "inactive", reason: "expired" }),
    });
    renderTerminal();

    expect(
      await screen.findByText(en.terminal.activate.lapsed),
    ).toBeInTheDocument();
    expect(screen.getByText(am.terminal.activate.lapsed)).toBeInTheDocument();
    expect(
      screen.getByLabelText(new RegExp(en.terminal.activate.label)),
    ).toBeInTheDocument();
  });
});

describe("a terminal that may not run (AC-4)", () => {
  it.each([
    [
      "revoked",
      en.terminal.blocked.revokedTitle,
      am.terminal.blocked.revokedTitle,
    ],
    [
      "device_not_allowed",
      en.terminal.blocked.deviceTitle,
      am.terminal.blocked.deviceTitle,
    ],
  ] as const)(
    "says it is %s and offers nothing to press",
    async (reason, english, amharic) => {
      keys.pair = await createDeviceKey();
      routes({ status: () => json(200, { state: "blocked", reason }) });
      const { container } = renderTerminal();

      const heading = await screen.findByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent(english);
      expect(within(heading).getByText(amharic)).toHaveAttribute("lang", "am");
      expect(
        container.querySelectorAll(
          "button, a, input, select, textarea, [tabindex]",
        ),
      ).toHaveLength(0);
    },
  );
});
