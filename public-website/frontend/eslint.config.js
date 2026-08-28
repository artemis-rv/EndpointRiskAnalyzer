import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, __APP_MODE__: 'readonly' },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',

      // ── Security-oriented lint rules ────────────────────────────────────
      // A03 (Injection): raw HTML injection must never appear in this codebase.
      'react/no-danger': 'off', // plugin not installed; enforced by no-restricted-syntax below
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'dangerouslySetInnerHTML is banned. All server data is rendered as text (OWASP A03).',
        },
        {
          selector:
            "CallExpression[callee.object.name='localStorage'][callee.property.name=/^(setItem|getItem)$/]",
          message:
            'Do not use localStorage for auth material. Use the token store in api/client/tokenStore.ts.',
        },
      ],
      // A09 (Logging failures): no stray console output in shipped code.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Test files may use console and looser typing.
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
