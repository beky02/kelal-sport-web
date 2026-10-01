"use client";

/**
 * "Nothing here" and "that failed" are different situations and must not look
 * the same: one is a normal, correct answer, the other is a fault with a retry.
 */
export function StateMessage({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
      <div className="bg-raised text-muted grid size-13 place-items-center rounded-lg">
        {icon}
      </div>
      <div className="font-display mt-2 text-lg">{title}</div>
      <p className="text-muted max-w-[280px]">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="border-divider text-text font-body mt-1.5 h-10 cursor-pointer rounded-md border bg-transparent px-4 text-[13px] font-bold"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
