import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createDeviceKey,
  publicKeyBase64,
} from "@/features/terminal/lib/device-key";
import { P256_SPKI_BASE64 } from "@/lib/api/terminal-schemas";
import am from "@/lib/i18n/messages/am.json";
import en from "@/lib/i18n/messages/en.json";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import {
  active,
  asked,
  json,
  keys,
  kioskHeading,
  problem,
  renderTerminal,
  routes,
  setUpTerminalTests,
  signedFor,
} from "./terminal";

// An active terminal is the kiosk, whose board filters live in the URL (F8ca).
vi.mock("next/navigation", () => import("./navigation"));

setUpTerminalTests();

const activations = () =>
  asked.filter((a) => a.route === "/api/terminal/activate");

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

/**
 * What the activation screen says, in both languages, as an alert. The alert
 * region is always on screen and starts empty, so this waits for its text,
 * not for the region.
 */
async function expectAlert(english: string, amharic: string) {
  await waitFor(() => {
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(english);
    expect(alert).toHaveTextContent(amharic);
  });
}

describe("activating a terminal (AC-4)", () => {
  it("activates with the code and a new device key, then reads the status without showing shop details", async () => {
    routes();
    renderTerminal();

    await activateWith(" k7q2-m9xp ");

    expect(await kioskHeading()).toBeInTheDocument();
    expect(screen.queryByText("Adama Kebele 04")).toBeNull();
    expect(screen.queryByText("PC 3")).toBeNull();

    // The code as the contract spells it, and the public half of the key the
    // browser now keeps.
    const [sent] = activations();
    expect(sent.method).toBe("POST");
    expect(sent.headers[CSRF_HEADER]).toBe(CSRF_VALUE);
    expect(sent.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(String(sent.body));
    expect(body).toEqual({
      activationCode: "K7Q2M9XP",
      devicePublicKey: expect.stringMatching(P256_SPKI_BASE64),
    });
    expect(keys.pair).not.toBeNull();
    expect(keys.pair!.privateKey.extractable).toBe(false);
    expect(await publicKeyBase64(keys.pair!)).toBe(body.devicePublicKey);

    // The status that followed was signed with that key (AC-2).
    const read = asked.find((a) => a.route === "/api/terminal/status")!;
    expect(await signedFor(read, "GET", "/v1/retail/terminal")).toBe(true);
  });

  it("never shows the form again once activated, even when the status read that follows fails (Q1)", async () => {
    const reads = [problem(503, "SERVICE_UNAVAILABLE")];
    routes({ status: () => reads.shift() ?? json(200, active()) });
    // The read fails for good at once; how the client retries it is
    // TerminalStatus's retry policy test.
    renderTerminal({ retry: false });

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
    expect(await kioskHeading()).toBeInTheDocument();
    expect(activations()).toHaveLength(1);
    expect(keys.pair).toBe(key);
  });

  it("says the server couldn't be reached, not the browser, when the activation's answer doesn't parse (S2/Q7)", async () => {
    routes({ activate: () => json(200, { id: 42 }) });
    renderTerminal();
    await activateWith("K7Q2M9XP");
    await expectAlert(
      en.terminal.activate.unreachable,
      am.terminal.activate.unreachable,
    );
  });

  it("says the code is wrong when the API answers 404, and keeps it to correct", async () => {
    routes({ activate: () => problem(404, "NOT_FOUND") });
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
    routes({ activate: () => problem(410, "RETAIL_ACTIVATION_EXPIRED") });
    renderTerminal();
    await activateWith("K7Q2M9XP");
    await expectAlert(
      en.terminal.activate.expired,
      am.terminal.activate.expired,
    );
  });

  it("says too many tries, with the minutes to wait, on 429", async () => {
    routes({
      activate: () => problem(429, "RATE_LIMITED", { "Retry-After": "1750" }),
    });
    renderTerminal();
    await activateWith("K7Q2M9XP");
    await expectAlert(
      en.terminal.activate.tooMany.replace("{minutes}", "30"),
      am.terminal.activate.tooMany.replace("{minutes}", "30"),
    );
  });

  it("says too many tries, try later, on a 429 without Retry-After", async () => {
    routes({ activate: () => problem(429, "RATE_LIMITED") });
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
    routes({ activate: () => problem(503, "SERVICE_UNAVAILABLE") });
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
      ).toHaveLength(1);
      expect(container.querySelector("a")).toHaveAttribute("href", "/terminal");
    },
  );
});
