import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import {
  loginResultSchema,
  otpChallengeSchema,
  registerResultSchema,
  sessionViewSchema,
} from "@/lib/api/schemas";
import type {
  LoginForm,
  LoginResult,
  OtpChallengeView,
  OtpRequestForm,
  PasswordResetForm,
  RegisterForm,
  RegisterResult,
  SessionView,
} from "../types";

/** Who is signed in — the API's answer, through `/api/me`, never a browser flag. */
export const getMe = (signal?: AbortSignal): Promise<SessionView> =>
  apiClient.get("/me", sessionViewSchema, { signal });

/** Logs in; the session arrives as an httpOnly cookie, not in this answer. */
export const login = (form: LoginForm): Promise<LoginResult> =>
  apiClient.post("/auth/login", loginResultSchema, form);

/** Ends the session; the route handler clears the cookie whatever the API said. */
export const logout = (): Promise<undefined> =>
  apiClient.post("/auth/logout", z.undefined(), {});

/** Sends an SMS code to register or to reset a password. */
export const sendOtp = (form: OtpRequestForm): Promise<OtpChallengeView> =>
  apiClient.post("/auth/otp", otpChallengeSchema, form);

/** Creates the account; like login, the session arrives as the cookie. */
export const register = (form: RegisterForm): Promise<RegisterResult> =>
  apiClient.post("/auth/register", registerResultSchema, form);

/** Sets a new password with the reset code. Signs nobody in. */
export const resetPassword = (form: PasswordResetForm): Promise<undefined> =>
  apiClient.post("/auth/password/reset", z.undefined(), form);
