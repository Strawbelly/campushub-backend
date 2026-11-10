/** @jest-config-loader ts-node */
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // Inherit tsconfig.json (strict mode intact); only add Jest's global types.
        tsconfig: { types: ['node', 'jest'] },
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  // mongodb-memory-server may download a MongoDB binary on first run.
  testTimeout: 60000,
};

export default config;
