export class IntentLoopError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "IntentLoopError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function asIntentLoopError(error: unknown): IntentLoopError {
  if (error instanceof IntentLoopError) {
    return error;
  }
  const message = error instanceof Error ? error.message : "Unknown Intent Loop error";
  return new IntentLoopError("INTERNAL_ERROR", message, false);
}
