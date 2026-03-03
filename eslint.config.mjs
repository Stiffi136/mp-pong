export default [
  {
    ignores: ["dist/**", "build/**", "coverage/**", "node_modules/**"],
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {
      // Strict baseline for AI-heavy projects: deterministic and reviewable output.
      "array-callback-return": "error",
      "consistent-return": "error",
      "curly": ["error", "all"],
      "default-case-last": "error",
      "default-param-last": "error",
      "dot-notation": "error",
      "eqeqeq": ["error", "always"],
      "no-alert": "error",
      "no-caller": "error",
      "no-console": "error",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-implicit-coercion": ["error", { "allow": [] }],
      "no-iterator": "error",
      "no-labels": "error",
      "no-lone-blocks": "error",
      "no-loop-func": "error",
      "no-multi-str": "error",
      "no-new-func": "error",
      "no-new-wrappers": "error",
      "no-octal": "error",
      "no-proto": "error",
      "no-return-assign": ["error", "always"],
      "no-script-url": "error",
      "no-self-compare": "error",
      "no-sequences": "error",
      "no-throw-literal": "error",
      "no-unmodified-loop-condition": "error",
      "no-unused-expressions": "error",
      "no-unused-vars": [
        "error",
        {
          "args": "all",
          "argsIgnorePattern": "^_",
          "caughtErrors": "all",
          "caughtErrorsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_",
          "ignoreRestSiblings": false,
          "vars": "all",
          "varsIgnorePattern": "^_"
        }
      ],
      "no-use-before-define": ["error", { "functions": false, "classes": true, "variables": true }],
      "no-useless-concat": "error",
      "no-var": "error",
      "object-shorthand": ["error", "always"],
      "prefer-const": "error",
      "prefer-object-has-own": "error",
      "prefer-template": "error",
      "radix": ["error", "always"],
      "require-await": "error",
      "yoda": ["error", "never"]
    }
  }
];
