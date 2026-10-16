# সহজভাবে পরিবর্তনগুলো বোঝা

তোমার পরিচিত folder structure এবং controller → service → Prisma ধরন রাখা হয়েছে। আলাদা repository layer, microservice বা জটিল framework যোগ করা হয়নি।

## ১. কোন ফাইলের কাজ কী

| জায়গা                                          | কাজ                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `src/main.ts`                                  | environment ঠিক আছে কি না দেখে server চালায়                           |
| `src/app/helper/setup-app.ts`                  | CORS, validation, request ID ও response/error handling এক জায়গায় রাখে |
| `src/app/config/validate-env.ts`               | প্রয়োজনীয় setting না থাকলে শুরুতেই পরিষ্কার error দেয়                 |
| `src/app/module/auth/`                         | login, token, OTP ও password reset                                    |
| `src/app/middlewares/auth.guard.ts`            | token এবং database-এর বর্তমান role দেখে permission দেয়                |
| `src/app/middlewares/auth-rate-limit.guard.ts` | বারবার login/OTP চেষ্টা সীমিত করে                                     |
| `src/app/helper/public-user-select.ts`         | কোন user field API-তে দেওয়া যাবে তা নির্ধারণ করে                      |
| `src/app/module/subscription/`                 | plan তৈরি, দেখা, পরিবর্তন ও কোন admin কাজ করেছে তা রাখা               |
| `src/app/module/health/`                       | app ও database কাজ করছে কি না পরীক্ষা                                 |
| `src/prisma/prisma.service.ts`                 | connection pool, timeout ও বন্ধ হওয়ার সময় disconnect                  |
| `prisma/migrations/`                           | database পরিবর্তনের SQL history                                       |
| `Dockerfile`                                   | app ও migration-এর আলাদা image stage                                  |
| `scripts/`                                     | backup এবং আলাদা খালি database-এ restore test                         |

Controller request নেয়, DTO input পরীক্ষা করে, service আসল কাজ করে, Prisma database ব্যবহার করে। এই নিয়মেই পরের feature লিখবে।

## ২. Auth-এ কী সমস্যা ঠিক হয়েছে

আগে register ও refresh response-এ password hash চলে আসতে পারত। এখন public field নির্বাচন করে response তৈরি হয়।

আগে OTP-এর expiry ঠিকভাবে দেখা হতো না। এখন code ১০ মিনিট পরে অকার্যকর হয়, code database-এ keyed hash হিসেবে থাকে এবং সফল verification-এর পর একই code আবার ব্যবহার করা যায় না।

আগে শুধু email এবং `verifiedForget` flag দিয়ে password বদলানো যেত। এখন OTP verification থেকে পাওয়া reset token লাগবে। এটি ৫ মিনিটের এবং একবার ব্যবহারযোগ্য। একই token দিয়ে একসঙ্গে দুটি reset request এলেও একটি সফল হতে পারবে।

Access, refresh এবং reset token-এর উদ্দেশ্য আলাদা করে পরীক্ষা হয়। Password বদলালে আগের access/refresh token অকার্যকর হয়। Admin-এর role বদলালে পুরোনো token দিয়ে আগের permission পাওয়া যায় না।

এই আপডেটের পরে একবার নতুন করে login করবে। পুরোনো OTP থাকলে নতুন OTP চাইবে।

### Frontend-এর password reset flow

১. `POST /api/v1/auth/forgot-password`

```json
{ "email": "user@example.com" }
```

২. Email-এর code দিয়ে `POST /api/v1/auth/verify-email-otp`

```json
{ "email": "user@example.com", "otp": "123456" }
```

Response-এর `data.resetToken` সাময়িকভাবে memory-তে রাখবে।

৩. `POST /api/v1/auth/reset-password`

```json
{
  "email": "user@example.com",
  "newPassword": "My-new-password123",
  "resetToken": "TOKEN_FROM_PREVIOUS_RESPONSE"
}
```

Token expire হলে নতুন code চাইতে হবে। Password বা token console-এ print করবে না।

Login/refresh cookie পাঠাতে frontend request-এ `credentials: 'include'` ব্যবহার করবে। Production cookie-এর জন্য HTTPS দরকার। Default `SameSite=Lax` হওয়ায় frontend/API একই site-এর subdomain রাখা সহজ; সম্পূর্ণ আলাদা site হলে cookie ও CSRF configuration আলাদা করে ঠিক করতে হবে।

Logout browser cookie মুছে দেয়। আলাদা device/session revoke করার feature এখনও নেই; তার জন্য session table/store দরকার হবে।

## ৩. Subscription API

| Request                           | কে ব্যবহার করবে                                             |
| --------------------------------- | ----------------------------------------------------------- |
| `GET /api/v1/subscription/active` | সবাই; admin-এর email দেখাবে না                              |
| `GET /api/v1/subscription`        | admin ও superadmin; filter/pagination এবং admin attribution |
| `GET /api/v1/subscription/:id`    | admin ও superadmin                                          |
| `POST /api/v1/subscription`       | admin ও superadmin                                          |
| `PATCH /api/v1/subscription/:id`  | admin ও superadmin                                          |
| `DELETE /api/v1/subscription/:id` | admin ও superadmin; বর্তমান delete behavior রাখা হয়েছে      |

