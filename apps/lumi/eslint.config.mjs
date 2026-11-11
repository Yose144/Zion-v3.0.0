// ESLint flat config (ESLint 9 + eslint-config-next 16).
import coreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...coreWebVitals,
  {
    ignores: ['.next/**', 'node_modules/**', 'src/generated/**', 'scripts/**'],
  },
  {
    rules: {
      // Hydratační vzorec (stav z localStorage až po mountu) — viz MarketPlace.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
