export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(
    message: string,
    options: { status?: number; code?: string; fields?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.status = options.status ?? 400;
    this.code = options.code ?? "bad_request";
    if (options.fields) this.fields = options.fields;
  }
}

export function unauthorized(message = "Please sign in to continue."): AppError {
  return new AppError(message, { status: 401, code: "unauthorized" });
}

export function forbidden(message = "You do not have access to this action."): AppError {
  return new AppError(message, { status: 403, code: "forbidden" });
}

export function notFound(message = "We could not find that record."): AppError {
  return new AppError(message, { status: 404, code: "not_found" });
}

export function invalid(message: string, fields?: Record<string, string>): AppError {
  return new AppError(message, { status: 422, code: "invalid", ...(fields ? { fields } : {}) });
}

export function rateLimited(
  message = "Too many attempts. Please try again in a moment.",
): AppError {
  return new AppError(message, { status: 429, code: "rate_limited" });
}
