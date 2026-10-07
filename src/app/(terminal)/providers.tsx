"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query/client";
import { terminalKeys } from "@/lib/query/keys";

/**
 * The terminal's query client: the app's, with the terminal's status as the
 * question asked again when a call is refused as not activated (F8ca).
 */
export const createTerminalQueryClient = () =>
  createQueryClient({ whoAmI: terminalKeys.status() });

/**
 * The terminal's own providers (F8b): a query client, and nothing of the
 * player's — no session, no preferences store, no realtime channel. Created
 * lazily, so it is never shared between requests on the server.
 */
export function TerminalProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createTerminalQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
