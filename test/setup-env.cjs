// Tests never connect to the real database or use production credentials.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_only';
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-at-least-32-characters';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-at-least-32-characters';
process.env.ACCESS_TOKEN_EXPIRES = '15m';
process.env.REFRESH_TOKEN_EXPIRES = '7d';
process.env.FRONTEND_URL = 'http://localhost:3000';
