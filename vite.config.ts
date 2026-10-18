import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/shiba-mecha/",
  server: {
    host: "127.0.0.1",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
