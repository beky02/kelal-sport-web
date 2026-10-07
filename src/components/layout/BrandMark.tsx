import Link from "next/link";
import { routes } from "@/config/routes";

export function BrandMark({ href = routes.home }: { href?: string } = {}) {
  return (
    <Link
      href={href}
      className="text-text flex shrink-0 items-center gap-[7px] no-underline md:gap-2"
    >
      <span className="bg-accent text-on-accent font-display grid size-6 place-items-center rounded-[7px] text-sm font-bold md:size-[26px] md:rounded-lg md:text-[15px]">
        K
      </span>
      <span className="font-display text-[17px] md:text-[19px]">
        Kelal<span className="text-accent">Sport</span>
      </span>
    </Link>
  );
}
