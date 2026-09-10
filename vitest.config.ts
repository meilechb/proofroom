import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      // Reported for all of lib/ (plan 22.1); thresholds are enforced on the
      // pure business-logic modules that are meant to be fully unit-tested.
      provider: "v8",
      include: ["src/lib/**"],
      exclude: ["src/lib/**/*.d.ts"],
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        "src/lib/booking-shared.ts": { statements: 80, branches: 80, functions: 80, lines: 80 },
        "src/lib/imports/sources.ts": { statements: 80, branches: 80, functions: 80, lines: 80 },
        "src/lib/imports/csv.ts": { statements: 80, branches: 80, functions: 80, lines: 80 },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server libraries import "server-only", which throws outside Next's server runtime.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
