import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "test-results/**", "playwright-report/**", ".tmp/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["log", "error", "warn"] }],
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      // node:test tracks the promise returned by test() itself.
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
)
