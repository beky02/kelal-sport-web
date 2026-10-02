import "server-only";

/**
 * The request body as JSON, `null` when it is not JSON, or `"too_large"` —
 * without ever holding more than `maxBytes`, whatever `Content-Length` claims.
 */
export async function readJson(
  request: Request,
  maxBytes: number,
): Promise<unknown | "too_large"> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return "too_large";
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return "too_large";
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    return null;
  }
}
