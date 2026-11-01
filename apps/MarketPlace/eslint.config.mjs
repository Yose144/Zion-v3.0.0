// ESLint flat config (ESLint 9 + eslint-config-next 16).
// Next 16 odebral `next lint`; linter se pouští přes `npm run lint` = `eslint .`.
// eslint-config-next 16 exportuje hotový flat config (žádný FlatCompat).
import coreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...coreWebVitals,
  {
    ignores: [
      '.next/**',
      'dist/**',
      'node_modules/**',
      'contracts/**/out/**',
      'contracts/**/cache/**',
    ],
  },
];
