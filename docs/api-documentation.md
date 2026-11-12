# AgriProvider API documentation

API version: v1 | 12 November 2026 (SAST) | source baseline `e1144af`

## Connection and authentication

Working local base URL: `http://localhost:4000`. Disposable test API convention: `http://localhost:4001`. Business routes begin `/api/v1`; health and signed-file routes do not. No public hosted API URL is configured. Neon connection strings are database credentials, never browser or Postman API URLs.

Send JSON with `Content-Type: application/json`. Protected routes require `Authorization: Bearer <accessToken>`. Integration routes require an API key with the appropriate scope instead of a user access token. Namespace permissions are exact: provider, assessor, qa, admin and learner correspond to their respective roles; administrator access does not implicitly grant all role namespaces. Cohort ownership/assignment is checked separately. All UUID parameters must be valid UUIDs.

Successful handlers normally return HTTP 200, including creates; there is no universal success envelope. Lists generally return arrays. Errors use `{ "code": "...", "message": "...", "fields": [] }`; validation fields contain `path` and `message`. Common statuses: 400 invalid input, 401 missing/expired session, 403 role/scope/key denial, 404 missing/out-of-scope record, 409 duplicate/workflow conflict, 413 oversized upload, 429 throttling and 500 unexpected failure. `/readyz` may return 503 while the database is unavailable.

### Login and session lifecycle

```json
{"email":"provider@example.org","password":"<private password>","transport":"native"}
```

POST `/api/v1/auth/login` returns `{user, accessToken, refreshToken, expiresAt}` for native transport; web transport omits `refreshToken` and sets the HTTP-only `agri_refresh` cookie. Access expires after 10 minutes; refresh sessions have a seven-day outer limit and configurable inactivity expiry. The default idle limit is 30 minutes.

For existing MFA, include `code` (current authenticator code or unused recovery code). Missing/invalid MFA returns 401 `MFA_REQUIRED`. A new mandatory enrollment returns HTTP 200 with `mfaSetupRequired`, `setupToken` and QR/manual enrollment information, **without accessToken**. Complete it at `/auth/mfa/complete` using `{setupToken, code, transport}`. The challenge lasts 10 minutes and is single-use. Do not save QR secrets, recovery codes or setup tokens to shared collection files.

POST `/auth/refresh` accepts `{refreshToken, transport:"native"}` or the web cookie with `{transport:"web"}`. Replace both returned tokens after rotation; replay of an old refresh token revokes its family. POST `/auth/logout` requires an access token and revokes that session. Web mutation origins must match `CORS_ORIGINS`; native/Postman requests without Origin are supported.

POST `/auth/forgot-password`: `{email}`; response deliberately does not reveal whether an account exists. POST `/auth/token-info`: `{token}` checks an invitation/reset token and returns MFA requirements. POST `/auth/accept-invite` or `/auth/reset-password`: `{token,password,code?,transport?}`. Passwords have 12-128 characters and must not contain qualifying name/email fragments. Admin MFA remains mandatory.

### Account application

POST `/auth/signup` accepts `{fullName,email,password,role,organisation,accreditationNumber?,country?,province?,phone?}`. Public roles: `PROVIDER`, `ASSESSOR`, `QA_OFFICER`. Provider requires accreditation number and province. Country defaults to `ZA`. Returns `{status:"PENDING",message}` without a session. Admin/learner self-signup is invalid. POST `/admin/pending-accounts/:id`: `{approve,reason?,validFrom?,validTo?}`. Reject requires at least 10 characters; provider approval requires valid accreditation dates with future expiry.

## Training request contracts

Dates are UTC ISO 8601 strings ending in `Z`; UI SAST time must be converted first. Example: `2026-11-13T07:00:00.000Z` represents 09:00 SAST. Date examples are illustrative; scheduled lessons must be future dates inside the cohort's dates.

