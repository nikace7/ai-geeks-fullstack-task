import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAdminProfile, type AdminProfile } from "./service";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/**
 * The signed-in admin for server components, or null. Wrapped in cache() so the header and the
 * page can both ask during one render and the token is verified and looked up only once.
 */
export const getCurrentAdmin = cache(async (): Promise<AdminProfile | null> => {
  const adminId = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return adminId ? getAdminProfile(adminId) : null;
});

/**
 * Pages that need an admin call this first. The API checks the session on every request anyway;
 * this only decides what to render, so a signed-out visitor goes to the login page.
 */
export async function requireAdmin(): Promise<AdminProfile> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}
