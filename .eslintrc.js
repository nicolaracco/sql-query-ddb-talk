module.exports = {
  env: {
    node: true,
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: '2018',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  ignorePatterns: ['*.js', '*.d.ts', 'node_modules/', '*.generated.ts', 'cdk.out/'],
  rules: {
    '@typescript-eslint/no-non-null-assertion': 'off',
    'prettier/prettier': 'error',
  },
};
