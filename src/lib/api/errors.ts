/** A failure that reached us from the backend, or from trying to. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = "unknown",
    readonly details?: unknown,
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
