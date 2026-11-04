import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    ignores: [
      "client/dist/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "playwright.config.ts",
      "vitest.config.mts",
      "e2e/**",
      "client/vite.config.js",
      "eslint.config.mjs",
    ],
  },
);
