# AgriProvider agent instructions

## Scope and source of truth

Work from this repository root. The active application is `apps/mobile`, the API is `apps/api`, and shared validation is `packages/shared`. The `app` and `backend` directories are preserved prototypes; do not implement new features there. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

Read `docs/system-documentation.md`, `docs/api-documentation.md`, `docs/deployment.md` and `docs/testing.md` before changing the relevant subsystem. The route handlers, shared Zod schemas and Prisma migrations are the implementation source of truth. Update documentation when behavior changes.

## Domain invariants

- Enforce authorization on the server: providers own their cohorts, assessors require assignments, and learners see only their own records. Admin cohort access is read-only; providers create, close and reopen cohorts.
- Keep individual learner packs separate through provider, assessor and QA review. Uploads append new evidence records and objects. Never silently overwrite upload history.
- QA correction requests require a nonblank reason and can reopen an unlocked milestone. Certification requires passing results, evidence, independent moderation, verified conditions and resolved findings. Milestones represent status only; never introduce real payments without a new requirement.
- Keep dates as explicit UTC instants in API requests; interpret/display user-facing dates and times in Africa/Johannesburg (SAST). Use calendar controls and country/province/phone validation.
- Preserve immutable audit history, encrypted identity/phone/MFA data, password hashes, token rotation and required administrator MFA. Account creation sends setup information to the new address and confirmation to the creator; never email passwords.

## Database and operations

The working app uses the Neon Frankfurt development branch `my-new-app`; see `docs/deployment.md`. Use pooled runtime connections and direct migration connections. Preserve the existing Prisma stack. Never print or commit environment values, database dumps, file uploads, mail links or secrets under `.data`.

Use additive reviewed migrations; back up before a data migration. Do not run seeds, resets or destructive tests against the working Neon branch or production. API tests use a disposable database ending in `_test`; browser tests use a separate `_web_test` database and ports 4001/4174. Preserve encryption and token keys when copying existing accounts.

Use `scripts/start-local.ps1` and `scripts/stop-local.ps1` for managed Windows services. Do not kill unrelated processes or take over occupied ports. External production deployment, email delivery, signed phone builds and physical-device acceptance are distinct from local validation.

## Required verification and handoff

Run `pnpm typecheck` and `pnpm lint`. Run focused API/browser tests for changed behavior using isolated fixtures. For documentation changes, validate route coverage, JSON imports and PDF rendering instead of replaying destructive workflow tests. Record exactly what ran; distinguish historical results from new checks. Use `node_modules/tsx/dist/cli.mjs scripts/document-routes.mts` with Node to refresh the route inventory without executing handlers.

Keep generated Postman environments free of credentials. Run mutations only against disposable test fixtures. Keep source and generated project-tracker PDF consistent. Summarize changed behavior, validation and remaining deployment work in the handoff. Do not claim production readiness from static or browser-viewport tests.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
