import "server-only";
import type { Lang } from "@/types/common";
import { tenantFromHeaders } from "./config";
import { SessionGoneError } from "./session";
import { UpstreamError } from "./upstream";

/** A Problem this app answers itself, in the API's own shape. */
export const problemResponse = (
  status: number,
  code: string,
  title: string,
  headers?: Headers,
) => {
  const h = new Headers(headers);
  h.set("Content-Type", "application/problem+json");
  return Response.json(
    { type: "about:blank", title, status, code },
    { status, headers: h },
  );
};

const problem = problemResponse;

/** The UI's language, as `apiClient` sends it; English when it says nothing. */
export const langFromHeaders = (headers: Headers): Lang =>
  /^\s*am\b/i.test(headers.get("accept-language") ?? "") ? "am" : "en";

/** What a route handler's loader is given. */
export interface RouteContext {
  tenant: string;
  params: URLSearchParams;
  lang: Lang;
  request: Request;
  /** Adds a `Set-Cookie` header to the response — success or Problem alike. */
  setCookie: (header: string) => void;
}

/**
 * Runs a route handler's read and answers in the API's own terms.
 *
 * Success is plain JSON (or an empty 204). An API error passes through with
 * its status and its `Problem` body untouched, so the UI switches on the same
 * `code` and reads the same `errors[]` it would get from the API directly. An
 * API that cannot be reached becomes `SERVICE_UNAVAILABLE`, never an HTML
 * error page. Cookies the loader set — a rotated session, a cleared one — go
 * out on every answer, because a rotation that is not saved logs the player out.
 */
export async function respond<T>(
  request: Request,
  load: (ctx: RouteContext) => Promise<T>,
  { status = 200 }: { status?: number } = {},
): Promise<Response> {
  const tenant = tenantFromHeaders(request.headers);
  const cookies: string[] = [];
  const headers = () => {
    const h = new Headers({ "Cache-Control": "no-store" });
    for (const value of cookies) h.append("Set-Cookie", value);
    return h;
  };
  try {
    const body = await load({
      tenant,
      params: new URL(request.url).searchParams,
      lang: langFromHeaders(request.headers),
      request,
      setCookie: (header) => cookies.push(header),
    });
    if (status === 204)
      return new Response(null, { status, headers: headers() });
    return Response.json(body, { status, headers: headers() });
  } catch (error) {
    if (error instanceof SessionGoneError) {
      return problem(
        401,
        "AUTH_TOKEN_EXPIRED",
        "Your session has ended",
        headers(),
      );
    }
    if (error instanceof UpstreamError) {
      if (error.problem && typeof error.problem === "object") {
        const h = headers();
        h.set("Content-Type", "application/problem+json");
        return Response.json(error.problem, {
          status: error.status,
          headers: h,
        });
      }
      return problem(
        error.status,
        "SERVICE_UNAVAILABLE",
        "The sportsbook API failed",
        headers(),
      );
    }
    console.error(error);
    return problem(
      503,
      "SERVICE_UNAVAILABLE",
      "The sportsbook API could not be reached",
      headers(),
    );
  }
}

/** `?lite=1` — the data-saver flag, which drops crests and flags. */
export const isLite = (params: URLSearchParams) => params.get("lite") === "1";
