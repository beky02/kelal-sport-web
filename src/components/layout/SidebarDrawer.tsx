"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUiStore } from "@/stores/ui.store";
import { Sidebar } from "./Sidebar";

/**
 * The sidebar on a narrow screen.
 *
 * Slides in from the leading edge and closes as soon as a sport is picked, so
 * choosing one is a single gesture rather than pick-then-dismiss.
 */
export function SidebarDrawer({ live }: { live: boolean }) {
  const t = useTranslation();
  const open = useUiStore((s) => s.sidebarOpen);
  const setOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 lg:hidden" />
        <Dialog.Content className="bg-ground border-border fixed inset-y-0 start-0 z-50 flex w-[min(300px,88vw)] flex-col border-e outline-none lg:hidden">
          <div className="flex items-center justify-between px-3 py-2">
            <Dialog.Title className="font-display text-base">
              {t.t("sidebar.sports")}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t.t("betSlip.close")}
              className="text-text grid size-10 cursor-pointer place-items-center rounded-md bg-transparent"
            >
              <X size={18} strokeWidth={1.5} aria-hidden />
            </Dialog.Close>
          </div>
          <div
            className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4"
            onClick={(event) => {
              // Any navigation inside the drawer has served its purpose.
              if ((event.target as HTMLElement).closest("a,button")) {
                setOpen(false);
              }
            }}
          >
            <Sidebar live={live} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
