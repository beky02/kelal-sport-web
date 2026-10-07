"use client";

import { useTerminalStatus } from "../hooks/use-terminal";
import type { TerminalStatus } from "../types";
import { ActivationScreen } from "./ActivationScreen";
import { Kiosk } from "./kiosk/Kiosk";
import {
  TerminalBlocked,
  TerminalClosed,
  TerminalBrandBar,
  TerminalOffline,
  TerminalStarting,
} from "./TerminalScreens";

/**
 * The shop terminal (F8b): what the server says it is, read on boot and every
 * 5 minutes. Once there is an answer, a failed read changes nothing on screen
 * — the next read tries again — and a background rotation never shows. An
 * active terminal of an open shop is the kiosk (F8ca), showing `children`:
 * the sportsbook page the kiosk is on.
 */
export function TerminalApp({ children }: { children: React.ReactNode }) {
  const status = useTerminalStatus();
  if (status.data) {
    return <TerminalScreen status={status.data}>{children}</TerminalScreen>;
  }
  if (status.isError) {
    return (
      <div className="flex flex-1 flex-col">
        <TerminalBrandBar />
        <TerminalOffline
          onRetry={() => void status.refetch()}
          retrying={status.isFetching}
        />
      </div>
    );
  }
  return <TerminalStarting />;
}

function TerminalScreen({
  status,
  children,
}: {
  status: TerminalStatus;
  children: React.ReactNode;
}) {
  switch (status.state) {
    case "inactive":
      return <ActivationScreen lapsed={status.reason === "expired"} />;
    case "blocked":
      return (
        <div className="flex flex-1 flex-col">
          <TerminalBrandBar />
          <TerminalBlocked reason={status.reason} />
        </div>
      );
    case "active":
      return status.terminal.shop.openNow ? (
        <Kiosk>{children}</Kiosk>
      ) : (
        <div className="flex flex-1 flex-col">
          <TerminalBrandBar />
          <main className="flex flex-1 flex-col items-center justify-center">
            <TerminalClosed />
          </main>
        </div>
      );
  }
}
