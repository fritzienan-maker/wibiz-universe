import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve("./shared"),
    },
  },
});
