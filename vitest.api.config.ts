import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/api/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    hookTimeout: 300_000,
    testTimeout: 300_000
  }
});