| Route suffix | JSON body / outcome |
|---|---|
| `POST /provider/programmes` | `{programme:{name,level,requiredSessions,attendanceThreshold,assessmentType},cohort:{code,capacity,startDate,endDate,sessionDates}}`; creates programme, cohort, sessions and milestone; returns `{id}` (cohort ID) |
| `POST /provider/cohorts` | `{programmeId,code,capacity,startDate,endDate,sessionDates}`; provider scope comes from login; returns cohort |
| `PATCH /provider/cohorts/:id` | `{capacity?,status?,endDate?}`; status ACTIVE/CLOSED; cannot reduce capacity below enrolment, change it during QA/unlocked review, or shorten dates |
| `POST /provider/cohorts/:id/materials` | `{title,content,url?}`; optional URL must be HTTPS; returns `{id}` |
| `POST /provider/cohorts/:id/sessions` | `{title,startsAt}`; upcoming lesson within cohort dates; schedule locks once assessed/reviewed; returns `{id}` |
| `POST /provider/learners` | `{cohortId,fullName,nationalId,phone,consent:true,clientOpId}`; 13-digit valid SA ID, +27 phone; returns `{id,fullName,maskedId}` |
| `POST /provider/learners/:id/account` | `{email,password,country?,province?,phone?}`; returns `{email,status}` and queues setup/creator emails |
| `POST /provider/attendance` | `{sessionId,records:[{learnerId,status}],markRemainingAbsent?,clientOpId}`; PRESENT/ABSENT/LATE; session must have started |
| `POST /assessor/assessments` | `{cohortId,grades:[{learnerId,outcome}],clientOpId}`; PASS/FAIL for every enrolled learner, no duplicates, attendance required; returns `{ok:true}` and creates individual reports |
| `POST /assessor/moderation/:id` | ID is cohort; `{action,reason?,identitiesMatch?,outcomesRecorded?,signaturesPresent?}`; SIGN_OFF/FLAG/REOPEN; independent assessor required |
| `POST /assessor/slots` | `{cohortId,startsAt,endsAt,type}`; type Evidence review/Final review; no overlapping slots |

`clientOpId` is a client-generated UUID, reused only for the exact same logical operation. Successful retries return the saved result. Changed payload reuse returns `OP_CONFLICT` (409). Do not regenerate IDs on offline retry. Many administrative actions do not accept a client operation ID and should not be blindly retried.

## Individual evidence contracts

GET `/{role}/cohorts/:id/learner-packs` supports learner/provider/assessor/qa. Returns an array containing learnerId, fullName, status, reason, files and (for reviewers) completeness items. Learners only receive their own individually scoped documents. `allowAnyCertificateFile` indicates development/test certificate permissiveness.

POST `/provider/cohorts/:id/learner-packs/:learnerId/files` (also `/learner/...`) uses multipart form data. Add the **metadata field before the file part**:

```json
{"type":"ID_DOCUMENTS","clientOpId":"<uuid>","signed":false}
```

Metadata is a JSON string; the `file` field holds file bytes. Learners may upload `ID_DOCUMENTS`, `CONSENT_FORMS`, `SUPPORTING_DOCUMENT`. Providers may upload the six evidence types except `ASSESSOR_REPORT`, which is server-generated, plus supporting documents. Certificate metadata requires `signed:true` and `signerName`; passing assessment is required. Returns `{id}`. Repeating the same operation is idempotent; a new operation creates a separate file history record. Default limit 10 MB; PDF/JPG/PNG except development/test certificates. Unlocked/frozen milestones reject new files until reopened.

POST `/{role}/cohorts/:id/learner-packs/:learnerId/submit` accepts `{action,reason?}`:

| Role/action | Prerequisite | Result |
|---|---|---|
| Provider / SUBMIT | ID, consent, enrolment and attendance files complete | ASSESSOR_REVIEW |
| Assessor / APPROVE | Submitted pack and complete assessment/evidence | QA_REVIEW |
| QA / APPROVE | QA_REVIEW and complete evidence | VERIFIED |
| Assessor or QA / REQUEST_CHANGES | Nonblank reason | CHANGES_REQUESTED; resets milestone review |

Legacy cohort upload POST `/provider/evidence/:id` uses a **milestone ID** and multipart metadata `{type,learnerIds,sessionIds,signed,signerName?,signedAt?,clientOpId}`. All learners must already have assessment results. Refer to `domain.ts` for coverage checks; prefer individual packs for new UI workflows. POST `/provider/milestones/:id/submit` is the legacy aggregate submission after complete evidence and independent sign-off.

GET `/{role}/evidence/:id/download` returns `{url}` after authorization. Role supports provider/assessor/qa/admin/learner. Admin requires scoped support access. Local signed URLs expire after about 120 seconds and are relative to the API base; do not prepend `/api/v1`. Never expose shared cohort documents to learner clients.

## QA and certification

