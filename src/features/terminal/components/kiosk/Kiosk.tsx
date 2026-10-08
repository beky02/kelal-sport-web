"use client";

import { Fragment, useCallback } from "react";
import { useStartingStake } from "@/features/bet-slip/hooks/use-starting-stake";
import { SportsbookChromeProvider } from "@/features/sportsbook/chrome";
import { useIdle } from "../../hooks/use-idle";
import { useTerminalConfig } from "../../hooks/use-kiosk";
import { useStartOver } from "../../hooks/use-start-over";
import { kioskTimings } from "../../lib/slip-code";
import { useKioskStore } from "../../stores/kiosk.store";
import type { TerminalInfo } from "../../types";
import { TerminalBar } from "../TerminalBar";
import {
  TerminalOfflineMessage,
  TerminalUnavailable,
} from "../TerminalScreens";
import { KIOSK_CHROME } from "./chrome";
import { KioskLocale } from "./KioskLocale";
import { KioskStarting } from "./KioskStarting";

/**
 * An activated terminal of an open shop (F8ca): the sportsbook page it is on
 * (`children`: the player's home, league or match page), in the kiosk's
 * language and its chrome, once the tenant's config says it sells in shops.
 * Until the config is read, the page itself with its reads held
 * (`KioskStarting`); while it can't be, the terminal's bar and a bilingual
 * message; with shop betting off, says so and offers nothing. `terminal` is
 * what its status says: its idle time (F8cc).
 */
export function Kiosk({
  terminal,
  children,
}: {
  terminal: TerminalInfo;
  children: React.ReactNode;
}) {
  const config = useTerminalConfig();
  const view = config.data ?? null;
  // The stake starts at the shop's minimum, as the player's does at the
  // online one (the user's decision, 2026-10-08).
  useStartingStake(view?.rules?.calc.min_stake ?? null);

  if (!view && !config.isError) {
    return <KioskStarting>{children}</KioskStarting>;
  }

  return (
    <KioskLocale config={view}>
      {view?.retail ? (
        <SportsbookChromeProvider value={KIOSK_CHROME}>
          <KioskSession terminal={terminal}>{children}</KioskSession>
        </SportsbookChromeProvider>
      ) : (
        <div className="flex flex-1 flex-col">
          <TerminalBar />
          <main className="flex flex-1 flex-col items-center justify-center">
            {view ? (
              <TerminalUnavailable />
            ) : config.isError ? (
              <TerminalOfflineMessage
                onRetry={() => void config.refetch()}
                retrying={config.isFetching}
              />
            ) : null}
          </main>
        </div>
      )}
    </KioskLocale>
  );
}

/**
 * One customer's time at the kiosk (F8cc): the page, re-made whole each time
 * the kiosk starts over (a new `round`), so nothing one customer typed or
 * opened — a code left open on screen included — is the next one's; and the
 * idle timer, which starts over after the terminal's idle time without a
 * touch.
 */
function KioskSession({
  terminal,
  children,
}: {
  terminal: TerminalInfo;
  children: React.ReactNode;
}) {
  const { idleMs } = kioskTimings(terminal);
  const round = useKioskStore((s) => s.round);
  const startOver = useStartOver();
  useIdle({
    idleMs,
    onIdle: useCallback(() => startOver({ idle: true }), [startOver]),
  });
  return <Fragment key={round}>{children}</Fragment>;
}
