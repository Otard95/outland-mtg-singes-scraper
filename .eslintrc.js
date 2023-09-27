const DEFAULT_PLUGINS = ['@typescript-eslint', 'prettier'];

const DEFAULT_TYPESCRIPT_EXTENDS = [
  'airbnb-typescript',
  'plugin:@typescript-eslint/recommended',
  'plugin:@typescript-eslint/recommended-requiring-type-checking',
  'plugin:prettier/recommended',
];

const DEFAULT_PARSER_OPTIONS = {
  project: 'tsconfig.eslint.json',
  tsconfigRootDir: process.cwd(),
  sourceType: 'module',
};

const COMMON_TS_RULES = {
  '@typescript-eslint/restrict-template-expressions': 'warn',
  '@typescript-eslint/no-empty-interface': 'warn',
  '@typescript-eslint/no-floating-promises': 'warn',
  '@typescript-eslint/no-use-before-define': [
    'error',
    {
      functions: false,
    },
  ],
};

const COMMON_RULES = {
  'prettier/prettier': [
    'error',
    {
      semi: true,
      singleQuote: true,
      trailingComma: 'es5',
      bracketSpacing: true,
      arrowParens: 'always',
      printWidth: 80,
      tabWidth: 2,
    },
  ],
  'no-restricted-syntax': 'off',
  'no-await-in-loop': 'off',
  'no-plusplus': 'off',
  'no-console': 'off', // Why would you want this on? ... proper madness...
  'import/prefer-default-export': 'off',
  'import/no-default-export': 'warn',
  'import/no-cycle': 'warn', // Should turn this back on later. [Discussion needed] Majority of the time we have dependecy cycle is just Types being thrown around. Can avoid this by making type declaration files.
  'no-underscore-dangle': ['error', { allow: ['__typename'] }], // We need to allow this since it comes from the cms.
  'no-use-before-define': 'off', // Note: you must disable the base rule when using '@typescript-eslint/no-use-before-define', as it can report incorrect errors
  'import/extensions': 0,
  quotes: [
    'error',
    'single',
    { avoidEscape: true, allowTemplateLiterals: true },
  ], // Some badboy 3rd party decided we should switch to double quotes after using singles for 10 years
  'import/order': [
    'error',
    {
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
      groups: [
        ['builtin', 'external'],
        'internal',
        ['sibling', 'parent', 'unknown', 'index'],
      ],
      pathGroupsExcludedImportTypes: ['internal', 'react'],
      pathGroups: [
        {
          pattern: '@(react|react-native)',
          group: 'external',
          position: 'before',
        },
        {
          pattern: '~*/**',
          group: 'internal',
          position: 'after',
        },
        {
          pattern: '@internal/**',
          group: 'internal',
          position: 'after',
        },
      ],
    },
  ],
};

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: DEFAULT_PLUGINS,
  parserOptions: DEFAULT_PARSER_OPTIONS,
  ignorePatterns: [
    'lib',
    'lib-cjs',
    '.turbo',
    'storybook-static',
    'node_modules',
  ],
  extends: ['airbnb', 'eslint:recommended', 'plugin:prettier/recommended'],
  // Should probably do this for story files to prevent eslint complaining about dependencies https://stackoverflow.com/questions/34764287/turning-off-eslint-rule-for-a-specific-file/65069069#65069069
  overrides: [
    {
      files: ['*.ts', '*.mts', '*.cts', '*.tsx'], // TypeScript files extension
      plugins: DEFAULT_PLUGINS,
      extends: DEFAULT_TYPESCRIPT_EXTENDS,
      parserOptions: DEFAULT_PARSER_OPTIONS,
      rules: { ...COMMON_TS_RULES, ...COMMON_RULES },
    },

    {
      // Turn this rule off for story files. Should make the glob support more paths
      files: ['*story.tsx', '*stories.tsx', '*stories.mdx', '*story.mdx'],

      extends: DEFAULT_TYPESCRIPT_EXTENDS,
      plugins: DEFAULT_PLUGINS,
      parserOptions: DEFAULT_PARSER_OPTIONS,

      rules: {
        ...COMMON_TS_RULES,
        ...COMMON_RULES,
        'import/no-extraneous-dependencies': [
          'warn',
          {
            devDependencies: true,
            optionalDependencies: true,
            peerDependencies: true,
          },
        ],
      },
    },
  ],
  rules: {
    ...COMMON_RULES,
  },
};
