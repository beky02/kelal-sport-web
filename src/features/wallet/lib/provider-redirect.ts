/**
 * Leaving for a payment provider's page, and finding the deposit again when
 * the player comes back (`/wallet?deposit=return`).
 *
 * The server has already checked the page's host against its allow-list
 * (`PAYMENT_REDIRECT_HOSTS`) before the URL reached the browser; this only
 * refuses to leave for anything that isn't https, whatever it was given.
 */

/** Sends this tab to the provider's page — an https URL, or nowhere. */
export function goToProvider(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  window.location.assign(parsed.href);
  return true;
}

/**
 * Where this tab keeps the deposit it left for, so the return can resume it.
 * Per tab, and only an id and whose it is: the id is useless without the
 * session, and no token, amount or balance is ever kept here.
 */
const KEY = "kelal.deposit";

interface Remembered {
  id: string;
  player: string;
}

/** Notes the deposit this tab is leaving to pay. */
export function rememberDeposit(id: string, player: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ id, player }));
  } catch {
    // No storage (a private window, blocked site data): the return lands on
    // the wallet, which reads the balance afresh anyway.
  }
}

/** The deposit this tab left to pay, if it was this player's. */
export function rememberedDeposit(player: string): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Remembered> | null;
    return typeof value?.id === "string" &&
      value.id.length > 0 &&
      value.player === player
      ? value.id
      : null;
  } catch {
    return null;
  }
}

/** Done with it: the deposit reached its end, or the player moved on. */
export function forgetDeposit(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing kept, nothing to clear.
  }
}
