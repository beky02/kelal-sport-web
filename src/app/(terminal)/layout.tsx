import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "KelalSport",
  // A shop's kiosk host has nothing for a search engine.
  robots: { index: false, follow: false },
};

/**
 * The shop terminal's root layout (FD1). Its own `<html>`, so a kiosk never
 * loads the player's providers, session or account code, and a player never
 * loads the terminal's; the proxy serves it only on a terminal host. The
 * theme is fixed: a kiosk keeps no preferences. F8b adds what the terminal
 * runs on.
 */
export default function TerminalLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="am"
      data-theme="dark"
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="bg-ground text-text flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
