import { loadEvent } from "@/lib/server/catalogue";
import { isLite, respond } from "@/lib/server/respond";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/catalogue/events/[id]">,
) {
  const { id } = await ctx.params;
  // A fixture that does not exist is `null`, not an error: the page has a state
  // for it, and a 404 would be retried as a failure.
  return respond(request, ({ tenant, params }) =>
    loadEvent(tenant, id, isLite(params)),
  );
}
