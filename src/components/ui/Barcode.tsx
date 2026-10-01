/**
 * The bar pattern printed on a ticket.
 *
 * Deterministic from the code, so the same ticket always draws the same bars and
 * the artwork is stable across renders and reloads.
 *
 * NOT a machine-readable symbology. It stands in for one at the right size and
 * weight, and the code itself is printed above it for reading or typing in. Before
 * agent shops scan tickets this needs to become real Code 128 — the layout will
 * not have to change, only `pattern`.
 */
function pattern(code: string, barCount: number, seed: number): number[][] {
  // 32-bit arithmetic via imul, so the sequence is exact rather than relying on
  // float truncation.
  let hash = seed;
  for (const character of code) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  }

  // Quiet zone, then a start guard.
  const bars: number[][] = [
    [2, 1],
    [1, 0],
    [1, 1],
    [1, 0],
  ];
  for (let i = 0; i < barCount; i++) {
    hash = (Math.imul(hash, 1103515245) + 12345) >>> 0;
    bars.push([1 + ((hash >>> 16) % 3), i % 2 === 0 ? 1 : 0]);
  }
  bars.push([1, 0], [2, 1]);
  return bars;
}

export function Barcode({
  code,
  barCount = 60,
  seed = 11,
  label,
  className,
}: {
  code: string;
  barCount?: number;
  seed?: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${label}: ${code}`}
      className={`flex h-[62px] rounded-md bg-white px-3.5 py-2.5 ${className ?? ""}`}
    >
      {pattern(code, barCount, seed).map(([width, dark], index) => (
        <span
          key={index}
          style={{
            flex: `${width} 0 0`,
            background: dark ? "#1d1f20" : "transparent",
          }}
        />
      ))}
    </div>
  );
}
