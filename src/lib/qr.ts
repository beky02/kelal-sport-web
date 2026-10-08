/**
 * A QR code as data (F8cc): the dark modules `qrcode` works out (C18 §5–6
 * names it), and the one SVG path that draws them. Only the encoder's matrix
 * is used — no canvas, no markup from it — so the drawing is ours, black on
 * white like `Barcode`, and nothing the API sends reaches the DOM as markup.
 */

/** The white border a scanner needs around the symbol, in modules (ISO/IEC 18004). */
export const QUIET_ZONE = 4;

/** A QR symbol: `size` × `size` modules, row by row, 1 for dark. */
export interface QrModules {
  size: number;
  data: Uint8Array;
}

/**
 * `text` as a QR symbol (error correction M), or null when it can't be one —
 * empty, or more than a symbol holds. The encoder is loaded on first use, so
 * it is never part of a page until a code is shown.
 */
export async function encodeQr(text: string): Promise<QrModules | null> {
  if (text === "") return null;
  const { create } = await import("qrcode");
  try {
    const { modules } = create(text, { errorCorrectionLevel: "M" });
    return { size: modules.size, data: modules.data };
  } catch {
    return null;
  }
}

/**
 * The symbol as one path: each row's runs of dark modules as
 * `M x y h w v1 h-w z`, offset by the quiet zone. `modules` is the drawing's
 * width and height, quiet zone included, for the `viewBox`.
 */
export function qrPath({ size, data }: QrModules): {
  d: string;
  modules: number;
} {
  let d = "";
  for (let row = 0; row < size; row += 1) {
    let col = 0;
    while (col < size) {
      if (!data[row * size + col]) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < size && data[row * size + col]) col += 1;
      const run = col - start;
      d += `M${start + QUIET_ZONE} ${row + QUIET_ZONE}h${run}v1h-${run}z`;
    }
  }
  return { d, modules: size + 2 * QUIET_ZONE };
}
