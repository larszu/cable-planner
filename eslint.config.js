import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Honour the codebase-wide `_`-prefix convention for intentionally
      // unused identifiers (params, vars, caught errors). Used pervasively
      // (`_event`, `_item`, `_row`, `_onClose`, …).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Guard against text-quality regressions:
      //  - "stripped umlauts" (e.g. "Gerat" instead of "Gerät") which used to
      //    sneak in via tools that ANSI-flatten our UTF-8 source files.
      //  - mojibake (e.g. "GerÃ¤t") from double-encoded UTF-8 saves.
      // Two selectors per pattern: string literals AND JSX text nodes.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Literal[value=/\\b(Anderungen|verfugbar|Gerat|gewahlt|loschen|auswahlen|abwahlen|wahlen|gultig|gultige|Ubertragung|ubertragen|grosse|zurucksetzen|zuruck|nachstes|nachste|mochte|kunftig|Rack-Gerat)\\b/]",
          message:
            'Stripped umlaut detected — write the proper German form with ä/ö/ü/ß (e.g. "Gerät", "Änderungen", "auswählen").',
        },
        {
          selector:
            "JSXText[value=/\\b(Anderungen|verfugbar|Gerat|gewahlt|loschen|auswahlen|abwahlen|wahlen|gultig|gultige|Ubertragung|ubertragen|grosse|zurucksetzen|zuruck|nachstes|nachste|mochte|kunftig|Rack-Gerat)\\b/]",
          message:
            'Stripped umlaut detected — write the proper German form with ä/ö/ü/ß.',
        },
        {
          selector: "Literal[value=/[ÃâÂ][\\u0080-\\u00FF]/]",
          message:
            'Possible mojibake (UTF-8 double-encoding). File may have been saved with the wrong charset — re-save as UTF-8.',
        },
        {
          selector: "JSXText[value=/[ÃâÂ][\\u0080-\\u00FF]/]",
          message:
            'Possible mojibake in JSX text. Re-save the file as UTF-8.',
        },
        // zustand v5 footgun — a store selector that returns a NEW reference on
        // every call makes useSyncExternalStore see a changed snapshot each
        // render → "Maximum update depth exceeded" (see #435 CanvasToolbar,
        // #412 RevisionsDialog; AnnotationsPanel documents the canonical fix).
        // Keep selectors returning a stable store ref; apply `?? []` / `.map()`
        // OUTSIDE the hook, or derive with useMemo. Matches expression-body
        // selectors (the common case); block-body returns aren't covered.
        {
          selector:
            "CallExpression[callee.name=/^use\\w+Store$/] > ArrowFunctionExpression > LogicalExpression[operator=/^(\\?\\?|\\|\\|)$/] > :matches(ArrayExpression, ObjectExpression)",
          message:
            'Unstable zustand selector: `?? []` / `?? {}` inside the selector returns a new reference every render → infinite-loop risk. Move the fallback OUTSIDE the hook, e.g. `useStore(s => s.x) ?? EMPTY`.',
        },
        {
          selector:
            "CallExpression[callee.name=/^use\\w+Store$/] > ArrowFunctionExpression > :matches(ArrayExpression, ObjectExpression)",
          message:
            'Unstable zustand selector: returning an array/object literal creates a new reference every render → infinite-loop risk. Return a stable store value and derive with useMemo in the component.',
        },
        {
          selector:
            "CallExpression[callee.name=/^use\\w+Store$/] > ArrowFunctionExpression > CallExpression[callee.property.name=/^(map|filter|slice|concat|flatMap)$/]",
          message:
            'Unstable zustand selector: `.map()/.filter()/.slice()` returns a new array every render → infinite-loop risk. Select the raw value and derive with useMemo.',
        },
      ],
    },
  },
  {
    // Imperative modal factories: a one-shot view component co-located with
    // its `xDialog()` entry point and mounted via lib/modalRoot's mountModal
    // (outside React's render tree). Fast Refresh doesn't track imperatively
    // mounted modals, so the only-export-components boundary is moot — splitting
    // each into a second file would be pure boilerplate.
    files: ['src/renderer/lib/*Dialog.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/main/**/*.ts', '*.config.{js,ts}', '*.js', '*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
])
