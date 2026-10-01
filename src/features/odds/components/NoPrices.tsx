/**
 * The cells of a market the API has not priced for this fixture.
 *
 * A dash per track, so the row keeps its columns; never a lock, which would
 * claim the market exists and is suspended.
 */
export function NoPrices({ tracks = 3 }: { tracks?: number }) {
  return (
    <>
      {Array.from({ length: tracks }, (_, i) => (
        <span key={i} aria-hidden className="text-muted text-center text-xs">
          –
        </span>
      ))}
    </>
  );
}
