import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

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
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Text summaries only: the HTML reporter writes .js assets into the repo that ESLint would scan.
      reporter: ["text", "json-summary"],
      // UI files are checked in the browser; their pure logic lives in plain modules that are unit tested.
      include: ["src/core/**", "src/server/**", "src/features/builder/draft-ops.ts", "src/features/builder/changes.ts"],
      exclude: ["**/*.test.ts", "src/server/db/schema.ts"],
    },
  },
});
