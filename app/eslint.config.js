import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import betterTailwind from "eslint-plugin-better-tailwindcss";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/data/**",
      "**/*.bak",
      "**/*.tsbuildinfo",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser },
    },
    plugins: {
      "better-tailwindcss": betterTailwind,
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/styles/globals.css",
      },
    },
    rules: {
      ...betterTailwind.configs.recommended.rules,
      // Custom component classes from notebook.css (.btn-sk, .chip, .eyebrow,
      // .mono, .serif, .canvas, .frame, etc.) are not Tailwind utilities, so
      // the unknown-class rule produces hundreds of false positives.
      "better-tailwindcss/no-unknown-classes": "off",
      // Line wrapping is purely cosmetic and extremely noisy in real code.
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
      // Keep noise down: only tailwind findings matter for this audit.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": "off",
      "no-constant-condition": "off",
      "prefer-const": "off",
      "no-useless-escape": "off",
      "no-useless-assignment": "off",
    },
  },
];
