"use client";

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
