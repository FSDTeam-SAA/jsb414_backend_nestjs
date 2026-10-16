# Foreclosure Gold Backend

NestJS, Prisma 7 and PostgreSQL, using the existing controller → service → Prisma structure.

বাংলায় কী পরিবর্তন হয়েছে ও কীভাবে চালাবে: [সহজ গাইড](docs/PRODUCTION-GUIDE.bn.md).

## Local setup

Use Node **26.7.0**, matching `.nvmrc`, CI and Docker.

1. Copy `.env.example` to `.env` only if you do not already have one.
2. Fill in database, two different JWT secrets, frontend origin and email settings.
3. Run:

```sh
npm ci
npm run generate
```

For a **new empty database**:

```sh
npm run migrate:deploy
```

For an **existing database created with db push**, follow the baseline instructions in the Bengali guide first. Never reset a database containing important data.

```sh
npm run start:dev
npm run check
```

The port comes from `PORT` (default 3000). Local Swagger: `/api/docs`.

## Structure

```text
src/
  main.ts                     # Start server, validate environment, Swagger
  app.module.ts               # Register modules
  prisma/                     # Database connection and shutdown
  app/
    config/                   # Environment settings and validation
    errors/                   # Existing error handlers
    helper/                   # Shared setup, public user fields, token helpers
    middlewares/              # Authentication and simple rate limiting
    module/
      auth/                   # Login, OTP and password reset
      user/                   # Users and profiles
      subscription/           # Plans and admin attribution
      health/                 # Liveness and database readiness
    utils/                    # Consistent API response
prisma/
  schema/                     # Existing multi-file schema
  migrations/0_init/          # Initial baseline SQL
scripts/                      # Backup and isolated restore test
test/                         # HTTP tests with a mocked database
```

## API changes to update in the frontend

- Successful OTP verification returns `data.resetToken`. Send it with `email` and `newPassword` to `POST /api/v1/auth/reset-password`. The token expires in five minutes and works once.
- Public plan listing: `GET /api/v1/subscription/active`.
- Full plan listing and individual admin details require an admin or superadmin.
- Login again after this update; old JWTs do not include the new token-purpose/password-version claims.
- New passwords require 8–72 characters and at most 72 UTF-8 bytes.
- Unknown body/query fields are rejected instead of silently discarded.
- Pagination accepts `page >= 1` and `limit <= 100`.

## Deployment

The workflow runs checks, publishes application and migration images tagged with the Git commit SHA, backs up the database, runs migrations once, starts the app, and waits for readiness.

One-time server requirements:

- Docker Engine and Compose with `up --wait`.
- PostgreSQL command-line tools compatible with the database server.
- `/app/.env` with production application credentials.
- `/app/backup.env` with shell-compatible, quoted `BACKUP_DATABASE_URL` and `BACKUP_DIR`.
- Permissions restricted to the deployment user (`chmod 600` for the secret files).
- HTTPS reverse proxy to `127.0.0.1:PORT`.
- Docker registry read access on the server if the images are private.

GitHub secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`. The deployment job uses the GitHub `production` environment.

Application credentials are now provisioned on the server; the workflow does **not** overwrite them from individual GitHub secrets.

No database reset, migration application, server deployment, backup schedule or external monitoring account was performed while preparing these code changes.

## Operational limits

- The auth limiter is for one app instance: 20 requests per IP/email per 15 minutes on registration, login and password reset. It resets with the process. Use shared storage/gateway limiting before scaling.
- Cookies use `SameSite=Lax`. Use frontend and API domains under the same site, and send `credentials: 'include'`. A genuinely cross-site setup needs a separate cookie/CSRF configuration.
- Logout clears the browser cookie. JWTs are otherwise stateless until expiration; revoking an individual stolen refresh token requires a session store.
- Production writes structured logs and request IDs; connect your log/alert provider and an external health monitor before launch.
- Deployment makes a local backup. Set up encrypted off-server copies, scheduled backups and restore drills.
- Failed readiness attempts a rollback to the previous recorded image. Database changes remain applied, so migrations must be compatible with the previous app release.
- A single app instance can have a short interruption during replacement. This is not a zero-downtime deployment.
- The unused Redis service was removed from this Compose definition; no existing server Redis instance or data was deleted.

## Author

Saurav Sarkar
