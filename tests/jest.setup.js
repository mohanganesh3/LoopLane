// Jest global test setup
// Provide safe defaults for env vars that some modules expect.

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_32_chars_minimum_123456';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_32_chars_minimum_123456';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test_cookie_secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/looplane-test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
