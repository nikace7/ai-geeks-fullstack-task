import "server-only";
import { z } from "zod";

// Validate configuration once at startup so a missing secret fails loudly
// instead of surfacing later as a confusing runtime error.
const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
