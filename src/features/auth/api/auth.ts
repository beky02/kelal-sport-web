import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import { loginResultSchema, sessionViewSchema } from "@/lib/api/schemas";
import type { LoginForm, LoginResult, SessionView } from "../types";

/** Who is signed in — the API's answer, through `/api/me`, never a browser flag. */
export const getMe = (signal?: AbortSignal): Promise<SessionView> =>
  apiClient.get("/me", sessionViewSchema, { signal });

/** Logs in; the session arrives as an httpOnly cookie, not in this answer. */
export const login = (form: LoginForm): Promise<LoginResult> =>
  apiClient.post("/auth/login", loginResultSchema, form);

/** Ends the session; the route handler clears the cookie whatever the API said. */
export const logout = (): Promise<undefined> =>
  apiClient.post("/auth/logout", z.undefined(), {});
