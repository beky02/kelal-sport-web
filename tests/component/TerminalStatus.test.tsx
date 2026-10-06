import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { notifyManager } from "@tanstack/react-query";
import { createDeviceKey } from "@/features/terminal/lib/device-key";
import type { TerminalStatus } from "@/features/terminal/types";
import am from "@/lib/i18n/messages/am.json";
import en from "@/lib/i18n/messages/en.json";
import { terminalKeys } from "@/lib/query/keys";
import { CSRF_HEADER, CSRF_VALUE } from "@/lib/session-cookie";
import {
  TERMINAL,
  type TerminalRenderOptions,
  active,
  asked,
  json,
  keys,
  problem,
  renderTerminal,
  routes,
  setUpTerminalTests,
  signedFor,
  terminalQueryClient,
} from "./terminal";

// An active terminal is the kiosk, whose board filters live in the URL (F8ca).
vi.mock("next/navigation", () => import("./navigation"));

setUpTerminalTests();

const NOW = Date.parse("2026-10-06T09:00:00Z");
const MINUTE = 60_000;

const reads = () => asked.filter((a) => a.route === "/api/terminal/status");
const rotations = () => asked.filter((a) => a.route === "/api/terminal/token");

/** Moves the fake clock on by `ms`, then lets every answer that time released land. */
async function tick(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
  for (let i = 0; i < 10; i += 1) {
    await act(() => vi.advanceTimersByTimeAsync(0));
  }
}

// Strict, as `next dev` renders: effects run twice on mount, so a rotation
// fired from one must still go once.
const renderStrict = (options: TerminalRenderOptions = {}) =>
  renderTerminal({ ...options, strict: true });

/** The kiosk an active terminal of an open shop shows (F8ca), in Amharic. */
const readyHeading = () =>
  screen.getByRole("heading", {
    level: 1,
    name: am.terminal.kiosk.matches,
  });

const offlineHeading = () =>
  screen.queryByRole("heading", {
    level: 1,
    name: new RegExp(en.terminal.offline.title),
  });

