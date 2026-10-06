"use client";

import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query/client";
import { RealtimeProvider } from "@/lib/websocket/RealtimeProvider";
import { useUiStore } from "@/stores/ui.store";
import { PlayerLocale } from "./locale";
import { PlayerSportsbookChrome } from "./sportsbook-chrome";

/**
 * Mirrors theme and language onto <html>.
 *
 * Both are CSS-variable switches (`[data-theme]`, `[lang]`), so putting them on
 * the root element is all it takes — no class juggling in components. The
 * blocking script in `layout.tsx` sets the same attributes before first paint;
 * this keeps them in step afterwards.
 */
function DocumentPreferences() {
  const theme = useUiStore((s) => s.theme);
  const lang = useUiStore((s) => s.lang);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.lang = lang;
  }, [theme, lang]);

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
