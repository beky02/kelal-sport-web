"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query/client";

/**
 * The terminal's own providers (F8b): a query client, and nothing of the
 * player's — no session, no preferences store, no realtime channel. Created
 * lazily, so it is never shared between requests on the server.
 */
export function TerminalProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
