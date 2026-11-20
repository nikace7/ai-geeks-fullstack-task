import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { TestProject } from "vitest/node";

/** Runs once before the API tests: brings the test database up to the latest migration. */
export default async function setup(project: TestProject) {
  const url = project.config.env.DATABASE_URL;
  const db = drizzle(url ?? "");
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
  } catch (error) {
    throw new Error(`API tests need Postgres at ${url}. Start it with "pnpm db:up", or set TEST_DATABASE_URL.`, {
      cause: error,
    });
  } finally {
    await db.$client.end();
  }
}
