/**
 * One entry of a `Problem`'s `errors[]`: which field, and — for a rejection
 * the UI can fix — the value now in force and the limit it broke.
 */
export interface ProblemFieldError {
  /** JSON path, e.g. `legs[1].odds`. */
  field?: string;
  code: string;
  message?: string;
  /** The current value, e.g. the new odds. */
  current?: string;
  limit?: string;
}

/**
 * A failure that reached us from the backend, or from trying to.
 *
 * `code` is the contract's `ErrorCode` (`BET_ODDS_CHANGED`…) — switch on it,
 * never on the message, which is translated display text. `errors` carries the
 * fix: the UI offers the corrected value rather than reporting and stopping.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = "unknown",
    readonly details?: unknown,
    readonly errors: ProblemFieldError[] = [],
    /** Seconds to wait before trying again (`Retry-After`), when the answer said. */
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** 5xx and network failures are worth retrying; 4xx are not. */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

/** The response did not match the schema the frontend expects. */
export class ContractError extends Error {
  constructor(
    readonly endpoint: string,
    readonly issues: string,
  ) {
    super(
      `Response from ${endpoint} did not match the expected shape:\n${issues}`,
    );
    this.name = "ContractError";
  }
}

/**
 * The `ApiError` for a failed answer from one of this app's route handlers:
 * the RFC 7807 Problem they pass through from the API — its `code`, its
 * `errors[]` — and the `Retry-After` a 429 carries. `fallback` names the
 * request when there is no Problem to read.
 */
export async function problemError(
  response: Response,
  fallback: string,
): Promise<ApiError> {
  const problem = (await response.json().catch(() => null)) as {
    title?: string;
    code?: string;
    errors?: ProblemFieldError[];
  } | null;
  const retryAfter = response.headers.get("retry-after")?.trim() ?? "";
  return new ApiError(
    problem?.title ?? `${fallback} failed with ${response.status}`,
    response.status,
    problem?.code ?? "http_error",
    problem,
    problem?.errors ?? [],
    /^\d{1,6}$/.test(retryAfter) ? Number(retryAfter) : null,
  );
}
