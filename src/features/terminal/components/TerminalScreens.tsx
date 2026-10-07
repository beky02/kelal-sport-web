"use client";

import { Ban, ShieldOff, Store, WifiOff } from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import { BrandMark } from "@/components/layout/BrandMark";
import { SHELL_GRID } from "@/components/layout/shell-grid";
import { BoardSkeleton } from "@/features/sportsbook/components/BoardSkeleton";
import { Bilingual } from "./Bilingual";

/**
 * The terminal's full-screen states. Large type for a screen read from a step
 * away, targets of 48 px or more (00-overview), every message in both
 * languages (`Bilingual`).
 */

/** One state: an icon, a heading and a line, centred; and what can be done, if anything. */
export function TerminalMessage({
  icon,
  title,
  body,
  tone = "muted",
  children,
}: {
  icon: React.ReactNode;
  title: MessageKey;
  body: MessageKey;
  tone?: "muted" | "accent" | "loss";
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <div
        className={cn(
          "bg-raised grid size-16 place-items-center rounded-lg",
          tone === "accent" && "text-accent",
          tone === "loss" && "text-loss",
          tone === "muted" && "text-muted",
        )}
        aria-hidden
      >
        {icon}
      </div>
      <h1 className="mt-2 flex flex-col gap-1 text-2xl md:text-3xl">
        <Bilingual k={title} />
      </h1>
      <p className="text-muted flex max-w-md flex-col gap-1 text-base text-pretty">
        <Bilingual k={body} />
      </p>
      {children}
    </section>
  );
}

/** Nothing to show yet, said as such. */
export function TerminalLoadingMessage() {
  return (
    <span role="status" className="sr-only">
      {translate("en", "terminal.loading")}
    </span>
  );
}

/** The same board loading used by the player's home page, before status/config. */
export function TerminalStarting() {
  return (
    <div className="flex flex-1 flex-col">
      <TerminalBrandBar />
      <main className={`${SHELL_GRID} flex-1`} aria-busy="true">
        <aside className="hidden lg:block" aria-hidden />
        <div className="flex min-w-0 flex-col gap-2.5">
          <BoardSkeleton />
          <TerminalLoadingMessage />
        </div>
        <aside className="hidden xl:block" aria-hidden />
      </main>
    </div>
  );
}

/** Brand-only bar for terminal states that do not show the sportsbook header. */
export function TerminalBrandBar() {
  return (
    <header className="bg-surface border-divider flex h-[52px] items-center border-b px-3 md:h-14 md:px-5">
      <BrandMark href="/terminal" />
    </header>
  );
}

/**
 * The tenant sells nothing in shops (`features.retail: false`, F8ca): no
 * sportsbook, nothing to press, and back by itself when it is switched on.
 */
export function TerminalUnavailable() {
  return (
    <TerminalMessage
      icon={<Ban className="size-8" />}
      title="terminal.kiosk.unavailable.title"
      body="terminal.kiosk.unavailable.body"
    />
  );
}

/** The shop is closed or suspended (C19 §14): back by itself when it opens. */
export function TerminalClosed() {
  return (
    <TerminalMessage
      icon={<Store className="size-8" />}
      title="terminal.closed.title"
      body="terminal.closed.body"
    />
  );
}

/**
 * Revoked, or this PC not allowed: says so and offers nothing else (AC-4).
 * Reloading asks the server again; only a new activation, after the shop's
 * staff clear this browser, brings the terminal back.
 */
export function TerminalBlocked({
  reason,
}: {
  reason: "revoked" | "device_not_allowed";
}) {
  const revoked = reason === "revoked";
  return (
    <main className="flex flex-1 flex-col items-center justify-center">
      <TerminalMessage
        icon={<ShieldOff className="size-8" />}
        tone="loss"
        title={
          revoked
            ? "terminal.blocked.revokedTitle"
            : "terminal.blocked.deviceTitle"
        }
        body={
          revoked
            ? "terminal.blocked.revokedBody"
            : "terminal.blocked.deviceBody"
        }
      />
    </main>
  );
}

/** The server can't be reached: the read keeps trying, and the button tries now. */
export function TerminalOfflineMessage({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <TerminalMessage
      icon={<WifiOff className="size-8" />}
      title="terminal.offline.title"
      body="terminal.offline.body"
    >
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="bg-raised border-divider text-text mt-3 flex min-h-12 min-w-40 cursor-pointer flex-col items-center justify-center rounded-md border px-5 py-2 text-base font-bold hover:brightness-125 disabled:cursor-wait disabled:opacity-60"
      >
        <Bilingual k="terminal.offline.retry" />
      </button>
    </TerminalMessage>
  );
}

/**
 * No status yet and the server can't be reached. The 5-minute read keeps
 * trying by itself; the button tries now.
 */
export function TerminalOffline(props: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center">
      <TerminalOfflineMessage {...props} />
    </main>
  );
}
