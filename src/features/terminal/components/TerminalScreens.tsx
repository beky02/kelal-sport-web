"use client";

import {
  CircleCheck,
  LoaderCircle,
  ShieldOff,
  Store,
  WifiOff,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import type { TerminalInfo } from "../types";
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

/** Before the first status answer: nothing to show yet. */
export function TerminalLoading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <p
        role="status"
        className="text-muted flex flex-col items-center gap-3 text-base"
      >
        <LoaderCircle className="size-8 animate-spin" aria-hidden />
        <span className="flex flex-col gap-1 text-center">
          <Bilingual k="terminal.loading" />
        </span>
      </p>
    </main>
  );
}

/** The shop this terminal belongs to, on top of whatever it shows. */
export function TerminalShell({
  terminal,
  children,
}: {
  terminal: TerminalInfo;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-surface border-divider flex min-h-14 items-center gap-3 border-b px-4">
        <Store className="text-accent size-5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate text-base font-bold">
          {terminal.shop.name}
        </span>
        {terminal.label && (
          <span className="text-muted ml-auto shrink-0 text-sm">
            {terminal.label}
          </span>
        )}
      </header>
      <main className="flex flex-1 flex-col items-center justify-center">
        {children}
      </main>
    </div>
  );
}

/** Activated and the shop open: the sportsbook goes here (F8c). */
export function TerminalReady() {
  return (
    <TerminalMessage
      icon={<CircleCheck className="size-8" />}
      tone="accent"
      title="terminal.ready.title"
      body="terminal.ready.body"
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

/**
 * No status yet and the server can't be reached. The 5-minute read keeps
 * trying by itself; the button tries now.
 */
export function TerminalOffline({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center">
      <TerminalMessage
        icon={<WifiOff className="size-8" />}
        title="terminal.offline.title"
        body="terminal.offline.body"
      >
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="border-divider text-text mt-3 flex min-h-12 min-w-40 cursor-pointer flex-col items-center justify-center rounded-md border px-5 py-2 text-base font-bold disabled:cursor-wait disabled:opacity-60"
        >
          <Bilingual k="terminal.offline.retry" />
        </button>
      </TerminalMessage>
    </main>
  );
}
