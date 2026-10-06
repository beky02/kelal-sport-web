import {
  terminalActivationSchema,
  terminalStatusSchema,
  tokenRotationSchema,
} from "@/lib/api/schemas";
import { TERMINAL_CALLS } from "../lib/calls";
import {
  createDeviceKey,
  deviceKeyStore,
  publicKeyBase64,
} from "../lib/device-key";
import type {
  TerminalActivation,
  TerminalStatus,
  TokenRotation,
} from "../types";
import { terminalRequest } from "./client";

/**
 * What this terminal is. Without a device key in this browser it cannot sign,
 * so it is not activated here — whatever cookie it may hold — and nothing is
 * asked.
 */
export async function getTerminalStatus(): Promise<TerminalStatus> {
  const pair = await deviceKeyStore.load();
  if (!pair) return { state: "inactive", reason: "new" };
  return terminalRequest(TERMINAL_CALLS.status, terminalStatusSchema, {
    key: pair.privateKey,
  });
}

/**
 * Activates this PC with its one-time code (already normalised). A fresh
 * device key is made and kept first, then its public half goes with the code:
 * a key the browser could not keep would bind the terminal to a key it no
 * longer has. Whatever key was here before belonged to a terminal that is no
 * longer active on this PC.
 */
export async function activateTerminal(
  activationCode: string,
): Promise<TerminalActivation> {
  const pair = await createDeviceKey();
  await deviceKeyStore.save(pair);
  return terminalRequest(TERMINAL_CALLS.activate, terminalActivationSchema, {
    body: {
      activationCode,
      devicePublicKey: await publicKeyBase64(pair),
    },
  });
}

/** Replaces the terminal token, signed over no body. */
export async function rotateTerminalToken(): Promise<TokenRotation> {
  const pair = await deviceKeyStore.load();
  return terminalRequest(TERMINAL_CALLS.token, tokenRotationSchema, {
    key: pair?.privateKey,
  });
}
