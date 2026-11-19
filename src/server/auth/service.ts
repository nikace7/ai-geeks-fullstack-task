import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { admins } from "@/server/db/schema";
import { conflict, unauthorized } from "@/server/http/errors";
import { hashPassword, verifyPassword } from "./password";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254)),
  // An upper bound stops someone making the server hash megabyte-long "passwords".
  password: z.string().min(8, "Use at least 8 characters").max(128, "Use at most 128 characters"),
});
export type Credentials = z.infer<typeof credentialsSchema>;

export interface AdminProfile {
  id: string;
  email: string;
}

export async function registerAdmin({ email, password }: Credentials): Promise<AdminProfile> {
  const passwordHash = await hashPassword(password);
  // The unique constraint decides, so two simultaneous sign-ups with one email can't both succeed.
  const [admin] = await db
    .insert(admins)
    .values({ email, passwordHash })
    .onConflictDoNothing({ target: admins.email })
    .returning({ id: admins.id, email: admins.email });
  if (!admin) throw conflict("An account with this email already exists", "EMAIL_TAKEN");
  return admin;
}

let dummyHash: Promise<string> | undefined;

export async function authenticateAdmin({ email, password }: Credentials): Promise<AdminProfile> {
  const [admin] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  // For unknown emails, still spend the time to verify a password against a throwaway hash.
  // Otherwise "no such account" responds faster, and timing would reveal which emails exist.
  dummyHash ??= hashPassword("timing-equaliser-password");
  const isValid = await verifyPassword(password, admin?.passwordHash ?? (await dummyHash));
  if (!admin || !isValid) throw unauthorized("Incorrect email or password");
  return { id: admin.id, email: admin.email };
}

export async function getAdminProfile(adminId: string): Promise<AdminProfile | null> {
  const [admin] = await db
    .select({ id: admins.id, email: admins.email })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1);
  return admin ?? null;
}
