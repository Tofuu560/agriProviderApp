# Developer API test cases - Postman

Version 1.0 | 12 November 2026 (SAST)

## Import and execution

Import `AgriProvider.postman_collection.json` and `AgriProvider.local.postman_environment.json` into Postman. Select the environment. The collection has 30 requests with explicit HTTP/response assertions, not merely saved URLs. The API reference documents all 91 routes; this collection is a representative regression suite, not exhaustive endpoint coverage.

1. For read-only checks, set baseUrl to the running API and run **01 Read-only smoke** only. The working app currently uses port 4000. No credentials are required.
2. For all other folders, start an isolated API at `http://localhost:4001` backed by a disposable `_test` database. Apply the existing migrations and synthetic seed there using process-scoped DATABASE_URL/DIRECT_URL overrides; never edit the working API environment to run tests. Use MAIL_MODE=local and test-only storage. Do not reuse the live Frankfurt database. See ../testing.md for the supported isolated runners.
3. Set `allowTestExecution=true` only for that disposable API. The pre-request guard skips other host/port combinations using `pm.execution.skipRequest()`; use a Postman version supporting that API. Skipped cases are not passes. This URL guard does not prove database isolation: verify the server's database configuration first. See [Postman's execution reference](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution/).
4. Enter disposable provider credentials for AU-01. It stores accessToken/refreshToken. Obtain each other role's session using the login contract and set providerToken, assessorToken, qaToken, adminToken, learnerToken and otherLearnerToken locally. AU-01 does not fill role tokens automatically. Admin requires a current authenticator code. Keep secrets local and clear them before exporting.
5. Use IDs from the disposable cohort. The learner token must match learnerId; otherLearnerToken must be a different learner. Configure all evidence/assessment prerequisites listed below before each workflow phase. Choose the same genuine file for WF-08/WF-09.
6. Run cases in their documented phases. WF-01 through WF-10 use an editable or correction fixture; WF-11 through WF-13 require a prepared complete pack and assessor results. This is not a zero-configuration end-to-end seed runner. Refresh/logout cases operate on the AU-01 session.
7. Record actual status, assertion results, tester, SAST time and defect link. Reset only disposable fixtures. Exports may contain tokens or personal data: redact them before committing reports.

## Preconditions and expected results

Each request includes the exact expected status and response assertions. A failing prerequisite is a test setup failure, not proof of an API defect. Authentication must not silently pass on an MFA setup challenge. Keep a separate fixture for correction-after-unlock so it does not invalidate a later approval test.

