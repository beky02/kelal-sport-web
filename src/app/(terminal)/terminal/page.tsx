import { Suspense } from "react";
import { TerminalApp } from "@/features/terminal/components/TerminalApp";
import { TerminalLoading } from "@/features/terminal/components/TerminalScreens";

/**
 * The shop terminal (F8b; `/` on a terminal host). Static: what the terminal
 * is depends on this PC's device key and cookie, so it is decided in the
 * browser after the first paint (C18 §5, client-rendered). The kiosk keeps
 * its board filters in the URL (F8ca), so the app sits in a `<Suspense>` for
 * `useSearchParams`, as the player's home does.
 */
export default function TerminalPage() {
  return (
    <Suspense fallback={<TerminalLoading />}>
      <TerminalApp />
    </Suspense>
  );
}
