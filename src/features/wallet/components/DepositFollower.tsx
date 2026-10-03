"use client";

import { useEffect } from "react";
import { useSession } from "@/features/auth/hooks/use-session";
import { useDepositIntents, useDeposit } from "../hooks/use-payments";
import { isFinal } from "../lib/deposit";
import { useDepositStore } from "../stores/deposit.store";

/**
 * Keeps reading the signed-in player's unfinished deposits wherever they are
 * on the site — the deposit's own screen may be long closed when the push is
 * approved on the phone — so the balance and the history move when the API
 * says the money arrived, and only then (`useDeposit`). Each stops at its
 * final status; reading pauses while the tab is hidden. Mounted once, in the
 * shell, beside the session watcher; renders nothing.
 */
export function DepositFollower() {
  const { player } = useSession();
  const { following } = useDepositIntents(player?.id ?? null);
  return following.map((id) => <FollowDeposit key={id} id={id} />);
}

function FollowDeposit({ id }: { id: string }) {
  const status = useDeposit(id).data?.status;
  useEffect(() => {
    if (status && isFinal(status)) useDepositStore.getState().finished(id);
  }, [status, id]);
  return null;
}
