"use client";

import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query/client";
import { RealtimeProvider } from "@/lib/websocket/RealtimeProvider";
import { useUiStore } from "@/stores/ui.store";
import { PlayerLocale } from "./locale";
import { PlayerSportsbookChrome } from "./sportsbook-chrome";

/**
 * Mirrors the theme onto <html> (`[data-theme]`, a CSS-variable switch). The
 * blocking script in `layout.tsx` sets it before first paint; this keeps it in
 * step afterwards. The language (`[lang]`) is `PlayerLocale`'s: it sets it in a
 * layout effect, before any request below it reads it.
 */
function DocumentPreferences() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser session, created lazily so it is never shared
  // between requests on the server.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <DocumentPreferences />
      <PlayerLocale>
        {/* Inside the query provider: realtime messages patch its caches. */}
        <RealtimeProvider>
          <PlayerSportsbookChrome>{children}</PlayerSportsbookChrome>
        </RealtimeProvider>
      </PlayerLocale>
    </QueryClientProvider>
  );
}
