import type {
  ActivationForm,
  TerminalActivation,
  TerminalInfo,
} from "@/features/terminal/types";
import type { components, operations } from "@/lib/api/schema";

type ActivateRequest = components["schemas"]["TerminalActivateRequest"];
type Activation = components["schemas"]["TerminalActivation"];
type TerminalSelf =
  operations["getTerminalSelf"]["responses"][200]["content"]["application/json"];

/**
 * The shop terminal (C19 §4.1, §9.1). Pure: contract shape in, domain type
 * out. What the API left out stays `null` — never guessed. The token is not
 * mapped: it goes from the API into the sealed cookie and nowhere else.
 */

/** The activation screen's form as the contract's request, with this build's version. */
export const toActivateRequest = (
  form: ActivationForm,
  appVersion: string,
): ActivateRequest => ({
  activation_code: form.activationCode,
  device_public_key: form.devicePublicKey,
  app_version: appVersion,
});

/** Which shop the PC now belongs to — everything of the answer but the token. */
export const toTerminalActivation = (
  activation: Activation,
): TerminalActivation => ({
  id: activation.terminal_id,
  label: activation.label ?? null,
  shop: { code: activation.shop.code, name: activation.shop.name },
});

/** The terminal and its shop now (`GET /v1/retail/terminal`). */
export const toTerminalInfo = (self: TerminalSelf): TerminalInfo => ({
  id: self.terminal_id,
  label: self.label ?? null,
  shop: {
    code: self.shop.code,
    name: self.shop.name,
    openNow: self.shop.open_now,
  },
  idleResetSeconds: self.idle_reset_seconds ?? null,
  codeDisplaySeconds: self.code_display_seconds ?? null,
});
