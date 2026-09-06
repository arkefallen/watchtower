import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    passWithNoTests: true,
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://watchtower:watchtower@localhost:5432/watchtower",
      REDIS_URL: "redis://localhost:6379",
      ETHERSCAN_API_KEY: "test_etherscan_key_placeholder",
    },
  },
});
