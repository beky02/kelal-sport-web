"use client";

import { Dialog } from "radix-ui";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Segmented } from "@/components/ui/Segmented";
import { LICENCE } from "@/config/constants";
import { useChangeLanguage } from "@/features/profile/hooks/use-account";
import { LANG_LABEL } from "@/lib/i18n";
import { useUiStore } from "@/stores/ui.store";
import type { Lang } from "@/types/common";
import { cn } from "@/lib/utils/cn";
import { SystemActions, type SystemAction } from "./SystemDialog";

/**
 * A takeover for when there is nothing useful behind it.
 *
 * The age gate and a maintenance window both stop the product working, so they
 * get the whole screen rather than a dialog over a board the user cannot use.
 * Keeps its own header with the language switch, because someone who lands on
 * the age gate in the wrong script still has to be able to read it.
 */
export function FullScreenNotice({
  open,
  badge,
  badgeTone = "accent",
  title,
  body,
  notes,
  actions,
}: {
  open: boolean;
  badge: string;
  badgeTone?: "accent" | "neutral";
  title: string;
  body: string;
  notes: string[];
  actions: SystemAction[];
}) {
  const t = useTranslation();
  const lang = useUiStore((s) => s.lang);
  const setLang = useChangeLanguage();

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Content
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="bg-ground fixed inset-0 z-50 flex flex-col overflow-y-auto outline-none"
        >
          <div className="bg-surface border-divider flex h-14 shrink-0 items-center justify-between border-b px-5">
            <span className="flex items-center gap-2">
              <span className="bg-accent text-on-accent font-display grid size-[26px] place-items-center rounded-lg text-[15px] font-bold">
                K
              </span>
              <span className="font-display text-[19px]">
                Kelal<span className="text-accent">Sport</span>
              </span>
            </span>
            <Segmented<Lang>
              value={lang}
              onChange={setLang}
              size="sm"
              options={[
                { value: "en", label: LANG_LABEL.en },
                { value: "am", label: LANG_LABEL.am },
              ]}
            />
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-10">
            <div className="flex w-[480px] max-w-full flex-col gap-4">
              <span
                className={cn(
                  "self-start rounded-full px-2.5 py-[3px] text-[11px] font-extrabold tracking-[0.06em]",
                  badgeTone === "accent"
                    ? "bg-accent-100 text-accent"
                    : "bg-raised text-muted",
                )}
              >
                {badge}
              </span>

              <Dialog.Title className="text-4xl leading-[1.1]">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-muted text-[15px] text-pretty">
                {body}
              </Dialog.Description>

              {notes.map((note) => (
                <div key={note} className="flex items-start gap-2.5 text-sm">
                  <span
                    aria-hidden
                    className="bg-accent mt-2 size-1.5 shrink-0 rounded-full"
                  />
                  <span>{note}</span>
                </div>
              ))}

              <div className="mt-1.5">
                <SystemActions actions={actions} />
              </div>
            </div>
          </div>

          <div className="text-muted flex shrink-0 items-center justify-center gap-2 p-4 text-xs">
            <span className="border-text text-text rounded-[4px] border-[1.5px] px-[5px] font-bold">
              {LICENCE.minimumAge}+
            </span>
            {t.t("footer.licenceShort")}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
