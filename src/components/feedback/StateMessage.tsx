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
  level = 2,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  /** A retry is a button; a way elsewhere is a link (it works before hydration). */
  action?:
    { label: string; onClick: () => void } | { label: string; href: string };
  /** 1 when the message is the page itself (a public page's 404). */
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
      <div className="bg-raised text-muted grid size-13 place-items-center rounded-lg">
        {icon}
      </div>
      <Heading className="font-display mt-2 text-lg">{title}</Heading>
      <p className="text-muted max-w-[280px] text-pretty">{body}</p>
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
