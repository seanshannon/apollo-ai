
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig: Config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/jest.config.ts',
  ],
  // Thresholds apply to the modules the suite actually covers; global
  // percentages over the whole app were previously aspirational (the old
  // suites never imported application code).
  coverageThreshold: {
    './lib/sql-validator.ts': {
      branches: 80,
      functions: 90,
      lines: 85,
    },
    './lib/pii-masking.ts': {
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary',
  ],
  // MC/DC specific configuration
  testTimeout: 10000,
  verbose: true,
};

export default createJestConfig(customJestConfig);
