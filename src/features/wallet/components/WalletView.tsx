"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import { StateMessage } from "@/components/feedback/StateMessage";
import { Skeleton } from "@/components/ui/Skeleton";
import { routes } from "@/config/routes";
import { useSession } from "@/features/auth/hooks/use-session";
import { useRecentTransactions, useWallet } from "../hooks/use-wallet";
import { rememberedDeposit } from "../lib/provider-redirect";
import { DepositFlow } from "./DepositFlow";
import { FlowHeader } from "./FlowHeader";
import { WalletGuest } from "./WalletGuest";
import { WalletHome } from "./WalletHome";
import { WithdrawFlow, type WithdrawSeed } from "./WithdrawFlow";
import { WithdrawalStatus } from "./WithdrawalStatus";

type View =
  | { name: "home" }
  | { name: "deposit"; resumeId: string | null }
  | { name: "withdraw"; seed: WithdrawSeed | null }
  | { name: "withdrawal"; id: string };

/**
 * The wallet: balances at rest, a deposit, a withdrawal, or where one
 * withdrawal stands.
 *
 * `?action=deposit|withdraw` opens a flow straight away — the header and the
 * slip's "Deposit to continue" already know what the player came to do —
 * `?deposit=return` is where a payment provider sends the player back (the
 * deposit this tab left to pay is shown again), and `?withdrawal={id}` is a
 * withdrawal's own screen, reached from its row in the history.
 */
export function WalletView() {
  const t = useTranslation();
  const router = useRouter();
  const params = useSearchParams();

  const action = params.get("action");
  const returning = params.get("deposit") === "return";
  const linked = params.get("withdrawal");

  const [view, setView] = useState<View>(
    linked
      ? { name: "withdrawal", id: linked }
      : action === "deposit"
        ? { name: "deposit", resumeId: null }
        : action === "withdraw"
          ? { name: "withdraw", seed: null }
          : { name: "home" },
  );

  // A withdrawal's address opened while the wallet is already on screen (a
  // row in its recent activity): the address changed under it.
  const [lastLinked, setLastLinked] = useState(linked);
  if (linked !== lastLinked) {
    setLastLinked(linked);
    if (linked) setView({ name: "withdrawal", id: linked });
  }

  const { isLoading, isGuest, player } = useSession();

  // Until /api/me answers, nobody is a guest and nothing is read.
  const signedIn = !isLoading && !isGuest;
  const wallet = useWallet(signedIn);
  // Asked for alongside the balance rather than once it has landed: the home
  // reads the same query, so recent activity doesn't wait a round trip.
  useRecentTransactions(signedIn);
  const balances = wallet.data;

  // Back from a provider's page: once the player is known, show the deposit
  // this tab left to pay — for this player only — and drop the marker from
  // the address, so a reload or Back doesn't land here again.
  const owner = player?.id ?? null;
  const [returnedFor, setReturnedFor] = useState<string | null>(null);
  if (returning && owner && returnedFor !== owner) {
    setReturnedFor(owner);
    const resumeId = rememberedDeposit(owner);
    if (resumeId) setView({ name: "deposit", resumeId });
  }
  useEffect(() => {
    if (returning && owner) router.replace(routes.wallet);
  }, [returning, owner, router]);

  if (!isLoading && isGuest) return <WalletGuest />;

  if (!balances || !owner) {
    // A failed read with nothing shown yet; a refetch that fails later keeps
    // the balances already on screen.
    if (wallet.isError) {
      return (
        <StateMessage
          icon={<TriangleAlert size={24} strokeWidth={1.5} />}
          title={t.t("wallet.loadFailedTitle")}
          body={t.t("wallet.loadFailedBody")}
          action={{
            label: t.t("common.retry"),
            onClick: () => void wallet.refetch(),
          }}
        />
      );
    }
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  // Leaving a withdrawal's screen takes its id out of the address, so a
  // reload lands on what is on screen, and its row opens it again.
  const show = (next: View) => {
    if (linked) router.replace(routes.wallet);
    setView(next);
  };
  const home = () => show({ name: "home" });
  const withdraw = (seed: WithdrawSeed | null) =>
    show({ name: "withdraw", seed });

  if (view.name === "deposit") {
    // Keyed by the player: someone else signing in starts afresh, and never
    // sees this player's deposit or its answer.
    return (
      <DepositFlow
        key={owner}
        owner={owner}
        resumeId={view.resumeId}
        onExit={home}
      />
    );
  }

  if (view.name === "withdraw") {
    // Keyed by the player, as a deposit is.
    return (
      <WithdrawFlow
        key={owner}
        owner={owner}
        available={balances.cash}
        seed={view.seed}
        onExit={home}
      />
    );
  }

  if (view.name === "withdrawal") {
    return (
      <>
        <FlowHeader
          title={t.t("wallet.withdrawalTitle")}
          step="result"
          onBack={home}
          backLabel={t.t("auth.back")}
        />
        <WithdrawalStatus
          key={`${owner}:${view.id}`}
          id={view.id}
          owner={owner}
          onDone={home}
          onBackToSports={() => router.push(routes.home)}
          onRetry={(withdrawal) =>
            withdraw({
              method: withdrawal.method,
              amount: withdrawal.amount,
              step: "account",
            })
          }
          onChooseAnother={(withdrawal) =>
            withdraw({
              method: null,
              amount: withdrawal.amount,
              step: "method",
            })
          }
        />
      </>
    );
  }

  return (
    <WalletHome
      balances={balances}
      onDeposit={() => setView({ name: "deposit", resumeId: null })}
      onWithdraw={() => withdraw(null)}
    />
  );
}