| ID | Case | Expected HTTP | Error / assertion | Fixture notes |
|---|---|---|---|---|
| SM-01 | API liveness | 200 | See assertions | See folder setup and request assertions. |
| SM-02 | Database readiness | 200 | See assertions | See folder setup and request assertions. |
| SM-03 | Missing session rejected | 401 | UNAUTHENTICATED | See folder setup and request assertions. |
| SM-04 | Missing integration key rejected | 403 | INVALID_KEY | See folder setup and request assertions. |
| SM-05 | Unknown endpoint | 404 | NOT_FOUND | See folder setup and request assertions. |
| SM-06 | Provider namespace needs login | 401 | UNAUTHENTICATED | See folder setup and request assertions. |
| AU-01 | Login disposable user | 200 | See assertions | Use an approved disposable provider without MFA. For MFA users add code; a setup challenge is not a successful session. |
| AU-02 | Current account | 200 | See assertions | See folder setup and request assertions. |
| AU-03 | provider cohorts | 200 | See assertions | See folder setup and request assertions. |
| AU-04 | assessor cohorts | 200 | See assertions | See folder setup and request assertions. |
| AU-05 | Private learner courses | 200 | See assertions | See folder setup and request assertions. |
| AU-06 | Provider cannot administer | 403 | FORBIDDEN | See folder setup and request assertions. |
| AU-07 | QA audit queue | 200 | See assertions | See folder setup and request assertions. |
| AU-08 | Administrator overview | 200 | See assertions | See folder setup and request assertions. |
| WF-01 | Reject admin self-signup | 400 | VALIDATION_ERROR | See folder setup and request assertions. |
| WF-02 | Reject invalid learner identity | 400 | VALIDATION_ERROR | See folder setup and request assertions. |
| WF-03 | Create lesson material | 200 | See assertions | See folder setup and request assertions. |
| WF-04 | Reject unsafe material URL | 400 | VALIDATION_ERROR | See folder setup and request assertions. |
| WF-05 | QA rejects blank correction | 400 | VALIDATION_ERROR | See folder setup and request assertions. |
| WF-06 | QA requests correction | 200 | See assertions | Mutates all evidence review states for the selected milestone. Prepare a disposable unlocked milestone to prove rejection works after unlock. |
| WF-07 | Verify correction persisted | 200 | See assertions | See folder setup and request assertions. |
| WF-08 | Upload learner ID | 200 | See assertions | Choose a genuine PDF/JPG/PNG fixture in the file field. Cohort must be editable and learner enrolled. Metadata precedes file. |
| WF-09 | Replay same upload once | 200 | See assertions | Choose the exact same file bytes as WF-08. Keep uploadOpId unchanged. A new operation ID tests history instead of replay. |
| WF-10 | Other learner cannot download | 404 | NOT_FOUND | otherLearnerToken must belong to a different learner from the uploader. |
| WF-11 | Provider submits individual pack | 200 | See assertions | Before running, provide all four initial documents for this learner; WF-08 alone is insufficient. |
| WF-12 | Assessor forwards complete pack | 200 | See assertions | Requires assigned assessor, submitted state, assessment report and all required evidence including signed certificate for PASS. |
| WF-13 | QA verifies individual pack | 200 | See assertions | See folder setup and request assertions. |
| WF-14 | Refresh session | 200 | See assertions | See folder setup and request assertions. |
| WF-15 | Logout session | 200 | See assertions | See folder setup and request assertions. |
| WF-16 | Logged-out token rejected | 401 | SESSION_EXPIRED | See folder setup and request assertions. |

## Additional manual regression scenarios

These are specified cases, not included executable requests. Record them as not run until executed with controlled fixtures.

| ID | Procedure | Expected result |
|---|---|---|
| EX-01 | Repeat WF-08 with a new operation ID, then list pack files | Both old/new files exist; latest evidence drives completeness |
| EX-02 | Reuse uploadOpId with different file bytes | 409 OP_CONFLICT; no replacement record |
| EX-03 | Upload certificate before PASS, then after PASS with signer | First fails INVALID_CERTIFICATE; second succeeds only with signature and editable scope |
| EX-04 | Upload synthetic certificate type in test versus production | Test permits type; production rejects unsupported content; malware checks remain enforced |
| EX-05 | Provider creates a learner account | New address receives setup message, creator receives confirmation; no password in either |
| EX-06 | Admin attempts provider cohort mutation | Role boundary rejects request; provider can create/close own cohort |
| EX-07 | Submit grades missing a learner, then all grades; moderate as same assessor | Incomplete grading rejected; full batch atomic; self-moderation returns 403 |
| EX-08 | QA unlock before conditions; then after conditions and findings resolved | Blocked first; then certification visible only to passing learners and authorized integration |
| EX-09 | Refresh using a previously rotated refresh token | 401 and token family revoked |
| EX-10 | Submit mismatched country/province/phone and a valid combination | Invalid combination rejected; valid values accepted |
| EX-11 | Retry attendance with same clientOpId/payload, then changed payload | Stable first result; 409 OP_CONFLICT on changed payload |
| EX-12 | Scan MFA QR, complete challenge, reuse challenge or recovery code | Session only after valid verification; replay rejected |

## Evidence and execution status

See [validation-results.md](validation-results.md) for newly executed checks. Historical API/browser results are in [../testing.md](../testing.md); they must not be reported as executions of this new collection. Postman GUI import/full authenticated workflow remains a separate acceptance step unless explicitly recorded as run.
