import type { ApiResult } from "./api-contract";

const NETWORK_ERROR = {
  code: "NETWORK_ERROR",
  message: "Can't reach the server. Check your connection and try again.",
} as const;

const BAD_RESPONSE = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong on our side. Please try again.",
} as const;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** For fire-and-forget saves that must survive the page closing. */
  keepalive?: boolean;
}

/**
 * Browser-side call to /api/v1. Never throws: every outcome, including a dropped connection or a
 * non-JSON error page from the host, comes back as the same ApiResult the server sends, so UI code
 * handles one shape.
 */
export async function api<T>(path: string, { method, body, headers, keepalive }: RequestOptions = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
    });
  } catch {
    return { success: false, error: NETWORK_ERROR };
  }
  try {
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { success: false, error: BAD_RESPONSE };
  }
}
