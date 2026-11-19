import type { ApiErrorBody } from "@/lib/api-contract";

/** An expected failure with a safe, user-facing message. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ApiErrorBody["details"],
    readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string) => new ApiError(400, "BAD_REQUEST", message);

export const unauthorized = (message = "Please sign in to continue") =>
  new ApiError(401, "UNAUTHORIZED", message);

export const forbidden = (message: string) => new ApiError(403, "FORBIDDEN", message);

export const notFound = (resource: string) => new ApiError(404, "NOT_FOUND", `${resource} not found`);

export const conflict = (message: string, code = "CONFLICT") => new ApiError(409, code, message);

export const validationFailed = (fields: Record<string, string>, message = "Please fix the highlighted fields") =>
  new ApiError(422, "VALIDATION_FAILED", message, { fields });

export const tooManyRequests = (retryAfterSeconds: number) =>
  new ApiError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.", undefined, {
    "Retry-After": String(retryAfterSeconds),
  });
