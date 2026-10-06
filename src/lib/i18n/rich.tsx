"use client";

import { Fragment, type ReactNode } from "react";
import { translate, type Interpolations, type MessageKey } from ".";
import { useLocale } from "./locale";

/**
 * A message with React nodes substituted into its placeholders.
 *
 * The alternative — splitting a sentence into "I accept the", "and", "." and
 * gluing links between them — assumes English word order. Amharic puts the verb
 * last, so the leading fragment is empty and the sentence only reads correctly
 * by accident. Keeping the sentence whole and marking the slots lets each
 * language put them where they belong.
 *
 *   rich("auth.termsConsent", { terms: <Link…/>, privacy: <Link…/> })
 */
export function useRichTranslation() {
  const { lang } = useLocale();

  return (
    key: MessageKey,
    nodes: Record<string, ReactNode>,
    values?: Interpolations,
  ): ReactNode[] => {
    const template = translate(lang, key, values);

    // Split on the placeholders, keeping them, then swap each for its node.
    return template
      .split(/(\{\w+\})/g)
      .filter((part) => part !== "")
      .map((part, index) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        const node = name === undefined ? part : (nodes[name] ?? part);
        return <Fragment key={`${index}-${part}`}>{node}</Fragment>;
      });
  };
}
