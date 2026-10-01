import "server-only";
import { tenantForHost } from "./config";
import { UpstreamError } from "./upstream";

const problem = (status: number, code: string, title: string) =>
  Response.json(
    { type: "about:blank", title, status, code },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );

/**
 * Runs a route handler's read and answers in the API's own terms.
 *
 * Success is plain JSON. An API error passes through with its status and its
 * `Problem` body untouched, so the UI switches on the same `code` and reads the
 * same `errors[]` it would get from the API directly. An API that cannot be
 * reached becomes `SERVICE_UNAVAILABLE`, never an HTML error page.
 */
export async function respond<T>(
  request: Request,
  load: (ctx: { tenant: string; params: URLSearchParams }) => Promise<T>,
): Promise<Response> {
  const tenant = tenantForHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );
  try {
    const body = await load({
      tenant,
      params: new URL(request.url).searchParams,
    });
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UpstreamError) {
      return error.problem && typeof error.problem === "object"
        ? Response.json(error.problem, {
            status: error.status,
            headers: { "Content-Type": "application/problem+json" },
          })
        : problem(
            error.status,
            "SERVICE_UNAVAILABLE",
            "The sportsbook API failed",
          );
    }
    console.error(error);
    return problem(
      503,
      "SERVICE_UNAVAILABLE",
      "The sportsbook API could not be reached",
    );
  }
}

/** `?lite=1` — the data-saver flag, which drops crests and flags. */
export const isLite = (params: URLSearchParams) => params.get("lite") === "1";
