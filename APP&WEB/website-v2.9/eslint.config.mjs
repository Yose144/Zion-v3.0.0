import next from 'eslint-config-next';
import reactHooks from 'eslint-plugin-react-hooks';

const config = [
  ...next,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default config;