`createdById` ও `updatedById` frontend থেকে নেবে না; logged-in admin থেকে server বসায়। Plan লুকাতে `PATCH`-এ `isActive: false` পাঠাতে পারো।

Price integer cents হিসেবে রাখবে: ৪৯ ডলার হলে `4900`। Discount ০–১০০-এর মধ্যে। Plan-এর latest updater থাকে; প্রত্যেক পরিবর্তনের সম্পূর্ণ audit history এখনও আলাদা table-এ রাখা হয়নি।

## ৪. Local-এ চালানো

বর্তমান `.env` বদলানো হয়নি। প্রয়োজনীয় setting-এর নমুনা `.env.example`-এ আছে। Existing `.env`-এর ওপর example copy করে overwrite করবে না।

Node 26.7.0 ব্যবহার করা হয়েছে, যেটি তোমার মেশিনে চলছে। একই version CI/Docker-এও নির্দিষ্ট আছে।

```powershell
npm ci
npm run generate
npm run check
npm run start:dev
```

Tests-এ mocked database ব্যবহার হয়; এগুলো real database-এর data পরিবর্তন করে না।

`FRONTEND_URL`-এ সঠিক frontend origin দেবে, যেমন `http://localhost:5173`; শেষে slash/path নয়। `PORT` অনুযায়ী API চলবে। Local Swagger `/api/docs`-এ পাওয়া যাবে।

Secret তৈরি করতে আলাদাভাবে দুইবার চালাতে পারো:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

প্রতিবারের আলাদা value যথাক্রমে access ও refresh secret-এ বসাবে। Production-এ ৩২ অক্ষরের কম বা একই secret গ্রহণ করা হবে না।

## ৫. Existing database-এর migration baseline

`0_init/migration.sql` বর্তমান schema থেকে তৈরি হয়েছে। এটি তোমার database-এ প্রয়োগ করা হয়নি। Database-এর structure বা data পরিবর্তন করা হয়নি।

প্রথমে backup নেবে। Existing database-এর জন্য `.env` যে database নির্দেশ করছে সেটি নিশ্চিত হয়ে শুধু এই read-only check চালাবে:

```powershell
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code
```

Exit code ০ মানে Prisma-র representable structure-এ পার্থক্য নেই। Exit code ২ মানে পার্থক্য আছে—সেক্ষেত্রে পরের command চালাবে না; আগে পার্থক্য মিলিয়ে নিতে হবে। Trigger বা custom SQL থাকলে baseline-এ আলাদাভাবে review করতে হবে।

শুধু matching existing database-এর জন্য:

```powershell
npx prisma migrate resolve --applied 0_init
npm run migrate:status
```

এটি SQL দিয়ে টেবিল আবার তৈরি করে না; migration history-তে existing structure-এর হিসাব রাখে।

নতুন খালি database হলে `resolve --applied` চালাবে না। সেখানে:

```powershell
npm run migrate:deploy
```

পরের schema পরিবর্তন development database-এ করবে:

```powershell
npm run migrate:dev -- --name describe_your_change
npm run generate
npm run check
```

Migration folder Git-এ রাখবে। Production-এ `db push`, `migrate dev` বা reset ব্যবহার করবে না। এক database-এর baseline status অন্য database-এ নিজে থেকে যায় না।

## ৬. Deployment কীভাবে কাজ করে

এখন workflow-এর ধাপ:

```text
dependency install → generate → checks/tests/build
→ commit SHA দিয়ে app ও migration image
→ database backup সফল হয়েছে নিশ্চিত করা
→ migrate deploy একবার
→ নতুন app চালু → database health check
```

তোমার production server-এ একবার প্রস্তুত করতে হবে:

- Docker এবং Compose-এর `--wait` support।
- Database server version-এর উপযুক্ত PostgreSQL command-line tools।
- `/app/.env`-এ production application settings।
- `/app/backup.env`-এ backup setting।
- Secret file-এর permission `600`, deployment user-এর ownership।
- HTTPS reverse proxy থেকে `127.0.0.1:PORT`-এ traffic পাঠানো।
- Private Docker image হলে server-এ registry login।

আগের workflow individual GitHub Secrets দিয়ে `.env` লিখত। এখন server-এর `.env` রাখা হয়; workflow সেটি overwrite করে না। তাই প্রথম deployment-এর আগে এই file তৈরি করতে হবে।

`/app/backup.env` একটি trusted shell-compatible file; উদাহরণ:

```sh
BACKUP_DATABASE_URL='postgresql://BACKUP_USER:PASSWORD@DB_HOST:5432/DATABASE?sslmode=verify-full'
BACKUP_DIR='/var/backups/foreclosure-gold'
```

