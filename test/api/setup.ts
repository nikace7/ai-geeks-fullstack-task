import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { db } from "@/server/db/client";

// Every test starts from an empty database, rate-limit counters included.
// Test files run one at a time (fileParallelism: false), so a wipe never hits another file's data.
beforeEach(async () => {
  await db.execute(sql`truncate table admins, surveys, survey_versions, responses, rate_limits cascade`);
});

afterAll(async () => {
  await db.$client.end();
});
