"use client";

import { usePathname, useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { safeNextPath } from "../lib/paths";
import { useAuthStore } from "../stores/auth.store";

/**
 * Closes the dialog at the end of a flow — signed in, registered, verified or
 * deferred — and goes where the player was going, when they were going
 * somewhere: a `?next=`, or anywhere but `/login` and `/register` themselves.
 * Opened over a page, the player stays on it.
 */
export function useFinishAuth(): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const next = useAuthStore((s) => s.next);
  const close = useAuthStore((s) => s.close);

  return () => {
    const destination =
      next !== null || pathname === routes.login || pathname === routes.register
        ? safeNextPath(next)
        : null;
    close();
    if (destination !== null) router.replace(destination);
  };
}