Database provider-এর certificate/connection নির্দেশনা অনুযায়ী URL দেবে। Prisma-র `schema=public` parameter backup URL-এ রাখবে না। Docker-এর ভেতরে `localhost` container-কেই বোঝায়; host বা managed database-এর reachable address ব্যবহার করবে।

GitHub-এ লাগবে `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`। Docker Hub-এ `nestjs-app` এবং `nestjs-app-migration` repository রাখবে। GitHub-এর `production` environment-এ deployment controls রাখতে পারো।

কেবল runtime app image-এ Prisma CLI নেই। সেটি migration image-এ আছে; app প্রতিবার restart হলে migration আবার চালাবে না।

Health fail হলে workflow আগের recorded image চালানোর চেষ্টা করে। Database migration তখনও applied থাকে—তাই পুরোনো app-এর সঙ্গেও migration compatible রাখা দরকার। প্রথম deployment-এ আগের recorded image না থাকলে automatic rollback সম্ভব নয়। একটি instance বদলানোর সময় অল্প interruption হতে পারে।

## ৭. Backup ও restore

Deployment-এর আগে backup script চলে। এটি database data পাল্টায় না; custom-format dump file বানায়। Backup fail হলে deployment থামে।

Server-এ manual backup:

```sh
cd /app
(set -a; . ./backup.env; set +a; bash ./backup.sh)
```

প্রতিদিনের backup-এর জন্য server scheduler-এ একই command বসাবে। যেমন cron-এর একটি entry:

```cron
0 2 * * * cd /app && (set -a; . ./backup.env; set +a; bash ./backup.sh) >> /var/log/foreclosure-backup.log 2>&1
```

সময় server-এর timezone অনুযায়ী। Scheduler, failure alert, encrypted off-server upload ও retention এখনও server-এ configure করা হয়নি। শুধু একই server-এ backup রাখলে server নষ্ট হওয়ার ঝুঁকি থেকে সুরক্ষা পাওয়া যায় না।

আলাদা খালি test database-এ restore পরীক্ষা:

```sh
export RESTORE_TEST_DATABASE_URL='postgresql://TEST_USER:PASSWORD@HOST:5432/RESTORE_TEST'
bash scripts/restore-test.sh /path/to/backup.dump
```

Script existing user table পেলে থেমে যায়। তবুও URL যেন production-এর না হয় নিশ্চিত হবে। Restore শেষে row count এবং app-এর গুরুত্বপূর্ণ কাজ পরীক্ষা করবে।

## ৮. Error monitoring

Production-এ JSON log, error status এবং request ID পাওয়া যাবে। Response-এর `X-Request-Id` দিয়ে একই request-এর log খুঁজতে পারবে।

Log দেখতে server-এর `/app` directory থেকে, recorded tag সেট করে:

```sh
cd /app
export IMAGE_TAG="$(cat .release)"
# DOCKER_USERNAME must also be available in /app/.env or the shell.
docker compose logs --tail 100 app
```

External health monitor-এ `https://YOUR_API_DOMAIN/api/v1/health/ready` বসাবে এবং বারবার fail হলে alert দেবে। তোমার log collector-এ নতুন/বাড়তে থাকা 5xx error এবং backup failure-এর alert configure করবে।

External alert service বা Sentry account configure করা হয়নি। Console log-ই পূর্ণ error monitoring নয়। কোনো log/event-এ password, OTP, token বা database URL যোগ করবে না।

## ৯. কী যাচাই হয়েছে, কী বাকি

Unit ও HTTP regression tests বাস্তব bug-এর আচরণ পরীক্ষা করে। HTTP tests-এ database mocked; live PostgreSQL, mail delivery, Cloudinary এবং Docker image/server deployment-এর পরীক্ষা আলাদা করে করতে হবে।

এই মেশিনে Docker command পাওয়া যায়নি, তাই image build বা container health/shutdown সরাসরি পরীক্ষা করা হয়নি। Docker Compose/YAML syntax আলাদাভাবে পরীক্ষা করা হয়েছে।

বর্তমান project-এ payment, lead import ও marketplace-এর সম্পূর্ণ business feature নেই। এই পরিবর্তনগুলো এখনকার auth/user/subscription এবং deployment-এর ভিত্তি উন্নত করে; অসম্পূর্ণ business feature সম্পূর্ণ করেছে এমন দাবি নয়।

Single-instance rate limiter process restart হলে reset হয়। একাধিক instance-এর আগে shared/gateway limiter লাগবে। ভবিষ্যতে payment যোগ করলে webhook signature, idempotency এবং transaction tests আলাদাভাবে লাগবে।

## References

- [Prisma baseline](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining)
- [NestJS shutdown lifecycle](https://docs.nestjs.com/fundamentals/lifecycle-events)
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/)
- [PostgreSQL backup](https://www.postgresql.org/docs/current/app-pgdump.html)
- [Docker health-gated startup](https://docs.docker.com/reference/cli/docker/compose/up/)
