import { useMemo, useSyncExternalStore } from "react";

/**
 * `next/navigation`, in memory, for screens whose state lives in the URL (the
 * kiosk's board filters, F8ca): `useRouter().replace` moves the address and
 * `useSearchParams` / `usePathname` re-render with it, as the App Router
 * does. A test file mocks the module with it:
 *
 *   vi.mock("next/navigation", () => import("./navigation"));
 *
 * and reads or sets the address with `address`.
 */

const ORIGIN = "http://terminal.localhost";
let url = new URL("/", ORIGIN);
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The address the screen is at, and a way to open another. */
export const address = {
  /** Path and query, as the address bar shows them. */
  get href() {
    return `${url.pathname}${url.search}`;
  },
  get params() {
    return new URLSearchParams(url.search);
  },
  /** Opens `path` (between tests, or as a link would). */
  go(path = "/") {
    url = new URL(path, ORIGIN);
    notify();
  },
};

const navigate = (href: string) => {
  url = new URL(href, url);
  notify();
};

const router = {
  replace: navigate,
  push: navigate,
  refresh: () => undefined,
  back: () => undefined,
  forward: () => undefined,
  prefetch: () => undefined,
};

export const useRouter = () => router;

export const usePathname = () =>
  useSyncExternalStore(subscribe, () => url.pathname);

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => url.search);
  return useMemo(() => new URLSearchParams(search), [search]);
}
