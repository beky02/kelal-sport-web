import { TerminalApp } from "@/features/terminal/components/TerminalApp";

/**
 * Every kiosk page (F8ca: the home, a league, a match) behind the terminal's
 * own state (F8b): activation, its status, the shop's hours, the tenant's
 * switch. The page is the player's sportsbook page in the kiosk's chrome. The
 * kiosk's state is client-side — this PC's device key and cookie — so it is
 * decided in the browser after the first paint (C18 §5).
 */
export default function TerminalLayout({ children }: LayoutProps<"/terminal">) {
  return <TerminalApp>{children}</TerminalApp>;
}
