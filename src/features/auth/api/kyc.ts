import { apiClient } from "@/lib/api/client";
import { faydaChallengeSchema, kycResultSchema } from "@/lib/api/schemas";
import type {
  FaydaChallengeView,
  FaydaStartForm,
  FaydaVerifyForm,
  KycResultView,
} from "../types";

/** Asks Fayda to text a code to the phone registered with the ID (C02 §8). */
export const startFayda = (form: FaydaStartForm): Promise<FaydaChallengeView> =>
  apiClient.post("/kyc/fayda/otp", faydaChallengeSchema, form);

/** Fayda's code back; the answer is the verdict. */
export const verifyFayda = (form: FaydaVerifyForm): Promise<KycResultView> =>
  apiClient.post("/kyc/fayda/verify", kycResultSchema, form);
