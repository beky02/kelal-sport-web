/** Telegram's share sheet for a link of ours (D7: one link set for web and app). */
export const telegramShareUrl = (url: string, text: string): string =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

/**
 * A path on this site as an absolute link, on the host the player is on — the
 * tenant's own. Only for links built in the browser; on the server the path
 * stays relative.
 */
export const absoluteUrl = (path: string): string =>
  typeof window === "undefined"
    ? path
    : new URL(path, window.location.origin).toString();
