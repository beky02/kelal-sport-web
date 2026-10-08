// @vitest-environment node
import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { QUIET_ZONE, encodeQr, qrPath, type QrModules } from "@/lib/qr";
import { responseExample } from "../contract";

/** The contract's `qr` for its slip code (`POST /v1/retail/slip-codes`, 201). */
const QR = (
  responseExample("/v1/retail/slip-codes", "post", 201) as { qr: string }
).qr;

/** Pixels per module: enough for the decoder to find the finder patterns. */
const SCALE = 4;

/**
 * The drawing as a scanner would see it: every `M x y h w v1 h-w z` of the
 * path painted black on white, `SCALE` pixels a module — the path itself,
 * not the matrix it came from, so a mistake in drawing fails here.
 */
function paint(d: string, modules: number) {
  const width = modules * SCALE;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  const dark = new Set<string>();
  for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    for (let i = 0; i < Number(w); i += 1) {
      dark.add(`${Number(x) + i},${y}`);
      for (let py = 0; py < SCALE; py += 1) {
        for (let px = 0; px < SCALE; px += 1) {
          const at =
            ((Number(y) * SCALE + py) * width + (Number(x) + i) * SCALE + px) *
            4;
          pixels.set([0, 0, 0, 255], at);
        }
      }
    }
  }
  return { pixels, width, dark };
}

describe("the slip code's QR (F8cc AC-1)", () => {
  it("draws a QR that decodes to the code's qr", async () => {
    const modules = (await encodeQr(QR)) as QrModules;
    const { d, modules: across } = qrPath(modules);
    const { pixels, width } = paint(d, across);
    expect(jsQR(pixels, width, width)?.data).toBe(QR);
  });

  it("draws exactly the dark modules, inside a quiet zone of four", async () => {
    const modules = (await encodeQr(QR)) as QrModules;
    const { d, modules: across } = qrPath(modules);
    expect(across).toBe(modules.size + 2 * QUIET_ZONE);
    const { dark } = paint(d, across);
    const expected = new Set<string>();
    for (let row = 0; row < modules.size; row += 1) {
      for (let col = 0; col < modules.size; col += 1) {
        if (modules.data[row * modules.size + col]) {
          expected.add(`${col + QUIET_ZONE},${row + QUIET_ZONE}`);
        }
      }
    }
    expect(dark).toEqual(expected);
  });

  it("encodes nothing it can't fit, rather than throwing", async () => {
    await expect(encodeQr("9".repeat(8000))).resolves.toBeNull();
    await expect(encodeQr("")).resolves.toBeNull();
  });
});
