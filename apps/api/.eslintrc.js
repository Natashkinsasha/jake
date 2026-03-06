module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "drizzle", "import-x", "unicorn"],
  extends: [
    "plugin:@typescript-eslint/strict-type-checked",
  ],
  root: true,
  env: {
    node: true,
  },
  ignorePatterns: [".eslintrc.js", "dist/", "test/"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-extraneous-class": "off",
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports", fixStyle: "inline-type-imports" },
    ],
    "@typescript-eslint/consistent-type-exports": [
      "error",
      { fixMixedExportsWithInlineTypeSpecifier: true },
    ],
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "@typescript-eslint/require-await": "error",
    "@typescript-eslint/strict-boolean-expressions": [
      "warn",
      {
        allowString: true,
        allowNullableObject: true,
        allowNullableBoolean: true,
        allowNullableString: true,
      },
    ],
    "@typescript-eslint/restrict-template-expressions": [
      "error",
      { allowNumber: true },
    ],
    // drizzle
    "drizzle/enforce-delete-with-where": ["error", { drizzleObjectName: ["db", "tx"] }],
    "drizzle/enforce-update-with-where": ["error", { drizzleObjectName: ["db", "tx"] }],
    // import-x
    "import-x/no-duplicates": "error",
    "import-x/order": ["error", { "newlines-between": "ignore" }],
    // unicorn
    "unicorn/prefer-array-find": "error",
    "unicorn/prefer-array-some": "error",
    "unicorn/prefer-string-replace-all": "error",
    "unicorn/no-useless-spread": "error",
    "unicorn/no-useless-undefined": "error",
    "unicorn/prefer-number-properties": "error",
    "unicorn/no-for-loop": "error",
    "unicorn/prefer-includes": "error",
    // memory leak prevention
    "no-loop-func": "error",
  },
  overrides: [
    {
      files: ["**/*.spec.ts", "**/*.test.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/unbound-method": "off",
      },
    },
  ],
};
