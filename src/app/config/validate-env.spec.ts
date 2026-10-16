import { validateEnvironment } from './validate-env';

describe('Environment validation', () => {
  const valid = {
    DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
    ACCESS_TOKEN_SECRET: 'access-secret',
    REFRESH_TOKEN_SECRET: 'refresh-secret',
  };
  it('accepts local defaults', () =>
    expect(() => validateEnvironment(valid)).not.toThrow());
  it('rejects invalid ports', () =>
    expect(() => validateEnvironment({ ...valid, PORT: '-1' })).toThrow(
      'PORT',
    ));
  it('rejects ambiguous token durations', () =>
    expect(() =>
      validateEnvironment({ ...valid, ACCESS_TOKEN_EXPIRES: '3600' }),
    ).toThrow('ACCESS_TOKEN_EXPIRES'));
  it('requires production secrets, frontend and mail settings', () => {
    expect(() =>
      validateEnvironment({ ...valid, NODE_ENV: 'production' }),
    ).toThrow('FRONTEND_URL');
  });
  it('does not echo secret values in validation errors', () => {
    expect(() =>
      validateEnvironment({ ...valid, DATABASE_URL: 'private-password' }),
    ).toThrow('DATABASE_URL must be a PostgreSQL URL');
  });
});
