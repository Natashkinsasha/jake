module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "@stylistic", "drizzle", "import-x", "unicorn", "security", "sonarjs", "no-secrets", "promise", "regexp"],
  extends: [
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:security/recommended-legacy",
    "plugin:sonarjs/recommended-legacy",
    "plugin:promise/recommended",
    "plugin:regexp/recommended",
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
    // security — disable false-positive rules
    "security/detect-object-injection": "off", // too many false positives with TypeScript
    "security/detect-non-literal-fs-filename": "off", // we don't use fs directly
    // sonarjs — tune noisy rules
    "sonarjs/deprecation": "warn", // drizzle's pgTable signature triggers this
    "sonarjs/no-nested-template-literals": "warn", // prompt templates use nested literals
    "sonarjs/cognitive-complexity": ["warn", 25], // allow higher complexity threshold
    "sonarjs/no-nested-functions": "off", // common in NestJS callbacks
    "sonarjs/use-type-alias": "off", // opinionated style rule
    // no-secrets
    "no-secrets/no-secrets": ["error", { "tolerance": 4.5 }],
    // stylistic
    "@stylistic/semi": ["error", "always"],
    "@stylistic/quotes": ["error", "double", { "avoidEscape": true }],
    "@stylistic/indent": ["error", 2, { "SwitchCase": 1 }],
    "@stylistic/comma-dangle": ["error", "always-multiline"],
    "@stylistic/object-curly-spacing": ["error", "always"],
    "@stylistic/array-bracket-spacing": ["error", "never"],
    "@stylistic/arrow-spacing": "error",
    "@stylistic/block-spacing": "error",
    "@stylistic/comma-spacing": "error",
    "@stylistic/key-spacing": "error",
    "@stylistic/keyword-spacing": "error",
    "@stylistic/space-before-blocks": "error",
    "@stylistic/space-infix-ops": "error",
    "@stylistic/space-before-function-paren": ["error", { "anonymous": "always", "named": "never", "asyncArrow": "always" }],
    "@stylistic/type-annotation-spacing": "error",
    "@stylistic/no-multiple-empty-lines": ["error", { "max": 1, "maxEOF": 0 }],
    "@stylistic/no-trailing-spaces": "error",
    "@stylistic/eol-last": "error",
    // memory leak prevention
    "no-loop-func": "error",
  },
  overrides: [
    {
      files: ["**/*.spec.ts", "**/*.test.ts"],
      plugins: ["jest"],
      extends: ["plugin:jest/recommended"],
      env: { "jest/globals": true },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/unbound-method": "off",
        "jest/no-disabled-tests": "warn",
        "jest/no-focused-tests": "error",
        "jest/no-identical-title": "error",
        "jest/expect-expect": "error",
        "jest/no-conditional-expect": "error",
        "jest/valid-expect": "error",
      },
    },
  ],
};
