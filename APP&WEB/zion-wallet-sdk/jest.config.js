module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@noble/hashes/sha2$': '<rootDir>/node_modules/@noble/hashes/sha2.js',
    '^@noble/hashes/legacy$': '<rootDir>/node_modules/@noble/hashes/legacy.js',
    '^@noble/hashes/blake3$': '<rootDir>/node_modules/@noble/hashes/blake3.js',
    '^@noble/ed25519$': '<rootDir>/node_modules/@noble/ed25519/index.js',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ES2020',
          moduleResolution: 'node',
          target: 'ES2020',
          lib: ['ES2020', 'DOM'],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@noble)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};
