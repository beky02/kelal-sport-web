"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SportsbookChromeProvider } from "@/features/sportsbook/chrome";
import { useTranslation } from "@/lib/i18n/use-translation";
import { KIOSK_CHROME } from "./chrome";
import { KioskLocale } from "./KioskLocale";

/**
 * While the terminal starts — its status, then the kiosk's config, on their
 * way — the page it is on, as the player's main page looks while it loads
 * (the user's second review): the kiosk's frame, the sidebar's and the
 * board's own loading rows, the day strip, the slip and the footer.
 *
 * It is the real page, in a query client of its own that reads nothing
 * (queries off by default), so the kiosk takes its place without a pixel
 * moving (review U1), and nothing is asked before the terminal is known to
 * sell. It is inert: nothing on it can be tapped or typed into. A screen
 * reader hears that the terminal is starting, in the page's language.
 */
export function KioskStarting({ children }: { children: React.ReactNode }) {
  const [held] = useState(
    () => new QueryClient({ defaultOptions: { queries: { enabled: false } } }),
  );
  return (
    <KioskLocale config={null}>
      <Starting />
      <QueryClientProvider client={held}>
        <SportsbookChromeProvider value={KIOSK_CHROME}>
          <div className="contents" inert>
            {children}
          </div>
        </SportsbookChromeProvider>
      </QueryClientProvider>
    </KioskLocale>
  );
}

function Starting() {
  const t = useTranslation();
  return (
    <p role="status" className="sr-only">
      {t.t("terminal.loading")}
    </p>
  );
}
