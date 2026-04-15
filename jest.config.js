/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    setupFiles: ['<rootDir>/tests/jest.setup.js'],
    clearMocks: true,
    restoreMocks: true,
    coverageDirectory: 'coverage'
};
