"use client";

import { useId, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import type { Interpolations, MessageKey } from "@/lib/i18n";
import { useActivateTerminal } from "../hooks/use-terminal";
import { normaliseActivationCode } from "../lib/code";
import { Bilingual } from "./Bilingual";

type Message = { key: MessageKey; values?: Interpolations };

/**
 * What a refused activation says (AC-4), by the Problem's `code`. Too many
 * tries says when, from `Retry-After`, rounded up to whole minutes. A key the
 * browser could not make or keep is not the server's fault and says so.
 */
function refusalOf(error: unknown): Message {
  if (!(error instanceof ApiError)) {
    return { key: "terminal.activate.unsupported" };
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
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const messageId = `${id}-message`;

  const message: Message | null = invalid
    ? { key: "terminal.activate.format" }
    : activation.isError
      ? refusalOf(activation.error)
      : lapsed
        ? { key: "terminal.activate.lapsed" }
        : null;
  const isError = invalid || activation.isError;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (activation.isPending) return;
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
            setCode(event.target.value.toUpperCase());
            setInvalid(false);
            if (activation.isError) activation.reset();
          }}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={16}
          aria-invalid={isError || undefined}
          aria-describedby={message ? messageId : undefined}
          className="font-display bg-raised text-text h-14 w-full rounded-md border-0 px-4 text-center text-2xl outline-none"
        />

        <div
          id={messageId}
          role={isError ? "alert" : undefined}
          aria-live="polite"
          className={
            isError
              ? "text-loss flex min-h-6 flex-col gap-0.5 text-sm"
              : "text-muted flex min-h-6 flex-col gap-0.5 text-sm"
          }
        >
          {message && <Bilingual k={message.key} values={message.values} />}
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
