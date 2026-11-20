import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * The API tests run against their own database (created by docker/init-test-db.sql), because
 * every test wipes it. Point TEST_DATABASE_URL elsewhere for CI.
 */
const apiTestEnv = {
  NODE_ENV: "test" as const,
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://survey:survey@127.0.0.1:5434/survey_test",
  JWT_SECRET: "test-only-secret-not-used-anywhere-else",
};

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // `server-only` deliberately throws outside React Server Components.
      // Tests run server code in plain Node, so swap it for an empty module.
      "server-only": fromRoot("./test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    projects: [
      // Pure logic, no database: `pnpm test:unit` runs these alone.
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"] } },
      {
        extends: true,
        test: {
          name: "api",
          include: ["test/api/**/*.test.ts"],
          env: apiTestEnv,
          globalSetup: ["test/api/global-setup.ts"],
          setupFiles: ["test/api/setup.ts"],
          // The files share one database and wipe it before each test, so they run one at a time.
          fileParallelism: false,
          // Password hashing (scrypt) is slow on purpose, and most tests sign up an admin or two.
          testTimeout: 15_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      // Text summaries only: the HTML reporter writes .js assets into the repo that ESLint would scan.
      reporter: ["text", "json-summary"],
      // UI files are checked in the browser; their pure logic lives in plain modules that are unit tested.
      include: [
        "src/core/**",
        "src/server/**",
        "src/app/api/**",
        "src/features/builder/draft-ops.ts",
        "src/features/builder/changes.ts",
      ],
      // current-admin is for server components (cookies(), redirect()); the API uses session.ts.
      exclude: ["**/*.test.ts", "src/server/db/schema.ts", "src/server/auth/current-admin.ts"],
    },
  },
});
