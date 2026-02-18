import next from 'eslint-config-next';

const config = [
  ...next,
  {
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default config;
