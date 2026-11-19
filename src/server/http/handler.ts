import "server-only";
import { z } from "zod";
import { toFieldErrors, type ApiResult } from "@/lib/api-contract";
import { ApiError, badRequest, forbidden, notFound, validationFailed } from "./errors";

/** 200/201 response in the standard envelope. */
export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ success: true, data } satisfies ApiResult<T>, init);
}

function errorResponse(error: ApiError): Response {
  const body: ApiResult<never> = {
    success: false,
    error: { code: error.code, message: error.message, ...(error.details && { details: error.details }) },
  };
  return Response.json(body, { status: error.status, headers: error.headers });
}

/**
 * Wraps a route handler with the cross-cutting concerns every endpoint needs, so each
 * route file only contains its own logic: CSRF origin check, error-to-HTTP mapping,
 * and logging of unexpected failures without leaking internals to the client.
 */
export function handle<Ctx>(handler: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error);
      console.error(`[api] ${req.method} ${new URL(req.url).pathname} failed:`, error);
      return errorResponse(new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));
    }
  };
}

/** Parses and validates a JSON body. Invalid input becomes a 422 with per-field messages. */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationFailed(toFieldErrors(parsed.error));
  return parsed.data;
}

/** Validates URL query parameters the same way readJson validates bodies. */
export function readQuery<S extends z.ZodType>(req: Request, schema: S): z.output<S> {
  const parsed = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw validationFailed(toFieldErrors(parsed.error));
  return parsed.data;
}

/** The token from an "Authorization: Bearer <token>" header. */
export function readBearerToken(req: Request): string | undefined {
  const [scheme, token] = req.headers.get("authorization")?.split(" ") ?? [];
  return scheme?.toLowerCase() === "bearer" && token ? token : undefined;
}

const uuidSchema = z.uuid();

/** A malformed id is just an id that doesn't exist: 404, not a Postgres "invalid uuid" 500. */
export function parseId(value: string, resource: string): string {
  if (!uuidSchema.safeParse(value).success) throw notFound(resource);
  return value;
}

/**
 * Defence in depth against CSRF, on top of the SameSite=Lax session cookie: browsers always
 * send an Origin header on cross-site writes, so reject writes whose Origin isn't this site.
 * Non-browser clients (curl, mobile apps, tests) send no Origin and are unaffected.
 */
function assertSameOrigin(req: Request): void {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (URL.canParse(origin) && new URL(origin).host === host) return;
  throw forbidden("Cross-site requests are not allowed");
}
