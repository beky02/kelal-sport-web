"use client";

import { useTerminalStatus } from "../hooks/use-terminal";
import type { TerminalStatus } from "../types";
import { ActivationScreen } from "./ActivationScreen";
import {
  TerminalBlocked,
  TerminalClosed,
  TerminalLoading,
  TerminalOffline,
  TerminalReady,
  TerminalShell,
} from "./TerminalScreens";

/**
 * The shop terminal (F8b): what the server says it is, read on boot and every
 * 5 minutes. Once there is an answer, a failed read changes nothing on screen
 * — the next read tries again — and a background rotation never shows.
 */
export function TerminalApp() {
  const status = useTerminalStatus();
  if (status.data) return <TerminalScreen status={status.data} />;
  if (status.isError) {
    return (
      <TerminalOffline
        onRetry={() => void status.refetch()}
        retrying={status.isFetching}
      />
    );
  }
  return <TerminalLoading />;
}

function TerminalScreen({ status }: { status: TerminalStatus }) {
  switch (status.state) {
    case "inactive":
      return <ActivationScreen lapsed={status.reason === "expired"} />;
    case "blocked":
      return <TerminalBlocked reason={status.reason} />;
    case "active":
      return (
        <TerminalShell terminal={status.terminal}>
          {status.terminal.shop.openNow ? (
            <TerminalReady />
          ) : (
            <TerminalClosed />
          )}
        </TerminalShell>
      );
  }
}
