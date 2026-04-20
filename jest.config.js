/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.js'],
    setupFiles: ['<rootDir>/tests/jest.setup.js'],
    clearMocks: true,
    restoreMocks: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'utils/otpService.js',
        'utils/helpers.js',
        'utils/pricingEngine.js',
        'utils/carbonCalculator.js',
        'utils/redisCache.js',
        'utils/solrClient.js',
        'middleware/errorHandler.js',
        'middleware/jwt.js'
    ],
    coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
    coverageThreshold: {
        global: {
            lines: 70,
            functions: 70
        }
    }
};
