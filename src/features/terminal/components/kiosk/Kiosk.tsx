"use client";

import { useEffect } from "react";
import { useBetSlipStore } from "@/features/bet-slip/stores/bet-slip.store";
import { SportsbookChromeProvider } from "@/features/sportsbook/chrome";
import { useTerminalConfig } from "../../hooks/use-kiosk";
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
 * message; with shop betting off, says so and offers nothing.
 */
export function Kiosk({ children }: { children: React.ReactNode }) {
  const config = useTerminalConfig();
  const view = config.data ?? null;
  // The stake starts empty (F8cb, the user's answer at the plan gate): it is
  // a hint the customer may type (C19 §4.2), never the player's preset sent
  // on a code they didn't choose. F8cc's idle reset starts it the same way.
  useEffect(() => useBetSlipStore.getState().setStake(""), []);

  if (!view && !config.isError) {
    return <KioskStarting>{children}</KioskStarting>;
  }

  return (
    <KioskLocale config={view}>
      {view?.retail ? (
        <SportsbookChromeProvider value={KIOSK_CHROME}>
          {children}
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
