import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      // The env.ts module eagerly validates process.env on import (by
      // design — it fails fast in real usage). Provide a dummy-but-valid
      // environment here so importing it in tests doesn't throw; env.ts's
      // own validation logic is tested directly via loadEnv() instead.
      DATABASE_URL: "postgresql://test:test@localhost:5433/test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});
