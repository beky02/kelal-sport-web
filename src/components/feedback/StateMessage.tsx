"use client";

import Link from "next/link";

const ACTION =
  "border-divider text-text font-body mt-1.5 inline-flex min-h-11 items-center rounded-md border bg-transparent px-4 text-[13px] font-bold";

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
  /** A retry is a button; a way elsewhere is a link (it works before hydration). */
  action?:
    { label: string; onClick: () => void } | { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
      <div className="bg-raised text-muted grid size-13 place-items-center rounded-lg">
        {icon}
      </div>
      <h2 className="font-display mt-2 text-lg">{title}</h2>
      <p className="text-muted max-w-[280px]">{body}</p>
      {action &&
        ("href" in action ? (
          <Link href={action.href} className={ACTION}>
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className={`${ACTION} cursor-pointer`}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
