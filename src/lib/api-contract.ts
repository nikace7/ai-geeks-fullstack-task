import type { z } from "zod";

/**
 * The response envelope every API endpoint returns. Shared by the server (which builds it)
 * and the browser (which reads it), so both agree on the shape at compile time.
 */
export interface ApiErrorBody {
  code: string;
  message: string;
  /** For validation errors: messages keyed by field path, e.g. "questions.2.title". */
  details?: { fields?: Record<string, string> };
}

export type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiErrorBody };

/** Flattens Zod issues to one message per field path, the format forms use to highlight fields. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    fields[path] ??= issue.message;
  }
  return fields;
}
