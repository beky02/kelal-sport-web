"use client";

import { useId } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A labelled control with optional help and error text.
 *
 * Wires the label, the description and the error message to the input by id, so
 * a screen reader reads the whole field rather than an unlabelled box. An error
 * replaces the help text — showing both makes the user read twice to find out
 * what is wrong.
 */
export function Field({
  label,
  trailing,
  help,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  /**
   * Sits at the label's right — a "Forgot password?" — outside the label
   * itself, so it is its own control and not part of the field's name.
   */
  trailing?: React.ReactNode;
  help?: string;
  error?: string;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? help;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="text-text/70 mb-[5px] flex justify-between gap-2 text-xs">
        <label htmlFor={id}>{label}</label>
        {trailing}
      </div>

      {children({
        id,
        "aria-describedby": message ? messageId : undefined,
        "aria-invalid": error ? true : undefined,
      })}

      {message && (
        <div
          id={messageId}
          className={cn(
            "mt-1.5 text-[11px]",
            error ? "text-loss" : "text-muted",
          )}
        >
          {message}
        </div>
      )}
    </div>
  );
}

const INPUT =
  "font-body text-text h-12 w-full min-w-0 rounded-md border-0 bg-raised px-3 text-sm outline-none";

export function TextInput({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<"input">) {
  return <input {...rest} className={cn(INPUT, className)} />;
}

/**
 * Ethiopian mobile number, with the country code fixed.
 *
 * `+251` is not editable because every account is an Ethiopian mobile: making it
 * a field invites a wrong answer and buys nothing.
 */
export function PhoneInput({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<"input">) {
  return (
    <div className="bg-raised flex h-12 rounded-md">
      <span className="border-divider flex items-center gap-1.5 border-r px-3 font-semibold">
        <span className="text-muted text-[9px] font-bold tracking-[0.06em]">
          ET
        </span>
        +251
      </span>
      <input
        inputMode="tel"
        autoComplete="tel-national"
        {...rest}
        className={cn(
          "font-body text-text min-w-0 flex-1 border-0 bg-transparent px-3 text-[15px] font-medium tracking-[0.04em] outline-none",
          className,
        )}
      />
    </div>
  );
}

export function PasswordInput({
  show,
  onToggleShow,
  showLabel,
  className,
  ...rest
}: React.ComponentPropsWithoutRef<"input"> & {
  show: boolean;
  onToggleShow: () => void;
  showLabel: string;
}) {
  return (
    <div className="bg-raised flex h-12 rounded-md">
      <input
        type={show ? "text" : "password"}
        {...rest}
        className={cn(
          "font-body text-text min-w-0 flex-1 border-0 bg-transparent px-3 text-sm outline-none",
          className,
        )}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="text-muted font-body cursor-pointer rounded-md bg-transparent px-3 text-[13px] font-bold"
      >
        {showLabel}
      </button>
    </div>
  );
}

/**
 * A consent checkbox with its own explanation.
 *
 * A real checkbox role rather than a styled input, because the label is a block
 * of text with links in it and the whole block should be the hit target.
 */
export function CheckboxRow({
  checked,
  onChange,
  children,
  note,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onChange(!checked);
        }
      }}
      className="font-body text-text flex min-h-11 cursor-pointer items-start gap-3 bg-transparent py-2.5 text-left text-[13px]"
    >
      <span
        aria-hidden
        className={cn(
          "text-ground mt-px grid size-[22px] shrink-0 place-items-center rounded-md border-[1.5px]",
          checked ? "border-accent bg-accent" : "border-muted bg-raised",
        )}
      >
        {checked && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      <span>
        <span className="font-semibold">{children}</span>
        {note && (
          <span className="text-muted block text-[11px] font-normal">
            {note}
          </span>
        )}
      </span>
    </div>
  );
}

/** Full-width primary action at the foot of a form. */
export function SubmitButton({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...rest}
      className={cn(
        "bg-accent text-on-accent font-body h-[52px] w-full cursor-pointer rounded-md text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
    />
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <div className="text-muted flex items-center gap-2.5 text-[11px]">
      <span className="bg-divider h-px flex-1" />
      {label}
      <span className="bg-divider h-px flex-1" />
    </div>
  );
}

/** Telegram is a first-class channel in this market, so it keeps its brand. */
export function TelegramButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      style={{ background: "#229ed9" }}
      className="font-body flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-bold text-white"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
        <path d="m21.854 2.147-10.94 10.939" />
      </svg>
      {label}
    </button>
  );
}
