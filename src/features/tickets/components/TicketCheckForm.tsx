"use client";

import Form from "next/form";
import { useId } from "react";
import { CircleAlert } from "lucide-react";
import { routes } from "@/config/routes";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The ticket check's form: a plain GET to `/t?ticket=…`, which the server
 * sends on to `/t/{number}` — so it works without JavaScript (C18 §9), and
 * with it is a client navigation. `start` is the `/t` page itself; `another`
 * sits under a ticket or its 404.
 *
 * Nothing typed is put back on the page, not even into the field: a crafted
 * link could otherwise carry any message onto the brand's own page.
 */
export function TicketCheckForm({
  variant,
  invalid = false,
}: {
  variant: "start" | "another";
  /** What was sent isn't a ticket number. */
  invalid?: boolean;
}) {
  const t = useTranslation();
  const inputId = useId();
  const errorId = useId();

  return (
    <section className="flex flex-col gap-2 p-4">
      {variant === "start" ? (
        <>
          <h1 className="font-display text-2xl">{t.t("ticket.checkTitle")}</h1>
          <p className="text-muted">{t.t("ticket.checkBody")}</p>
        </>
      ) : (
        <h2 className="font-display text-[15px]">
          {t.t("ticket.checkAnother")}
        </h2>
      )}

      <Form action={routes.ticketCheck} className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-muted text-[11px]">
          {t.t("ticket.numberLabel")}
        </label>
        <div className="flex gap-1.5">
          <input
            id={inputId}
            name="ticket"
            required
            maxLength={24}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={t.t("ticket.numberPlaceholder")}
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
            // The Latin number being typed is shown in capitals and tracked
            // out, as it is printed; the placeholder may be Amharic, which
            // takes neither.
            className="bg-raised text-text font-body focus-visible:outline-accent h-11 min-w-0 flex-1 rounded-md border-0 px-3 text-sm font-semibold tracking-[0.08em] uppercase placeholder:tracking-normal placeholder:normal-case focus-visible:outline-2"
          />
          <button
            type="submit"
            className="bg-accent text-on-accent font-body h-11 shrink-0 cursor-pointer rounded-md px-4 text-[13px] font-bold"
          >
            {t.t("ticket.check")}
          </button>
        </div>
        {invalid && (
          <p
            id={errorId}
            role="alert"
            className="bg-loss-bg flex items-start gap-2 rounded-md p-3 text-xs font-semibold"
          >
            <CircleAlert
              size={16}
              strokeWidth={1.5}
              aria-hidden
              className="text-loss mt-px shrink-0"
            />
            {t.t("ticket.invalid")}
          </p>
        )}
      </Form>
    </section>
  );
}
