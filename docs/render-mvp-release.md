# Render and Android MVP release

Prepared 13 November 2026. These changes are intentionally uncommitted at the user's request.

## Build profiles

Expo project: `@agriprovider/agriprovider`, ID `57112ea8-3606-4522-be74-9b809d0744d4`.

- `development`: Android APK with `expo-dev-client`; connects to Metro for development. This is not the standalone public MVP.
- `mvp1`: inherits preview, produces a standalone APK using the preview Expo environment.
- `production`: store build profile; separate from public APK distribution.

Run from `apps/mobile`:

```powershell
eas build --platform android --profile development
eas build --platform android --profile mvp1
```

Before MVP builds, set `EXPO_PUBLIC_API_URL` in the Expo preview environment to the verified public HTTPS backend origin, without `/api/v1`. The build hook rejects missing/local release endpoints. This value is embedded in the app and must never contain database credentials or API secrets. Changes to the endpoint require a new build. EAS can package current local files without a Git commit (`cli.requireCommit=false`). `.easignore` excludes secrets, backups and prototype folders.

## Render deployment configuration

`render.yaml` prepares a Frankfurt Docker API, worker, hourly housekeeping job and static web site. The Docker runtime includes Node, pnpm and ClamAV. API startup downloads virus definitions before accepting requests; download failure stops startup. Scanner memory requirements must be considered when selecting a paid plan. No paid resources have been provisioned by this preparation.

Secrets are requested on the API service, not inside an environment group. Worker/housekeeping reference the API's environment values. Automatic deploys are disabled. `/readyz` validates the database connection. The image build must be tested on Render or a Docker-capable host; Docker is not installed in the current workspace.

With Git-based Render deployment, local uncommitted changes are not visible to Render. Keep them local until the user authorizes publishing them, or build/push a container image to an authorized registry and deploy that image. Image deployment requires a Docker builder and registry access; neither is configured here. Never claim that deploying the previous Git commit includes these changes.

## Remaining email and storage setup

| Requirement | Configuration and acceptance |
|---|---|
| Render access | Connect the Render integration and select the workspace; inspect plans before creating billable resources |
| Neon production | Use the Frankfurt production branch's pooled DATABASE_URL and direct DIRECT_URL; do not expose the working test/demo data publicly |
| Secrets | Generate private ENCRYPTION_KEY (64 hex characters) and TOKEN_KEY (at least 32 characters); preserve matching keys if approved existing data is migrated |
| Private bucket | Create private S3-compatible storage; set S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY and S3_SECRET_KEY; verify upload and signed downloads |
| SMTP | Configure SMTP_URL and a verified MAIL_FROM sender; verify both recipient setup mail and creator confirmation, plus password resets |
| Public origins | Set HTTPS APP_URL, exact CORS_ORIGINS and EXPO_PUBLIC_API_URL. Use same-site custom web/API subdomains for the current web refresh-cookie policy |
| Scanning | Confirm freshclam can download definitions and clamscan rejects the EICAR fixture; failed scanning must block uploads |
| Admin | Bootstrap a private administrator on the production database; set up MFA; never publish the synthetic seed credentials |
| Optional integration | Add PASSPORT_URL/PASSPORT_KEY to API and worker only when an authorized receiver is ready |

After deployment, check `/healthz` and `/readyz`, account login/MFA, upload/download, email and the individual learner review journey. Then build the standalone MVP APK with the deployed API URL, install it on an Android phone, and share its Expo build download link. Enable unauthenticated download access in Expo only for the intended public MVP artifact; do not publish keystores or credentials.

## Validation record

- Render YAML passed the official `https://render.com/schema/render.yaml.json` schema locally.
- Expo SDK compatibility, TypeScript and ESLint passed after installing `expo-dev-client` and patch updates (`expo` 58.0.25, `expo-sqlite` 58.0.17).
- API readiness, web development, Metro status and exported preview all returned HTTP 200 after restarting the local services.
- The release-endpoint guard passed checks for missing, local HTTP, development and public HTTPS configuration.
- Expo archive inspection found no `.env`, database dump or keystore files.
- The first updated cloud attempt failed before compilation because a legacy npm lockfile selected npm. Build uploads now exclude legacy lockfiles and pin pnpm 11.25.0; the original local lockfile is preserved.
- Docker image execution and actual Render service health remain unverified until a builder and connected Render workspace are available.

References: [Render Blueprint specification](https://render.com/docs/blueprint-spec), [prebuilt image deployment](https://render.com/docs/deploying-an-image), [Expo APK builds](https://docs.expo.dev/build-reference/apk/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [build upload exclusions](https://docs.expo.dev/build-reference/easignore/).
