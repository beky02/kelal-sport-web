"use client";

import { useId, useRef } from "react";
import { LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { useAuthStore } from "@/features/auth/stores/auth.store";
import { useTranslation } from "@/lib/i18n/use-translation";
import { usePromotions } from "../hooks/use-promotions";
import { MyBonusSection } from "./MyBonusSection";
import { OfferCard } from "./OfferCard";
import { PromoCodeForm } from "./PromoCodeForm";

/**
 * Promotions (F7ca): the player's own part first — their bonus, free bets and
 * the code form — then the tenant's offers, which anyone may read. A guest is
 * asked to log in where the player's part would be; until `/api/me` answers,
 * neither shows.
 */
export function PromotionsView() {
  const t = useTranslation();
  const { isLoading, isGuest, player } = useSession();
  const openAuth = useAuthStore((s) => s.open);
  const codeField = useRef<HTMLInputElement>(null);
  const guest = !isLoading && isGuest;

  return (
    <div className="flex w-full flex-col pb-6">
      <div className="px-4 pt-4">
        <h1 className="text-2xl">{t.t("promotions.title")}</h1>
        <p className="text-muted text-sm">{t.t("promotions.intro")}</p>
      </div>

      {player ? (
        <>
          <MyBonusSection />
          <PromoCodeForm
            // A form per player: what one typed is nothing to the next.
            key={player.id}
            owner={player.id}
            fieldRef={codeField}
          />
        </>
      ) : guest ? (
        <div className="bg-raised mx-4 mt-5 flex flex-col gap-3 rounded-lg p-3.5">
          <div className="flex items-center gap-3">
            <LogIn
              size={22}
              strokeWidth={1.5}
              aria-hidden
              className="text-accent shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                {t.t("promotions.guestTitle")}
              </span>
              <span className="text-muted block text-xs">
                {t.t("promotions.guestBody")}
              </span>
            </span>
          </div>
          {/* A code needs an account to land on (C11): a new player enters
              theirs while signing up (REG-12). */}
          <p className="text-muted text-xs">
            {t.t("promotions.guestRegisterBody")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="bg-surface text-text font-body min-h-11 cursor-pointer rounded-md px-3.5 text-sm font-bold"
            >
              {t.t("header.login")}
            </button>
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="bg-accent text-on-accent font-body min-h-11 cursor-pointer rounded-md px-3.5 text-sm font-bold"
            >
              {t.t("header.register")}
            </button>
          </div>
        </div>
      ) : null}

      <Offers
        onEnterCode={
          player
            ? () => codeField.current?.focus()
            : guest
              ? () => openAuth("login")
              : undefined
        }
      />
    </div>
  );
}

/** The tenant's offers, from `/api/promotions`, in the API's order. */
function Offers({ onEnterCode }: { onEnterCode?: () => void }) {
  const t = useTranslation();
  const heading = useId();
  const failed = useId();
  const offers = usePromotions();

  return (
    <section aria-labelledby={heading} className="px-4 pt-6">
      <h2 id={heading} className="label-caps text-muted">
        {t.t("promotions.offersTitle")}
      </h2>
      {offers.data ? (
        offers.data.length === 0 ? (
          <div className="bg-raised mt-2 rounded-lg p-3.5">
            <p className="font-semibold">{t.t("promotions.offersNone")}</p>
            <p className="text-muted text-xs">
              {t.t("promotions.offersNoneBody")}
            </p>
          </div>
        ) : (
          <ul
            aria-label={t.t("promotions.offersTitle")}
            // Each card its own height: one with an image beside one without
            // would otherwise stretch the second into an empty box.
            className="mt-2 grid items-start gap-3 sm:grid-cols-2"
          >
            {offers.data.map((offer) => (
              <li key={offer.id}>
                <OfferCard offer={offer} onEnterCode={onEnterCode} />
              </li>
            ))}
          </ul>
        )
      ) : offers.isError ? (
        <div className="bg-raised mt-2 flex min-h-14 items-center gap-3 rounded-lg px-3.5 py-2">
          <span className="flex-1">
            <span id={failed} className="block text-sm font-semibold">
              {t.t("promotions.offersFailedTitle")}
            </span>
            <span className="text-muted block text-xs">
              {t.t("promotions.loadFailedBody")}
            </span>
          </span>
          <button
            type="button"
            aria-describedby={failed}
            onClick={() => void offers.refetch()}
            className="bg-surface text-text font-body min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-bold"
          >
            {t.t("common.retry")}
          </button>
        </div>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      )}
    </section>
  );
}
