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
  {
    // `react-hooks/set-state-in-effect` je nové pravidlo z React Compiler lintu.
    // V tomhle projektu ho plní legitimní hydratační vzorec: stav se po mountu
    // doladí z localStorage (jazyk, košík, admin session), aby SSR a první
    // klientský render zůstaly shodné. Přepsat to na lazy initializer by
    // rozbilo hydrataci, proto rule = warn, ne error.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
