# Deployment
Do not deploy the synthetic demo seed or development secrets.

## Neon
Required database host: **Neon, AWS Europe (Frankfurt)**, region ID **`aws-eu-central-1`**. Select this region when creating the AgriProvider project. Neon fixes the region at project creation; an existing project in another region requires a new Frankfurt project and a database migration. See [Neon regions](https://neon.com/docs/introduction/regions).

Use a separate development branch and the project's production/root branch for production. DATABASE_URL uses the pooled -pooler hostname; DIRECT_URL uses the direct hostname for the same branch/database. Both need sslmode=require. Migrations use DIRECT_URL. Never point functional tests at production: the test harness requires a database whose name ends in _test.

Provisioned project: **AgriProvider Frankfurt**, ID `square-paper-75369060`, PostgreSQL 18, region verified as `aws-eu-central-1`. [Neon console](https://console.neon.tech/app/projects/square-paper-75369060)

- Production branch: `production` (`br-odd-unit-b9f97m0h`). All five Prisma migrations applied; 31 public tables verified, with no application accounts seeded.
- Development branch: `my-new-app` (`br-muddy-moon-b9mcnruh`), used by the local API through Neon's pooled connection.
- Pooled/direct connection settings are stored locally under ignored `.data/neon/production.env` and `.data/neon/development.env`. Never commit these files.
- The development copy preserves all 11 local accounts and their password/MFA settings. At the user's request, three randomly selected learners without login accounts were excluded: Ayanda Zulu, Bongani Ndlovu and Sipho Mthembu. Four learners remain.
- All 16 evidence file records were excluded. Evidence packs/reviews and milestone approvals were reset, certification events cleared, and pending outbox deliveries cancelled to avoid replaying old notifications. Historical audit entries were retained, with a migration entry added. Existing sessions were cleared; sign in again with the same credentials.
- The original local database is unchanged. A cutover dump, the previous API environment and original files are retained under ignored `.data/backups/`; the active `.data/files/` starts empty. New uploads still use local file storage in development; Neon hosts the relational database only.
- A private migration report and filtered dump are under ignored `.data/neon/`. Do not rerun import scripts against a populated branch. Rollback requires restoring the saved API environment and file directory, then restarting the API; preserve any new Neon records/files first.
- Local functional tests continue using separate local `_test` databases. The launcher only starts local PostgreSQL when the API URL targets local port 55432. Existing Ohio projects were not modified.

The local CI workflow uses an ephemeral PostgreSQL service. A separate Neon CI branch should be created and destroyed per run if Neon CI credentials are configured; development connection strings must not be reused for tests.

## Render
The Blueprint defines API, web static site, worker and housekeeping cron. Set its root directory to the folder containing this README if deploying a parent repository. Configure the shared secret environment group in Render before deployment.

Production uses private S3/R2 storage, SMTP delivery and a working ClamAV-compatible executable selected by CLAMSCAN_PATH. Install the scanner and maintain its signature database in your production runtime; startup/upload validation fails closed if it is missing or broken. Local filesystem evidence storage is forbidden in production.

The API's pre-deploy command applies Prisma migrations. /healthz is liveness and /readyz checks DB readiness. Cold database connections retry with backoff. Free-tier spin-down may require retrying while the server wakes; a paid always-on service is preferable for predictable uploads and background jobs.

Use web and API subdomains under the same registrable domain, for example app.example.org and api.example.org. Set APP_URL, CORS_ORIGINS and EXPO_PUBLIC_API_URL accordingly. The configured transport uses secure SameSite=Lax cookies. Cross-site deployments need an explicitly reviewed SameSite=None and CSRF configuration; do not simply loosen CORS.

## EAS
Configure the Expo project ID and signing credentials, then use:
- pnpm --filter @agri/mobile exec eas build --profile development --platform android
- pnpm --filter @agri/mobile exec eas build --profile development --platform ios

Install eas-cli first or use npx eas-cli@latest from apps/mobile. App-store publication is a separate action. Register universal link domains and host their platform association files when the final domain and signing identities are known.

## Integrations
Create scoped keys in Admin / Integrations. Keys are shown once, stored hashed, have expiry dates and can be revoked. Passport delivery uses a transactional outbox with retries; the receiving endpoint must honour Idempotency-Key. Provide SMTP_URL, S3 credentials and Passport endpoints through environment variables, never source files.
