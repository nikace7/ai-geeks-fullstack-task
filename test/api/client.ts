import { expect } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as startResponse } from "@/app/api/v1/public/surveys/[surveyId]/responses/route";
import { POST as publish } from "@/app/api/v1/surveys/[surveyId]/publish/route";
import { POST as createSurvey } from "@/app/api/v1/surveys/route";
import type { SurveyDefinition } from "@/core/survey-schema";
import type { ApiResult } from "@/lib/api-contract";
import type { SavedResponse } from "@/server/responses/service";
import type { PublishedVersion, SurveyDetail } from "@/server/surveys/service";
import { cloneSurvey } from "../fixtures/survey";

// `never` params accept every route's handler. A wrong param name still fails the test, as a 404.
type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;

interface CallOptions {
  params?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
  /** Admin session token, sent as the session cookie. */
  session?: string;
  /** Resume token, sent as "Authorization: Bearer". */
  token?: string;
  headers?: Record<string, string>;
}

export interface ApiCall<T> {
  status: number;
  headers: Headers;
  body: ApiResult<T>;
}

/**
 * Calls a route handler with a real Request. No HTTP server, but everything behind it is real:
 * the handler wrapper, validation, services and Postgres.
 */
export async function call<T = unknown>(
  handler: Handler,
  method: string,
  { params = {}, body, query = {}, session, token, headers }: CallOptions = {},
): Promise<ApiCall<T>> {
  const url = new URL("http://localhost/api");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const requestHeaders = new Headers(headers);
  if (session) requestHeaders.set("cookie", `session=${session}`);
  if (token) requestHeaders.set("authorization", `Bearer ${token}`);
  if (body !== undefined) requestHeaders.set("content-type", "application/json");

  const req = new Request(url, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await handler(req, { params: Promise.resolve(params as never) });
  return { status: res.status, headers: res.headers, body: (await res.json()) as ApiResult<T> };
}

/** The payload of a successful call. Fails the test with the server's error otherwise. */
export function dataOf<T>(res: ApiCall<T>): T {
  if (!res.body.success) throw new Error(`Expected success, got ${res.status}: ${JSON.stringify(res.body.error)}`);
  return res.body.data;
}

/** Asserts an error response by status and machine-readable code, and returns its field errors. */
export function expectError(res: ApiCall<unknown>, status: number, code: string): Record<string, string> {
  const error = res.body.success ? null : res.body.error;
  expect({ status: res.status, code: error?.code }).toEqual({ status, code });
  return error?.details?.fields ?? {};
}

export const PASSWORD = "test-password-123";

export function sessionFrom(res: ApiCall<unknown>): string {
  const session = res.headers.get("set-cookie")?.match(/^session=([^;]+)/)?.[1];
  if (!session) throw new Error("No session cookie was set");
  return session;
}

/** Registers an admin and returns their session token. */
export async function signUp(email = "admin@example.com"): Promise<string> {
  const res = await call(register, "POST", { body: { email, password: PASSWORD } });
  dataOf(res);
  return sessionFrom(res);
}

/** Creates a survey and publishes it as version 1. */
export async function publishedSurvey(session: string, draft: SurveyDefinition = cloneSurvey()) {
  const { id: surveyId } = dataOf(await call<SurveyDetail>(createSurvey, "POST", { session, body: { draft } }));
  const { versionId } = dataOf(await call<PublishedVersion>(publish, "POST", { session, params: { surveyId } }));
  return { surveyId, versionId };
}

interface RespondBody {
  versionId: string;
  answers: Record<string, unknown>;
  mode: "partial" | "complete";
  website?: string;
}

/** Starts a response as an anonymous respondent ("partial" returns a resume token). */
export function respond(surveyId: string, body: RespondBody) {
  return call<SavedResponse>(startResponse, "POST", { params: { surveyId }, body });
}
