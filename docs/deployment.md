# Deployment
Do not deploy the synthetic demo seed or development secrets.

## Neon
Use a separate dev branch and main for production. DATABASE_URL uses the pooled -pooler hostname; DIRECT_URL uses the direct hostname. Both need sslmode=require. Migrations use DIRECT_URL. Never point functional tests at production: the test harness requires a database whose name ends in _test.

The local CI workflow uses an ephemeral PostgreSQL service. A separate Neon CI branch should be created and destroyed per run when Neon project/API credentials are supplied. No Neon credentials were supplied in this task.

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
