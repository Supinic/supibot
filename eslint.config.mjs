import tseslint from "typescript-eslint";
import eslintJs from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import unicornPlugin from "eslint-plugin-unicorn";
import globals from "globals";

export default tseslint.config(
	eslintJs.configs.recommended,
	unicornPlugin.configs.unopinionated,
	tseslint.configs.strictTypeChecked,
	{
		ignores: [".db/", ".yarn/", "coverage/", "build/", "**/*.js", "**/*.test.js", "**/*.d.ts", "**/*.mjs", "tests/**"]
	},
	{
		plugins: {
			"@stylistic": stylistic
		},
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname
			},
			globals: {
				...globals.browser,
				...globals.es2025,
				...globals.node,
				core: "readonly",
				sb: "readonly"
			},
			ecmaVersion: 2025,
			sourceType: "module"
		},
		rules: {
			// JavaScript rules
			"array-bracket-newline": ["warn", "consistent"],
			"array-bracket-spacing": ["warn", "never"],
			"array-element-newline": ["warn", "consistent"],
			"arrow-body-style": ["warn", "as-needed"],
			"arrow-spacing": ["warn", {
				after: true,
				before: true
			}],
			"brace-style": ["warn", "stroustrup", {
				allowSingleLine: true
			}],
			"comma-dangle": ["warn", "never"],
			curly: ["warn", "all"],
			"dot-location": ["warn", "property"],
			"dot-notation": "warn",
			"eol-last": ["warn", "always"],
			eqeqeq: "error",
			"function-call-argument-newline": ["warn", "consistent"],
			"implicit-arrow-linebreak": ["error", "beside"],
			indent: ["warn", "tab", {
				SwitchCase: 1
			}],
			"key-spacing": ["warn", {
				afterColon: true,
				beforeColon: false,
				mode: "strict"
			}],
			"keyword-spacing": ["warn", {
				after: true,
				before: true
			}],
			"lines-between-class-members": ["warn", "always", {
				exceptAfterSingleLine: true
			}],
			"max-nested-callbacks": ["warn", { max: 3 }],
			"max-params": ["warn", { max: 5 }],
			"max-statements-per-line": ["error", { max: 1 }],
			"multiline-ternary": ["warn", "always-multiline"],
			"new-cap": ["warn", {
				capIsNew: false,
				newIsCap: true,
				properties: false
			}],
			"new-parens": ["error", "always"],
			"newline-per-chained-call": ["warn", {
				ignoreChainWithDepth: 3
			}],
			"no-bitwise": "error",
			"no-console": "off",
			"no-control-regex": "off",
			"no-duplicate-imports": "error",
			"no-empty-pattern": "error",
			"no-lonely-if": "warn",
			"no-mixed-operators": ["error", {
				groups: [
					["&&", "||"],
					["&", "|", "^", "~", "<<", ">>", ">>>"],
					["==", "!=", "===", "!==", ">", ">=", "<", "<="]
				]
			}],
			"no-multi-assign": "error",
			"no-multi-spaces": "warn",
			"no-multi-str": "warn",
			"no-multiple-empty-lines": ["warn", {
				max: 2,
				maxBOF: 0,
				maxEOF: 0
			}],
			"no-nested-ternary": "off",
			"no-new": "warn",
			"no-new-object": "error",
			"no-new-wrappers": "error",
			"no-proto": "error",
			"no-return-assign": "error",
			"no-return-await": "off",
			"no-self-compare": "warn",
			"no-sequences": "error",
			"no-trailing-spaces": ["warn", {
				skipBlankLines: true
			}],
			"no-underscore-dangle": "off",
			"no-unneeded-ternary": "warn",
			"no-unused-vars": "off",
			"no-useless-computed-key": "warn",
			"no-useless-constructor": "warn",
			"no-useless-rename": "error",
			"no-var": "error",
			"no-whitespace-before-property": "warn",
			"no-unused-private-class-members": "warn",
			"no-with": "error",
			"object-curly-newline": ["warn", {
				consistent: true
			}],
			"object-curly-spacing": ["warn", "always", {
				arraysInObjects: true,
				objectsInObjects: true
			}],
			"object-property-newline": ["warn", {
				allowAllPropertiesOnSameLine: true
			}],
			"object-shorthand": ["warn", "properties"],
			"one-var": ["warn", "never"],
			"operator-linebreak": ["warn", "before"],
			"padded-blocks": ["warn", "never"],
			"prefer-arrow-callback": "warn",
			"prefer-const": ["warn", {
				destructuring: "all"
			}],
			"prefer-exponentiation-operator": "warn",
			"prefer-numeric-literals": "warn",
			"prefer-object-spread": "warn",
			"prefer-rest-params": "error",
			"prefer-template": "warn",
			"quote-props": ["warn", "as-needed"],
			quotes: ["warn", "double", {
				allowTemplateLiterals: true
			}],
			"rest-spread-spacing": ["warn", "never"],
			semi: ["warn", "always"],
			"semi-spacing": ["warn", {
				before: false,
				after: true
			}],
			"semi-style": ["warn", "last"],
			"sort-keys": ["off", "asc"],
			"space-before-blocks": ["warn", "always"],
			"space-before-function-paren": ["warn", "always"],
			"space-in-parens": ["warn", "never"],
			"space-infix-ops": "error",
			"space-unary-ops": "warn",
			"spaced-comment": ["warn", "always"],
			"switch-colon-spacing": ["warn", {
				after: true,
				before: false
			}],
			"symbol-description": "off",
			"template-curly-spacing": ["warn", "never"],
			"template-tag-spacing": ["warn", "always"],
			"wrap-iife": ["warn", "inside"],
			yoda: "error",

			// Unicorn rules - additions
			"unicorn/catch-error-name": ["warn", {
				name: "e"
			}],
			"unicorn/empty-brace-spaces": "warn",
			"unicorn/new-for-builtins": "error",
			"unicorn/no-array-push-push": "warn",
			"unicorn/no-console-spaces": "warn",
			"unicorn/no-lonely-if": "warn",
			"unicorn/no-instanceof-array": "error",
			"unicorn/no-nested-ternary": "warn",
			"unicorn/no-new-buffer": "error",
			"unicorn/no-unreadable-array-destructuring": "error",
			"unicorn/number-literal-case": "warn",
			"unicorn/numeric-separators-style": ["warn", {
				onlyIfContainsSeparator: true
			}],
			"unicorn/prefer-array-find": "warn",
			"unicorn/prefer-array-flat": "warn",
			"unicorn/prefer-array-flat-map": "warn",
			"unicorn/prefer-array-index-of": "warn",
			"unicorn/prefer-array-some": "warn",
			"unicorn/prefer-regexp-test": "warn",
			"unicorn/prefer-date-now": "warn",
			"unicorn/prefer-includes": "warn",
			"unicorn/prefer-math-trunc": "warn",
			"unicorn/prefer-string-starts-ends-with": "warn",
			"unicorn/prefer-string-trim-start-end": "warn",
			"unicorn/throw-new-error": "error",
			"unicorn/prefer-switch": ["error", { minimumCases: 4 }],
			"unicorn/consistent-function-scoping": ["warn", { checkArrowFunctions: false }], // triggers on class timeout/interval callbacks that use `this`

			// Unicorn rules - removals
			"unicorn/prefer-ternary": "off", // Could be perhaps enabled later as ["warn", "only-single-line"]
			"unicorn/no-negated-condition": "off", // Could be perhaps enabled later to enforce a specific condition flow
			"unicorn/no-typeof-undefined": "off", // Too much of a "muscle memory" for me
			"unicorn/better-dom-traversing": "off", // Irrelevant in a node project
			"unicorn/no-array-sort": "off", // Doesn't allow in-place sorting
			"unicorn/prefer-event-target": "off", // Not the same API as EventEmitter, fine in a Node.js project
			"unicorn/require-array-sort-compare": "off", // Superseded by TypeScript rule @typescript-eslint/require-array-sort-compare
			"unicorn/prefer-at": "off", // Just flat out wrong in some cases
			"unicorn/prefer-type-literal-last": "off", // Not un-opinionated
			"unicorn/prefer-uint8array-base64": "off", // Prefer working with Buffer myself
			"unicorn/prefer-minimal-ternary": "off", // Seems to just not work? api/index.ts
			"unicorn/prefer-await": "off", // Triggers in constructors (??),
			"unicorn/prefer-unicode-code-point-escapes": "off", // Conflicts with no-incorrect-template-string-interpolation and also makes regexes way too verbose

			// TypeScript rules
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/restrict-template-expressions": ["warn", { // Allow numbers in template expressions without requiring explicit stringification
				allowNumber: true
			}],
			"@typescript-eslint/no-confusing-void-expression": ["warn", { // Ignore arrow functions implicitly "returning" another void function's result
				ignoreVoidReturningFunctions: true
			}],
			"@typescript-eslint/no-unused-vars": "warn", // Only warn for unused vars instead of resulting in an error
			"@typescript-eslint/no-unnecessary-condition": "warn", // Only warn for unnecessary conditions  instead of resulting in an error
			"@typescript-eslint/no-unnecessary-type-assertion": "off", // Can trigger false positives (TwitchPlatform)
			"@typescript-eslint/no-unnecessary-type-conversion": "off", // Maybe re-enable later to force proper types
			"@typescript-eslint/no-useless-default-assignment": "off", // Does not work for rest arguments
			"@typescript-eslint/require-array-sort-compare": "warn", // Supersedes unicorn/require-array-sort-compare

			// Style rules
			"@stylistic/brace-style": ["warn", "stroustrup", { allowSingleLine: true }],
			"@stylistic/indent": ["warn", "tab"],
			"@stylistic/no-extra-semi": "warn",
			"@stylistic/semi": "warn",
		}
	},
	{
		files: ["tests/**/*.{test,spec}.ts", "**/*.test.ts"],
		languageOptions: {},
		rules: {
			"max-nested-callbacks": "off", // There is a ton of nesting within test suites
			"max-statements-per-line": ["warn", { max: 2 }], // Tests sometimes stack up two statements to save space
			"unicorn/prefer-module": "off", // Different importing system (because of loaders)
			"unicorn/consistent-function-scoping": "off",
			"unicorn/no-useless-undefined": "off",
			"unicorn/no-await-expression-member": "off",
			"@typescript-eslint/no-floating-promises": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }]
		}
	}
);
