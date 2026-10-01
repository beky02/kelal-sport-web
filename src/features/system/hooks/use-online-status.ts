"use client";

import { useEffect } from "react";
import { useSystemStore } from "@/stores/system.store";

/**
 * Keeps the store's online flag in step with the browser.
 *
 * Mounted once, in the shell. Starts optimistic so the server-rendered markup
 * and the first client render agree, then corrects immediately.
 *
 * `navigator.onLine` is a weak signal — it means "a network exists", not "the
 * gateway answers" — so it drives a warning and locks prices, but the backend
 * still has the final say on any bet.
 */
export function NetworkWatcher() {
  const setOnline = useSystemStore((s) => s.setOnline);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [setOnline]);

  return null;
}
