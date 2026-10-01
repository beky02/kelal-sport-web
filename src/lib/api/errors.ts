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
