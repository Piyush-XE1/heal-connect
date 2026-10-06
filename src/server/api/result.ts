import { z } from "zod";

import { formatZodError } from "@/lib/validation";

import { AppError, type AppError as AppErrorType } from "../errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fields?: Record<string, string>; code: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  message: string,
  options: { fields?: Record<string, string>; code?: string } = {},
): ActionResult<T> {
  const result: ActionResult<T> = {
    ok: false,
    message,
    code: options.code ?? "error",
  };
  if (options.fields) result.fields = options.fields;
  return result;
}

/**
 * Wraps a mutating server function: validation problems come back as field
 * errors, authorisation problems as readable messages, anything unexpected is
 * logged and hidden behind a generic message.
 */
export async function action<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("Please correct the highlighted fields.", {
        fields: formatZodError(error),
        code: "validation",
      });
    }
    const appError = error as AppErrorType;
    if (appError instanceof AppError) {
      return fail(appError.message, {
        code: appError.code,
        ...(appError.fields ? { fields: appError.fields } : {}),
      });
    }
    console.error("[heal-connect] unexpected server error", error);
    return fail("Something went wrong on our side. Please try again.", { code: "server_error" });
  }
}

/** Throws on failure — useful for reads where the caller handles errors. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (result.ok) return result.data;
  throw new AppError(result.message, { code: result.code, status: 400 });
}
