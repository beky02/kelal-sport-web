import { TerminalApp } from "@/features/terminal/components/TerminalApp";

/**
 * The shop terminal (F8b; `/` on a terminal host). Static: what the terminal
 * is depends on this PC's device key and cookie, so it is decided in the
 * browser after the first paint (C18 §5, client-rendered).
 */
export default function TerminalPage() {
  return <TerminalApp />;
}
