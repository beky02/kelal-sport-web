"use client";

import { useEffect, useState } from "react";
import { encodeQr, qrPath } from "@/lib/qr";
import { cn } from "@/lib/utils/cn";

/**
 * `text` as a QR code (F8cc: the shop kiosk's slip code), for a phone or a
 * counter's scanner. Black on white in every theme, as `Barcode` is, because
 * a scanner needs the contrast; drawn as one SVG path from the symbol's
 * modules (`lib/qr.ts`). The encoder loads when the first code is shown; until
 * then — or if it can't load, or the text can't be a symbol — the square is
 * empty paper, and the code beside it is still there to read and type.
 */
export function QrCode({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [drawing, setDrawing] = useState<{
    text: string;
    d: string;
    modules: number;
  } | null>(null);

  useEffect(() => {
    let current = true;
    encodeQr(text)
      .then((modules) => {
        if (current) setDrawing(modules ? { text, ...qrPath(modules) } : null);
      })
      .catch(() => {
        if (current) setDrawing(null);
      });
    return () => {
      current = false;
    };
  }, [text]);

  // Never the last code's symbol under a new code.
  const shown = drawing?.text === text ? drawing : null;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("bg-barcode-paper aspect-square rounded-md", className)}
    >
      {shown && (
        <svg
          viewBox={`0 0 ${shown.modules} ${shown.modules}`}
          shapeRendering="crispEdges"
          aria-hidden
          focusable="false"
          data-testid="qr-symbol"
          className="fill-barcode-ink size-full"
        >
          <path d={shown.d} />
        </svg>
      )}
    </div>
  );
}
