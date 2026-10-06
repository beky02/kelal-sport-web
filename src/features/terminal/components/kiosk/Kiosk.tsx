"use client";

import { useTerminalConfig } from "../../hooks/use-kiosk";
import type { TerminalInfo } from "../../types";
import {
  TerminalLoadingMessage,
  TerminalOfflineMessage,
  TerminalShell,
  TerminalUnavailable,
} from "../TerminalScreens";
import { KioskLocale } from "./KioskLocale";
import { KioskSportsbook } from "./KioskSportsbook";

/**
 * An activated terminal of an open shop (F8ca): the sportsbook, in the
 * kiosk's language, once the tenant's config says it sells in shops. Until
 * the config is read — or while it can't be — the shop's bar and a bilingual
 * message; with shop betting off, says so and offers nothing.
 */
export function Kiosk({ terminal }: { terminal: TerminalInfo }) {
  const config = useTerminalConfig();
  const view = config.data ?? null;

  return (
    <KioskLocale config={view}>
      {view?.retail ? (
        <KioskSportsbook terminal={terminal} languages={view.languages} />
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
