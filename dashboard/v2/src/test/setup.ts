import '@testing-library/jest-dom';

// Mock fetch globally
global.fetch = vi.fn();

// Reset fetch mock before each test
beforeEach(() => {
  vi.resetAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
