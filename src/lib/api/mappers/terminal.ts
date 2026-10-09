import type {
  ActivationForm,
  SlipCodeReceipt,
  SlipCodeRequest,
  TerminalActivation,
  TerminalInfo,
} from "@/features/terminal/types";
import type { components, operations } from "@/lib/api/schema";

type ActivateRequest = components["schemas"]["TerminalActivateRequest"];
type Activation = components["schemas"]["TerminalActivation"];
type SlipCodeCreate = components["schemas"]["SlipCodeCreate"];
type SlipCodeCreated = components["schemas"]["SlipCodeCreated"];
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

/**
 * The slip as `POST /v1/retail/slip-codes` takes it (F8cc). Made in the
 * browser, which signs the exact text it sends (D3; F8b decision 2), so the
 * keys come in the contract's order and what is empty is left out.
 */
export const toSlipCodeCreate = (request: SlipCodeRequest): SlipCodeCreate => ({
  bet_type: request.betType,
  ...(request.systemSizes.length > 0
    ? { system_sizes: request.systemSizes }
    : {}),
  legs: request.legs.map((leg) => ({
    outcome_id: leg.outcomeId,
    ...(leg.odds !== null ? { odds: leg.odds } : {}),
  })),
  ...(request.stakeHint !== null ? { stake_hint: request.stakeHint } : {}),
});

/** `4829 1735`: eight digits in two groups of four (C19 §4.2). */
const grouped = (code: string) => `${code.slice(0, 4)} ${code.slice(4)}`;

/**
 * The code the API made. `display` is shown as sent when its digits are the
 * code's, so it can never show a number other than the one the counter
 * types; anything else is the code grouped here.
 */
export const toSlipCodeReceipt = (
  created: SlipCodeCreated,
): SlipCodeReceipt => ({
  code: created.code,
  display:
    created.display.replace(/\s/g, "") === created.code &&
    /^[\d ]+$/.test(created.display)
      ? created.display
      : grouped(created.code),
  expiresAt: created.expires_at,
  qr: created.qr,
});
