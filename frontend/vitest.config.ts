import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    exclude: ["node_modules/**", "e2e/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Apenas componentes, features, hooks e lib são medidos.
      // Páginas (src/app/) são testadas via integração, não unitariamente.
      include: [
        "src/components/**/*.{ts,tsx}",
        "src/features/**/*.{ts,tsx}",
        "src/hooks/**/*.{ts,tsx}",
        "src/lib/**/*.{ts,tsx}",
      ],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test/**",
        "src/**/*.d.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 60,
      },
    },
  },
});
