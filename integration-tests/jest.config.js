module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.integration.test.ts'],
  testTimeout: 30000, // 30 seconds for integration tests
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.test.ts',
    '!**/*.d.ts'
  ]
};
