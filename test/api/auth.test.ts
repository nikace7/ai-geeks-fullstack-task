import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { GET as me } from "@/app/api/v1/auth/me/route";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { GET as listSurveys, POST as createSurvey } from "@/app/api/v1/surveys/route";
import type { AdminProfile } from "@/server/auth/service";
import { RATE_LIMITS } from "@/server/rate-limit";
import { call, dataOf, expectError, PASSWORD, sessionFrom, signUp } from "./client";

describe("auth API", () => {
  it("registers an admin with a normalised email and an httpOnly session cookie", async () => {
    const res = await call<AdminProfile>(register, "POST", { body: { email: "  Admin@Example.com ", password: PASSWORD } });

    expect(res.status).toBe(201);
    expect(dataOf(res).email).toBe("admin@example.com");
    expect(res.headers.get("set-cookie")).toMatch(/; HttpOnly; SameSite=Lax; Max-Age=604800/);
    expect(dataOf(await call<AdminProfile>(me, "GET", { session: sessionFrom(res) })).email).toBe("admin@example.com");
  });

  it("refuses a second account with the same email", async () => {
    await signUp("admin@example.com");
    const res = await call(register, "POST", { body: { email: "ADMIN@example.com", password: PASSWORD } });
    expectError(res, 409, "EMAIL_TAKEN");
  });

  it("returns a message per invalid field", async () => {
    const res = await call(register, "POST", { body: { email: "not-an-email", password: "short" } });
    const fields = expectError(res, 422, "VALIDATION_FAILED");
    expect(Object.keys(fields).sort()).toEqual(["email", "password"]);
  });

  it("signs in with the right password only, and gives the same answer for unknown emails", async () => {
    await signUp("admin@example.com");

    const ok = await call(login, "POST", { body: { email: "admin@example.com", password: PASSWORD } });
    expect(ok.status).toBe(200);
    expect(sessionFrom(ok)).toBeTruthy();

    const wrongPassword = await call(login, "POST", { body: { email: "admin@example.com", password: "wrong-password" } });
    const unknownEmail = await call(login, "POST", { body: { email: "nobody@example.com", password: PASSWORD } });
    expectError(wrongPassword, 401, "UNAUTHORIZED");
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it("signs out by expiring the cookie", async () => {
    const res = await call(logout, "POST");
    expect(res.headers.get("set-cookie")).toMatch(/^session=; .*Max-Age=0/);
  });

  it("rejects admin endpoints without a valid session", async () => {
    const session = await signUp();
    expectError(await call(listSurveys, "GET"), 401, "UNAUTHORIZED");
    expectError(await call(listSurveys, "GET", { session: `${session.slice(0, -2)}xx` }), 401, "UNAUTHORIZED");
    expectError(await call(listSurveys, "GET", { session: "not-a-jwt" }), 401, "UNAUTHORIZED");
  });

  it("rate-limits sign-in attempts per client, with Retry-After", async () => {
    // Every attempt counts before the body is even read, so malformed ones are enough here
    // (and they skip the deliberately slow password hash).
    const attempt = (ip: string) => call(login, "POST", { body: {}, headers: { "x-forwarded-for": ip } });

    for (let i = 0; i < RATE_LIMITS.login.limit; i++) expectError(await attempt("203.0.113.1"), 422, "VALIDATION_FAILED");

    const blocked = await attempt("203.0.113.1");
    expectError(blocked, 429, "RATE_LIMITED");
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another client has its own budget.
    expectError(await attempt("203.0.113.2"), 422, "VALIDATION_FAILED");
  });

  it("blocks writes from another site, and allows them from this one", async () => {
    const session = await signUp();
    const fromOrigin = (origin: string) =>
      call(createSurvey, "POST", { session, body: {}, headers: { origin, "x-forwarded-host": "localhost:3000" } });

    expectError(await fromOrigin("https://evil.example"), 403, "FORBIDDEN");
    expect((await fromOrigin("http://localhost:3000")).status).toBe(201);
  });
});
