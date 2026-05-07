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
      ],
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
    },
  },
])
