import { z } from "zod";
import { slipCodeCreateSchema } from "@/lib/api/terminal-schemas";
import { BODY_CAPS, readText } from "@/lib/server/body";
import { assertSameOrigin } from "@/lib/server/csrf";
import { problemResponse, respond } from "@/lib/server/respond";
import {
  activeTerminal,
  createSlipCode,
  deviceSignature,
  terminalOnly,
} from "@/lib/server/terminal";
import { mockPreference } from "@/lib/server/upstream";

const idempotencyKeySchema = z.uuid();

/** Never cached: every answer is this terminal's, about this slip. */
const noStore = (response: Response) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};

/**
 * Get code (F8cc, C19 §4.2): the kiosk's slip turned into an 8-digit slip
 * code, by an activated terminal of this tenant only. Everything is checked
 * before the API is called, in this order — a terminal host; this site's own
 * page (origin, the CSRF header, JSON); the terminal's cookie, unexpired; one
 * `Idempotency-Key` per Get code (a UUID, the browser's, never made here);
 * the device signature's shape and clock (D3); and the body — at most 16 KiB
 * of UTF-8, the contract's `SlipCodeCreate` and nothing more.
 *
 * The browser signed the API call over that body's exact bytes, so the text
 * read here is what goes upstream, byte for byte (F8b decision 2); the
 * terminal's id comes from its sealed cookie, never from the browser. Prism's
 * `Prefer` goes along under `next dev` only, and never to the real API.
 */
export async function POST(request: Request) {
  const elsewhere = terminalOnly(request);
  if (elsewhere) return elsewhere;
  const refused = assertSameOrigin(request);
  if (refused) return noStore(refused);
  const session = activeTerminal(request);
  if (session instanceof Response) return session;

  const key = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!key.success) {
    return noStore(
      problemResponse(400, "VALIDATION_FAILED", "Idempotency-Key required"),
    );
  }
  const device = deviceSignature(request);
  if (device instanceof Response) return device;

  const text = await readText(request, BODY_CAPS.slip);
  if (text === "too_large") {
    return noStore(problemResponse(413, "VALIDATION_FAILED", "Too large"));
  }
  let json: unknown = null;
  try {
    json = text === null ? null : JSON.parse(text);
  } catch {
    json = null;
  }
  const body = slipCodeCreateSchema.safeParse(json);
  if (text === null || !body.success) {
    return noStore(
      problemResponse(422, "VALIDATION_FAILED", "Not a slip code request"),
    );
  }

  return respond(
    request,
    (ctx) =>
      createSlipCode(
        { ...ctx, prefer: mockPreference(request.headers.get("prefer")) },
        session,
        device,
        { text, body: body.data },
        key.data,
      ),
    { status: 201 },
  );
}