POST `/qa/milestones/:id/verify`: `{condition:"enrolment"|"attendance"|"certification"}`. Requires READY_FOR_REVIEW and true underlying conditions. Enrolment requires capacity filled and ID/consent/enrolment evidence; attendance requires completed session records and threshold compliance; certification requires reports, signed certificates for passes, verified individual packs when used and independent moderation.

POST `/qa/milestones/:id/unlock`: `{}`. Requires all three conditions VERIFIED, underlying checks still true and no linked follow-up findings. Creates a certification event/outbox delivery; no money moves. POST `/qa/milestones/:id/reject`: `{reason,evidenceIds?}`. Nonblank reason is sufficient, including after unlock. Empty/omitted evidenceIds applies to all pack evidence. Certification visibility is withdrawn when the milestone is no longer unlocked.

POST `/qa/findings/:id`: `{milestoneId,evidenceId,status}` with SELECTED/VERIFIED/FOLLOW-UP; evidence must belong to the finding's provider. POST `/qa/recommend-suspension`: `{providerId,reason}` (10-2000 characters).

## Administrative and account contracts

| Endpoint suffix | Body / notes |
|---|---|
| `POST /admin/users` | `{email,fullName,role,providerId?,cohortIds?,noAssignmentsYet?,country?,province?,phone?}`; provider scope required for PROVIDER; assessor assignment or explicit noAssignmentsYet required |
| `POST /admin/users/:id/:action` | No body needed; deactivate/reactivate/unlock/force-logout/reset-password/resend-invite/revoke-invite/reset-mfa |
| `POST/PATCH /admin/providers[/:id]` | Full `{name,accreditationNumber,validFrom,validTo,province,contact}`; contact email |
| `POST /admin/providers/:id/status` | `{status,reason}`; ACCREDITED/SUSPENDED/REVOKED; revocation final |
| `POST/PATCH /admin/programmes[/:id]` | Full `{name,level,requiredSessions,attendanceThreshold,assessmentType}`; threshold 1-100; sessions 1-365 |
| `POST /admin/assignments` | `{userId,cohortId,active}`; assessor only |
| `POST /admin/settings` | `{inviteHours,idleMinutes,lockoutAttempts,maxFileMb,qaMfa,retentionDays,outboxRetries}`; validated bounds in settingsSchema |
| `POST /admin/approvals/:id` | `{approve}`; different admin must decide; pending approvals expire after 48 hours |
| `GET /admin/audit-log` | Query page (default 1, 50 rows), action?, actorId?; returns `{items,page}`; export endpoint returns CSV up to 10,000 rows |
| `POST /admin/integrations` | `{name,scopes,expiresAt}`; scopes programmes:read/findings:write/certifications:read; returns key once |
| `POST /admin/integrations/:id/revoke` | No body needed; may require second-admin approval |
| `POST /admin/outbox/:id/retry` | No body needed; requeues delivery, so use only intentionally |
| `POST /admin/support-access` | `{entityId,reason}`; learner/evidence entity; access expires after 30 minutes |
| `POST /admin/data-requests` | `{learnerId,type,reason}`; ACCESS/CORRECTION/ANONYMISE |
| `POST /admin/data-requests/:id/process` | No body needed; only anonymisation is automatic, subject to retention/review hold |
| `POST /me/push-token` | `{token}`; Expo push token |
| `POST /me/mfa/setup` | `{password}`; requires authenticated account without enabled MFA |
| `POST /me/mfa/confirm` | `{code}`; returns one-time recovery codes |
| `POST /me/mfa/recovery-codes` | `{password,code}`; replaces prior recovery codes |
| `POST /me/notifications/:id/read` | No body needed; marks only the caller's notification |

Protected administrative actions may return `{pending:true,approvalId}` instead of applying immediately when two or more admins are active. Read the response rather than assuming every HTTP 200 means the change already took effect. Most lists cap results at 100 or 200; the route inventory links to each handler. There is no general cursor pagination contract.

## External integrations

GET `/integrations/programmes` uses `programmes:read`; GET `/integrations/certifications` uses `certifications:read` and returns unlocked events only. POST `/integrations/findings` uses `findings:write` and accepts `{providerId,officerName,region,description,clientOpId}`; description is at least 10 characters. Expired/revoked/wrong-scope keys return 403 `INVALID_KEY`. Integration keys are separate from user sessions.

