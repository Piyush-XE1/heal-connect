import type { ActionResult } from "@/server/api/result";

export class ActionError extends Error {
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(message: string, code = "error", fields: Record<string, string> = {}) {
    super(message);
    this.name = "ActionError";
    this.code = code;
    this.fields = fields;
  }
}

export function isActionError(error: unknown): error is ActionError {
  return error instanceof ActionError;
}

function isActionResult<T>(value: ActionResult<T> | T): value is ActionResult<T> {
  return typeof value === "object" && value !== null && "ok" in value;
}

/** Turns an `ActionResult` into data or a thrown, field-aware error. */
export function unwrapAction<T>(result: ActionResult<T>): T;
/** Server functions that return a plain payload are passed straight through. */
export function unwrapAction<T>(result: T): T;
export function unwrapAction<T>(result: ActionResult<T> | T): T {
  if (isActionResult(result)) {
    if (result.ok) return result.data;
    throw new ActionError(result.message, result.code, result.fields ?? {});
  }
  return result;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isActionError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (isActionError(error)) return error.fields;
  return {};
}

export function fieldError(error: unknown, field: string): string | undefined {
  return fieldErrors(error)[field];
}
