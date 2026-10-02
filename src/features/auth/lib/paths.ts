/**
 * Where to go after logging in (`/login?next=…`), if it is a path on this site.
 *
 * Anything that could leave the site — another origin, a protocol-relative
 * `//host`, a backslash trick, a scheme — goes home instead. The proxy writes
 * `next`; a link anyone can craft must not be able to send a freshly logged-in
 * player elsewhere.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return /^[\x21-\x7e]+$/.test(raw) ? raw : "/";
}
