module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
        'next/core-web-vitals',
        'plugin:@typescript-eslint/recommended'
    ],
    rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': 'warn',
    },
    ignorePatterns: ['*.d.ts']
}; 