"use client";

import { useId, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import type { Interpolations, MessageKey } from "@/lib/i18n";
import { useActivateTerminal } from "../hooks/use-terminal";
import { normaliseActivationCode } from "../lib/code";
import { DeviceKeyError } from "../lib/device-key";
import { Bilingual } from "./Bilingual";

type Message = { key: MessageKey; values?: Interpolations };

/**
 * What a refused activation says (AC-4), by the Problem's `code`. Too many
 * tries says when, from `Retry-After`, rounded up to whole minutes. A key the
 * browser could not make or keep is not the server's fault and says so;
 * anything else — the network, a 5xx, an answer that doesn't parse — is the
 * server's.
 */
function refusalOf(error: unknown): Message {
  if (error instanceof DeviceKeyError) {
    return { key: "terminal.activate.unsupported" };
  }
  if (!(error instanceof ApiError)) {
    return { key: "terminal.activate.unreachable" };
  }
  switch (error.code) {
    case "NOT_FOUND":
      return { key: "terminal.activate.wrongCode" };
    case "RETAIL_ACTIVATION_EXPIRED":
      return { key: "terminal.activate.expired" };
    case "RATE_LIMITED":
      return error.retryAfter
        ? {
            key: "terminal.activate.tooMany",
            values: { minutes: Math.max(1, Math.ceil(error.retryAfter / 60)) },
          }
        : { key: "terminal.activate.tooManyLater" };
    default:
      return { key: "terminal.activate.unreachable" };
  }
}

/**
 * The first screen of a shop PC, and of one whose token lapsed: the one-time
 * activation code (C19 §4.1). The code is normalised and checked here first,
 * so a typo never spends one of the five tries an hour the server allows.
 */
export function ActivationScreen({ lapsed }: { lapsed: boolean }) {
  const activation = useActivateTerminal();
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  // Each press of Activate, so a refusal said again is announced again.
  const [presses, setPresses] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const lapsedId = `${id}-lapsed`;
  const errorId = `${id}-error`;

  const error: Message | null = invalid
    ? { key: "terminal.activate.format" }
    : activation.isError
      ? refusalOf(activation.error)
      : null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (activation.isPending) return;
    setPresses((n) => n + 1);
    const normalised = normaliseActivationCode(code);
    if (!normalised) {
      setInvalid(true);
      input.current?.focus();
      return;
    }
    setInvalid(false);
    activation.mutate(normalised, {
      onError: () => input.current?.focus(),
    });
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <form
        onSubmit={submit}
        noValidate
        className="flex w-full max-w-md flex-col items-center gap-3 text-center"
      >
        <div
          className="bg-raised text-accent grid size-16 place-items-center rounded-lg"
          aria-hidden
        >
          <KeyRound className="size-8" />
        </div>
        <h1 className="mt-2 flex flex-col gap-1 text-2xl md:text-3xl">
          <Bilingual k="terminal.activate.title" />
        </h1>
        <p className="text-muted flex flex-col gap-1 text-base text-pretty">
          <Bilingual k="terminal.activate.body" />
        </p>
        {lapsed && (
          // Why an activated PC is back here: said first, not as a field hint.
          <p
            id={lapsedId}
            className="bg-warn-bg text-warn flex w-full flex-col gap-0.5 rounded-md px-4 py-3 text-sm"
          >
            <Bilingual k="terminal.activate.lapsed" />
          </p>
        )}

        <label
          htmlFor={id}
          className="text-text/80 mt-4 flex flex-col gap-0.5 text-sm"
        >
          <Bilingual k="terminal.activate.label" />
        </label>
        <input
          ref={input}
          id={id}
          name="activationCode"
          value={code}
          onChange={(event) => {
            // As typed: the code is upper-cased when it is sent, and a value
            // rewritten on every key would move the caret to the end.
            setCode(event.target.value);
            setInvalid(false);
            if (activation.isError) activation.reset();
          }}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={16}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [lapsed ? lapsedId : null, error ? errorId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          // No outline override: the site's focus ring shows on the field.
          className="font-display bg-raised text-text h-14 w-full rounded-md border-0 px-4 text-center text-2xl"
        />

        {/* One alert region, always there; two lines reserved so nothing
            under it moves when a message arrives. */}
        <div
          id={errorId}
          role="alert"
          className="text-loss flex min-h-12 flex-col gap-0.5 text-sm"
        >
          {error && (
            <span key={presses} className="flex flex-col gap-0.5">
              <Bilingual k={error.key} values={error.values} />
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={activation.isPending}
          className="bg-accent text-on-accent mt-1 flex min-h-14 w-full cursor-pointer flex-col items-center justify-center rounded-md px-4 py-2 text-base font-extrabold hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
        >
          <Bilingual
            k={
              activation.isPending
                ? "terminal.activate.busy"
                : "terminal.activate.submit"
            }
          />
        </button>
      </form>
    </main>
  );
}
