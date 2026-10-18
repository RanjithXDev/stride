import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["lib/**/*.ts", "store/**/*.ts", "hooks/**/*.ts", "components/ui/**/*.tsx", "components/navigation/CommandPalette.tsx"],
      exclude: ["**/*.d.ts", "**/*.test.{ts,tsx}"],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 90 },
    },
  },
});