beforeEach(async () => {
  keys.pair = await createDeviceKey();
  vi.useFakeTimers({
    now: NOW,
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  // TanStack tells React about an answer on a zero timeout; on the fake clock
  // that one would wait for the next tick, so answers are told on a microtask.
  notifyManager.setScheduler((cb) => queueMicrotask(cb));
});

afterEach(() => {
  vi.useRealTimers();
  notifyManager.setScheduler((cb) => setTimeout(cb, 0));
});

describe("the terminal's status (AC-5)", () => {
  it("reads the status on boot and every 5 minutes", async () => {
    routes();
    renderStrict();

    await tick(0);
    expect(readyHeading()).toBeInTheDocument();
    expect(screen.getByText("Adama Kebele 04")).toBeInTheDocument();
    expect(reads().map((r) => r.at)).toEqual([0]);

    await tick(5 * MINUTE - 1);
    expect(reads()).toHaveLength(1);
    await tick(1);
    expect(reads().map((r) => r.at)).toEqual([0, 5 * MINUTE]);
    await tick(5 * MINUTE);
    expect(reads().map((r) => r.at)).toEqual([0, 5 * MINUTE, 10 * MINUTE]);
  });

  it("rotates the token when it is due, once, without touching the screen", async () => {
    let rotated = false;
    routes({
      status: () => json(200, active(!rotated)),
      token: async () => {
        // A rotation that takes a second, so the screen can be watched during it.
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        rotated = true;
        return json(200, { rotated: true });
      },
    });
    renderStrict();

    await tick(0);
    const heading = readyHeading();
    expect(rotations()).toHaveLength(1);
    expect(rotations()[0].method).toBe("POST");
    expect(rotations()[0].headers[CSRF_HEADER]).toBe(CSRF_VALUE);
    // Signed for the API's rotation, over no body (AC-2).
    expect(
      await signedFor(rotations()[0], "POST", "/v1/retail/terminal/token"),
    ).toBe(true);
    // Mid-rotation: the same screen, nothing loading.
    expect(readyHeading()).toBe(heading);
    expect(screen.queryByRole("status")).toBeNull();

    await tick(1_000);
    // Done: the status read again says nothing is due; the screen never changed.
    expect(reads()).toHaveLength(2);
    expect(readyHeading()).toBe(heading);
    expect(screen.queryByRole("status")).toBeNull();

    await tick(10 * MINUTE);
    expect(rotations()).toHaveLength(1);
  });

  it("rotates once when a screen mounts with a due status already read, however often it mounts", async () => {
    routes({
      status: () => json(200, active(false)),
      token: () => json(200, { rotated: true }),
    });
    // A kiosk page opening with the status in the cache (F8c's pages share
    // it). Strict mode runs the mount's effects twice; a second page mounts
    // the same hook again.
    const queryClient = terminalQueryClient();
    queryClient.setQueryData(terminalKeys.status(), active(true));
    renderStrict({ queryClient });
    renderStrict({ queryClient });

    await tick(0);
    expect(rotations()).toHaveLength(1);
  });

  it("tries a failed rotation again at the next read", async () => {
    const answers = [
      problem(500, "SERVICE_UNAVAILABLE"),
      json(200, { rotated: true }),
    ];
    routes({
      status: () => json(200, active(true)),
      token: () => answers.shift()!,
    });
    renderStrict();

    await tick(0);
    expect(rotations()).toHaveLength(1);
    const heading = readyHeading();

    await tick(5 * MINUTE - 1);
    expect(rotations()).toHaveLength(1);
    await tick(1);
    expect(rotations().map((r) => r.at)).toEqual([0, 5 * MINUTE]);
    expect(readyHeading()).toBe(heading);
  });

  it("keeps the screen when a read fails after the terminal is up", async () => {
    const answers = [json(200, active()), problem(503, "SERVICE_UNAVAILABLE")];
    routes({ status: () => answers.shift() ?? json(200, active()) });
    // The read fails for good at once; how the client retries it is the
    // retry policy's test, below.
    renderStrict({ retry: false });

    await tick(0);
    const heading = readyHeading();
    await tick(5 * MINUTE);
    expect(reads()).toHaveLength(2);
    expect(readyHeading()).toBe(heading);
    expect(screen.queryByText(en.terminal.offline.title)).toBeNull();
  });

  it("stops reading once the terminal is revoked", async () => {
    routes({
      status: () => json(200, { state: "blocked", reason: "revoked" }),
    });
    renderStrict();

    await tick(0);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.blocked.revokedTitle),
      }),
    ).toBeInTheDocument();
    await tick(15 * MINUTE);
    expect(reads()).toHaveLength(1);
  });

  it("shows the closed shop until it opens, then the terminal, by itself", async () => {
    const closed: TerminalStatus = {
      state: "active",
      rotateDue: false,
      terminal: { ...TERMINAL, shop: { ...TERMINAL.shop, openNow: false } },
    };
    const answers = [json(200, closed)];
    routes({ status: () => answers.shift() ?? json(200, active()) });
    renderStrict();

    await tick(0);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.closed.title),
      }),
    ).toBeInTheDocument();
    await tick(5 * MINUTE);
    expect(readyHeading()).toBeInTheDocument();
  });

  it("says the server can't be reached when the first read fails, and tries again on a tap", async () => {
    const answers = [problem(503, "SERVICE_UNAVAILABLE")];
    routes({ status: () => answers.shift() ?? json(200, active()) });
    renderStrict({ retry: false });

    await tick(0);
    expect(offlineHeading()).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(en.terminal.offline.retry),
      }),
    );
    await tick(0);
    expect(readyHeading()).toBeInTheDocument();
    expect(reads()).toHaveLength(2);
  });

  it("says the server can't be reached only once the app's retry policy has tried the first read twice more", async () => {
    routes({ status: () => problem(503, "SERVICE_UNAVAILABLE") });
    renderStrict();

    await tick(0);
    expect(reads().map((r) => r.at)).toEqual([0]);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(offlineHeading()).toBeNull();

    // TanStack's backoff between tries: 1 s, then 2 s.
    await tick(1_000 - 1);
    expect(reads()).toHaveLength(1);
    await tick(1);
    expect(reads().map((r) => r.at)).toEqual([0, 1_000]);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(offlineHeading()).toBeNull();

    await tick(2_000 - 1);
    expect(reads()).toHaveLength(2);
    expect(offlineHeading()).toBeNull();
    await tick(1);
    expect(reads().map((r) => r.at)).toEqual([0, 1_000, 3_000]);
    expect(offlineHeading()).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("asks nothing and shows activation when this browser holds no device key", async () => {
    keys.pair = null;
    routes();
    renderStrict();

    await tick(0);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: new RegExp(en.terminal.activate.title),
      }),
    ).toBeInTheDocument();
    expect(asked).toHaveLength(0);
  });
});

describe("signing the terminal's calls (AC-2)", () => {
  it("signs the status read for the API's path, not its own route", async () => {
    routes();
    renderStrict();
    await tick(0);

    const [read] = reads();
    expect(read.method).toBe("GET");
    expect(read.headers["X-Device-Timestamp"]).toBe(String(NOW));
    expect(await signedFor(read, "GET", "/v1/retail/terminal")).toBe(true);
    expect(await signedFor(read, "GET", "/api/terminal/status")).toBe(false);
    // The route handler names the device, from its cookie; the token never
    // passes through the browser.
    expect(read.headers["X-Device-Id"]).toBeUndefined();
    expect(read.headers.Authorization).toBeUndefined();
  });

  it("corrects a skewed clock from the server's answer and signs again, once", async () => {
    const serverTime = NOW + 2 * MINUTE;
    const answers = [
      json(400, {
        type: "about:blank",
        title: "This terminal's clock is wrong",
        status: 400,
        code: "VALIDATION_FAILED",
        errors: [
          {
            field: "X-Device-Timestamp",
            code: "CLOCK_SKEW",
            current: String(serverTime),
          },
        ],
      }),
    ];
    routes({ status: () => answers.shift() ?? json(200, active()) });
    renderStrict();
    await tick(0);

    expect(reads().map((r) => r.headers["X-Device-Timestamp"])).toEqual([
      String(NOW),
      String(serverTime),
    ]);
    expect(await signedFor(reads()[1], "GET", "/v1/retail/terminal")).toBe(
      true,
    );
    expect(readyHeading()).toBeInTheDocument();

    // Later reads are signed on the server's time too.
    await tick(5 * MINUTE);
    expect(reads()[2].headers["X-Device-Timestamp"]).toBe(
      String(serverTime + 5 * MINUTE),
    );
  });
});
