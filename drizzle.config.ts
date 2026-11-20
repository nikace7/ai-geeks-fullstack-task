import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so it doesn't get Next's automatic .env loading.
// Node's built-in loader is enough; no dotenv dependency needed.
if (existsSync(".env")) process.loadEnvFile(".env");

// Migrations prefer a direct connection: Neon (via Vercel) also sets DATABASE_URL_UNPOOLED, and
// schema changes shouldn't go through its connection pooler. Locally only DATABASE_URL exists.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
});
