import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "@data": fileURLToPath(new URL("./data", import.meta.url)),
  // `server-only` throws outside Next's server bundle; tests run in plain Node.
  "server-only": fileURLToPath(new URL("./vitest.server-only.ts", import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.int.test.ts"],
        },
      },
      {
        // Needs a running local Supabase stack (`npx supabase start`); see npm run test:rls.
        extends: true,
        test: {
          name: "rls",
          environment: "node",
          include: ["tests/rls/**/*.int.test.ts"],
          globalSetup: ["./tests/rls/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
