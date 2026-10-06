"use client";

import { SportsbookChromeProvider } from "@/features/sportsbook/chrome";
import { useTerminalConfig } from "../../hooks/use-kiosk";
import type { TerminalInfo } from "../../types";
import {
  TerminalLoadingMessage,
  TerminalOfflineMessage,
  TerminalShell,
  TerminalUnavailable,
} from "../TerminalScreens";
import { KIOSK_CHROME } from "./chrome";
import { KioskLocale } from "./KioskLocale";

/**
 * An activated terminal of an open shop (F8ca): the sportsbook page it is on
 * (`children`: the player's home, league or match page), in the kiosk's
 * language and its chrome, once the tenant's config says it sells in shops.
 * Until the config is read — or while it can't be — the shop's bar and a
 * bilingual message; with shop betting off, says so and offers nothing.
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

  return (
    <KioskLocale config={view}>
      {view?.retail ? (
        <SportsbookChromeProvider value={KIOSK_CHROME}>
          {children}
        </SportsbookChromeProvider>
      ) : (
        <TerminalShell terminal={terminal}>
          {view ? (
            <TerminalUnavailable />
          ) : config.isError ? (
            <TerminalOfflineMessage
              onRetry={() => void config.refetch()}
              retrying={config.isFetching}
            />
          ) : (
            <TerminalLoadingMessage />
          )}
        </TerminalShell>
      )}
    </KioskLocale>
  );
}
