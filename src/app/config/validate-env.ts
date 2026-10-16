// Fail at startup with variable names only. Never print secret values.
export function validateEnvironment(env: NodeJS.ProcessEnv) {
  const errors: string[] = [];
  for (const name of [
    'DATABASE_URL',
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
  ]) {
    if (!env[name]?.trim()) errors.push(`${name} is required`);
  }
  if (env.DATABASE_URL && !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    errors.push('DATABASE_URL must be a PostgreSQL URL');
  }
  if (
    env.NODE_ENV &&
    !['development', 'test', 'production'].includes(env.NODE_ENV)
  ) {
    errors.push('NODE_ENV must be development, test or production');
  }
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    errors.push('PORT is invalid');
  const rounds = Number(env.BCRYPT_SALT_ROUNDS || 12);
  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15)
    errors.push('BCRYPT_SALT_ROUNDS must be an integer between 10 and 15');
  for (const name of ['ACCESS_TOKEN_EXPIRES', 'REFRESH_TOKEN_EXPIRES']) {
    if (env[name] && !/^[1-9]\d*(s|m|h|d)$/.test(env[name]!))
      errors.push(`${name} must use a duration such as 15m or 7d`);
  }
  if (env.NODE_ENV === 'production') {
    for (const name of ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET']) {
      if ((env[name]?.length || 0) < 32)
        errors.push(`${name} must have at least 32 characters`);
    }
    if (env.ACCESS_TOKEN_SECRET === env.REFRESH_TOKEN_SECRET)
      errors.push('Access and refresh token secrets must be different');
    if (!env.FRONTEND_URL)
      errors.push('FRONTEND_URL is required in production');
    for (const name of [
      'EMAIL_HOST',
      'EMAIL_PORT',
      'EMAIL_ADDRESS',
      'EMAIL_PASS',
      'EMAIL_FROM',
    ]) {
      if (!env[name]?.trim()) errors.push(`${name} is required in production`);
    }
  }
  if (env.FRONTEND_URL) {
    try {
      const url = new URL(env.FRONTEND_URL);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== env.FRONTEND_URL
      )
        errors.push(
          'FRONTEND_URL must be an origin without a path or trailing slash',
        );
      if (env.NODE_ENV === 'production' && url.protocol !== 'https:')
        errors.push('FRONTEND_URL must use HTTPS in production');
    } catch {
      errors.push('FRONTEND_URL is invalid');
    }
  }
  if (errors.length)
    throw new Error(`Environment configuration: ${errors.join('; ')}`);
}