Rate limits: default 300 requests/minute; login and MFA completion 10/minute; signup 5/minute; forgot-password 4/minute. Wait after 429 rather than retrying immediately. Outbound Passport delivery requires a configured destination and idempotency support; no working external receiver is claimed by this documentation.

## Complete registered route inventory

Generated from route registration without executing handlers. Automatic HEAD/OPTIONS transport routes are omitted. Rebuild with `node node_modules/tsx/dist/cli.mjs scripts/document-routes.mts`, then `python scripts/build-documentation.py` using the documented PDF runtime dependencies.

<!-- ROUTE_INVENTORY -->

| Method | Path | Access | Handler |
|---|---|---|---|
| GET | `/api/v1/admin/approvals` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/approvals/:id` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/assignments` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/assignments` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/audit-log` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/audit-log/export` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/cohorts` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/dashboard` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/data-requests` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/data-requests` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/data-requests/:id/process` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/evidence/:id/download` | admin | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/api/v1/admin/health` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/integrations` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/integrations` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/integrations/:id/revoke` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/outbox/:id/retry` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/pending-accounts` | admin | [onboarding.ts](../apps/api/src/onboarding.ts) |
| POST | `/api/v1/admin/pending-accounts/:id` | admin | [onboarding.ts](../apps/api/src/onboarding.ts) |
| GET | `/api/v1/admin/programmes` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/programmes` | admin | [admin.ts](../apps/api/src/admin.ts) |
| PATCH | `/api/v1/admin/programmes/:id` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/providers` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/providers` | admin | [admin.ts](../apps/api/src/admin.ts) |
| PATCH | `/api/v1/admin/providers/:id` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/providers/:id/status` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/settings` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/settings` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/support-access` | admin | [admin.ts](../apps/api/src/admin.ts) |
| GET | `/api/v1/admin/users` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/users` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/admin/users/:id/:action` | admin | [admin.ts](../apps/api/src/admin.ts) |
| POST | `/api/v1/assessor/assessments` | assessor | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/api/v1/assessor/cohorts` | assessor | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/api/v1/assessor/cohorts/:id` | assessor | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/api/v1/assessor/cohorts/:id/learner-packs` | assessor | [learner-packs.ts](../apps/api/src/learner-packs.ts) |
| POST | `/api/v1/assessor/cohorts/:id/learner-packs/:learnerId/submit` | assessor | [learner-packs.ts](../apps/api/src/learner-packs.ts) |
| GET | `/api/v1/assessor/evidence/:id/download` | assessor | [domain.ts](../apps/api/src/domain.ts) |
| POST | `/api/v1/assessor/moderation/:id` | assessor | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/api/v1/assessor/slots` | assessor | [domain.ts](../apps/api/src/domain.ts) |
| POST | `/api/v1/assessor/slots` | assessor | [domain.ts](../apps/api/src/domain.ts) |
| POST | `/api/v1/auth/accept-invite` | Public | [auth.ts](../apps/api/src/auth.ts) |
| POST | `/api/v1/auth/forgot-password` | Public | [auth.ts](../apps/api/src/auth.ts) |
| POST | `/api/v1/auth/login` | Public | [auth.ts](../apps/api/src/auth.ts) |
| POST | `/api/v1/auth/logout` | Public | [auth.ts](../apps/api/src/auth.ts) |
| POST | `/api/v1/auth/mfa/complete` | Public | [auth.ts](../apps/api/src/auth.ts) |
| POST | `/api/v1/auth/refresh` | Public | [auth.ts](../apps/api/src/auth.ts) |
| POST | `/api/v1/auth/reset-password` | Public | [auth.ts](../apps/api/src/auth.ts) |
| POST | `/api/v1/auth/signup` | Public | [onboarding.ts](../apps/api/src/onboarding.ts) |
| POST | `/api/v1/auth/token-info` | Public | [auth.ts](../apps/api/src/auth.ts) |
| GET | `/api/v1/integrations/certifications` | Scoped API key | [app.ts](../apps/api/src/app.ts) |
| POST | `/api/v1/integrations/findings` | Scoped API key | [app.ts](../apps/api/src/app.ts) |
| GET | `/api/v1/integrations/programmes` | Scoped API key | [app.ts](../apps/api/src/app.ts) |
| GET | `/api/v1/learner/cohorts/:id/learner-packs` | learner | [learner-packs.ts](../apps/api/src/learner-packs.ts) |
| POST | `/api/v1/learner/cohorts/:id/learner-packs/:learnerId/files` | learner | [learner-packs.ts](../apps/api/src/learner-packs.ts) |
| GET | `/api/v1/learner/courses` | learner | [learning.ts](../apps/api/src/learning.ts) |
| GET | `/api/v1/learner/evidence/:id/download` | learner | [learner-packs.ts](../apps/api/src/learner-packs.ts) |
| GET | `/api/v1/me` | Any authenticated user | [auth.ts](../apps/api/src/auth.ts) |
| POST | `/api/v1/me/mfa/confirm` | Any authenticated user | [account.ts](../apps/api/src/account.ts) |
| POST | `/api/v1/me/mfa/recovery-codes` | Any authenticated user | [account.ts](../apps/api/src/account.ts) |
| POST | `/api/v1/me/mfa/setup` | Any authenticated user | [account.ts](../apps/api/src/account.ts) |
| POST | `/api/v1/me/notifications/:id/read` | Any authenticated user | [account.ts](../apps/api/src/account.ts) |
| POST | `/api/v1/me/push-token` | Any authenticated user | [account.ts](../apps/api/src/account.ts) |
| POST | `/api/v1/provider/attendance` | provider | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/api/v1/provider/cohorts` | provider | [domain.ts](../apps/api/src/domain.ts) |
| POST | `/api/v1/provider/cohorts` | provider | [learning.ts](../apps/api/src/learning.ts) |
| GET | `/api/v1/provider/cohorts/:id` | provider | [domain.ts](../apps/api/src/domain.ts) |
| PATCH | `/api/v1/provider/cohorts/:id` | provider | [learning.ts](../apps/api/src/learning.ts) |
| GET | `/api/v1/provider/cohorts/:id/learner-packs` | provider | [learner-packs.ts](../apps/api/src/learner-packs.ts) |
| POST | `/api/v1/provider/cohorts/:id/learner-packs/:learnerId/files` | provider | [learner-packs.ts](../apps/api/src/learner-packs.ts) |
| POST | `/api/v1/provider/cohorts/:id/learner-packs/:learnerId/submit` | provider | [learner-packs.ts](../apps/api/src/learner-packs.ts) |
| POST | `/api/v1/provider/cohorts/:id/materials` | provider | [learning.ts](../apps/api/src/learning.ts) |
| POST | `/api/v1/provider/cohorts/:id/sessions` | provider | [learning.ts](../apps/api/src/learning.ts) |
| POST | `/api/v1/provider/evidence/:id` | provider | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/api/v1/provider/evidence/:id/download` | provider | [domain.ts](../apps/api/src/domain.ts) |
| POST | `/api/v1/provider/learners` | provider | [domain.ts](../apps/api/src/domain.ts) |
| POST | `/api/v1/provider/learners/:id/account` | provider | [learning.ts](../apps/api/src/learning.ts) |
| POST | `/api/v1/provider/milestones/:id/submit` | provider | [domain.ts](../apps/api/src/domain.ts) |
| POST | `/api/v1/provider/programmes` | provider | [learning.ts](../apps/api/src/learning.ts) |
| GET | `/api/v1/qa/audits` | qa | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/api/v1/qa/cohorts/:id` | qa | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/api/v1/qa/cohorts/:id/learner-packs` | qa | [learner-packs.ts](../apps/api/src/learner-packs.ts) |
| POST | `/api/v1/qa/cohorts/:id/learner-packs/:learnerId/submit` | qa | [learner-packs.ts](../apps/api/src/learner-packs.ts) |
| GET | `/api/v1/qa/evidence/:id/download` | qa | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/api/v1/qa/findings` | qa | [domain.ts](../apps/api/src/domain.ts) |
| POST | `/api/v1/qa/findings/:id` | qa | [domain.ts](../apps/api/src/domain.ts) |
| POST | `/api/v1/qa/milestones/:id/:action` | qa | [domain.ts](../apps/api/src/domain.ts) |
| POST | `/api/v1/qa/recommend-suspension` | qa | [domain.ts](../apps/api/src/domain.ts) |
| GET | `/files/:key` | Signed link | [app.ts](../apps/api/src/app.ts) |
| GET | `/healthz` | Public | [app.ts](../apps/api/src/app.ts) |
| GET | `/readyz` | Public | [app.ts](../apps/api/src/app.ts) |
