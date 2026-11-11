// ESLint flat config (ESLint 9 + eslint-config-next 16).
import coreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...coreWebVitals,
  {
    ignores: ['.next/**', 'node_modules/**', 'src/generated/**', 'scripts/**'],
  },
  {
    rules: {
      // Hydratační vzorec (stav z localStorage až po mountu) — viz MarketPlace.
      'react-hooks/set-state-in-effect': 'warn',
      // `next/image` je v Lumi vypnutý (`images.unoptimized`) a obrázky jsou
      // předem připravené WebP varianty (`src/lib/images.ts`). Next optimizer
      // nemá co dělat — pravidlo by jen hlásilo každý `<img>` na webu.
      '@next/next/no-img-element': 'off',
    },
  },
];

export default config;
