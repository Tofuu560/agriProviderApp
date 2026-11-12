# Validation — five portals and individual learner evidence

Validation date: 12 November 2026. Production accounts are not configured; the user requested local validation first.

## Results

- Expo SDK dependency compatibility: passed.
- Prisma schema validation, generation and additive migrations: passed on development and isolated test databases.
- TypeScript and ESLint: passed.
- API/shared validation: **53 tests passed** across four suites (52 in the full run, plus the expanded 11-test learner-pack suite).
- Web export: passed; 95 assets are precached for offline use.
- Android and iOS Hermes bundle exports: passed. These are not signed binaries or physical-device tests.
- Browser validation: **all 30 desktop/phone scenarios passed across the full run and targeted reruns**. The full run passed 27/30; two upload journeys needed a selector for the active retained tab header, and one offline test disconnected before service-worker installation completed. After correcting those test preconditions and reducing the country-data bundle, all 10 affected/new-feature journeys passed again in both layouts.

## API coverage

The original golden journey covers registration validation/capacity, idempotent attendance, atomic complete grading, independent moderation, certificate signatures, QA verification/unlock, immutable audit records and status-only milestones. New checks reject grading before attendance and evidence upload before assessment.

Onboarding tests cover all five role namespaces; admin/learner self-signup and tenant injection rejection; pending accounts without sessions; reset/invitation/reactivation bypass rejection; approval and rejection; provider accreditation review; empty unassigned-assessor access; MFA-only QR challenges and one-time recovery codes; provider-owned learner provisioning; learner attendance/result privacy; certification release only after QA unlock for passing learners; material isolation and URL validation; and provider programme schedule validation.

## Individual learner and localisation coverage

The learner-pack suite verifies own-learner upload/download isolation, tenant boundaries, append-only file history, idempotent offline retries, per-learner reports, provider -> assessor -> QA handoffs, required evidence, nonblank QA correction requests after unlock, arbitrary certificate file types in testing, malware rejection, both account emails, local email-file delivery, provider-only cohort mutations, country/province/phone validation, encrypted account phone storage, and explicit SAST conversion.

New browser journeys exercise actual file selection/upload twice and provider visibility, country-dependent selects and mismatched-phone errors, native browser date inputs, provider cohort controls, and QA rejection with a short message and no selected file. Offline tests wait for service-worker installation before disconnecting; first-time cache installation requires an online connection.

## Reproduce safely

Run from this repository:

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @agri/api exec prisma validate
pnpm typecheck
pnpm lint
pnpm test
pnpm build:web
pnpm test:web
pnpm --filter @agri/mobile exec expo export --platform android --platform ios --output-dir dist-native
```

API tests require a database name ending in `_test` and default to `agriprovider_test`. They clear its fixtures. Apply migrations to that database before the first API run, setting `DATABASE_URL` and `DIRECT_URL` for that command only.

`pnpm test:web` uses `scripts/test-web.mjs`. It creates/migrates/resets **agriprovider_web_test**, seeds synthetic data, exports to `.data/web-test`, starts API port **4001** and preview **4174**, runs Playwright, then stops its services. `TEST_WEB_DATABASE_URL` may override the database but must end in `_web_test`. Occupied test ports are rejected rather than taking over other services. Do not point tests at working or production data. CI is configured to run this runner with Chromium; local Windows tests use Edge. The updated remote CI workflow has not been run from this chat.

The browser suite covers the original role/offline journeys plus public signup -> pending -> administrator approval -> role landing, learner tabs and redirects away from all staff areas, and MFA QR/recovery screen rendering. MFA server challenge logic is tested against the real API; the dedicated QR UI test mocks challenge responses to avoid creating real privileged accounts. Browser phone viewports are not physical iPhones.

## Local services and data

- Development web: http://localhost:8082
- Exported offline-capable preview: http://localhost:4173
- Working API: http://localhost:4000
- Expo development server: port 8081; use the LAN address printed by `scripts/start-local.ps1`.

Before the initial migration, the working development database was backed up at `.data/backups/before-five-portals.dump`; the learner-pack migration has a separate `.data/backups/before-learner-packs.dump` backup. Existing accounts and provider data were preserved; only missing synthetic learner demo logins were added. The legacy browser tests initially encountered a full working cohort and enabled QA MFA. Tests were moved to their own database. The known attendance changes from that initial run were restored from the backup only after checking that no later changes had intervened; the temporary reviewer was deactivated and the append-only audit trail records the restoration.

## Earlier repairs retained

Stale workspace dependency junctions were archived under ignored `.data/dependency-backup/*/node_modules` so the app resolves the hoisted SDK-compatible packages. Offline sign-out persists across reopened tabs without storing tokens in local storage. Explicit sign-in clears that marker. Browser MFA waits around TOTP expiry boundaries. Mobile tab labels now have explicit accessible names rather than icon glyphs.

## Remaining external acceptance

Physical Android/iPhone journeys, camera permissions, native background sync, push delivery and signed EAS builds remain unverified. Render/Neon provisioning, real storage/mail/integration services, scanning infrastructure and production deployment remain outstanding. Direct signed resumable uploads remain a documented production enhancement. Learner certificates are private QA-verified records; shared signed cohort evidence is not downloadable by learners. See `decisions.md` and `deployment.md` for setup and boundaries.
