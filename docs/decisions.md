# Decisions and integration boundaries
- The user approved preserving/restructuring the prototype, local services, capacity blocking and a second assessor.
- The active monorepo is under the existing app repository. Original prototype directories and Git history are retained.
- SDK 58 is retained because it was already installed; matching Expo documentation and SDK-compatible installation were used.
- Fastify and StyleSheet were chosen. Prisma 6.19 is pinned to retain the requested schema-level directUrl support; upgrades require migration review.
- Local PostgreSQL replaces Neon only for development. Dev and test databases are separate. Production uses PostgreSQL-compatible Neon URLs.
- Capacity is enforced even though the Figma sample shows registration open at full capacity.
- Demo capacity is six with five learners for a manageable end-to-end journey. Production cohort capacity is configurable.
- Expo Router 58's installed href:null implementation redirects hidden tab routes. Detail routes instead hide their tab button while remaining reachable. Admin uses a sidebar/drawer.
- Evidence completeness is calculated from explicit coverage manifests, signatures and stored domain records. Human assessors/QA must inspect the file contents; the app does not claim OCR or cryptographic signature verification.
- Development scanning checks known test-virus content and file magic. Production calls the configured ClamAV-compatible scanner and fails closed on scanner errors.
- Current evidence transfer is authenticated multipart with durable retry of the file. Downloads use short-lived signed URLs. Transfer resumes by retrying an entire file, not a partially uploaded byte range. Direct signed multipart S3 upload/resume is a remaining production enhancement.
- Local SMTP replacement writes messages to .data/mail. No real email was sent by local tests.
- In-app notifications persist independently of push delivery. Push requires user permission and external Expo credentials.
- Passport is a development integration stub unless PASSPORT_URL/PASSPORT_KEY are configured. Employer and Field Officer endpoints use scoped API keys.
- Local background sync is best-effort; OS scheduling and native push require a device build and physical-device validation.
- Administrative access/correction data requests require a human compliance review; anonymisation is blocked by retention and active review. Support grants are time-limited and read-only.
- Production service provisioning, Neon CI branch credentials, app signing, real device testing and live deployment are external setup steps, not completed merely by a successful local build.

## Five-portal refactor (12 November 2026)
- The latest user specification supersedes the original four-role, invite-only policy: public staff applications now require admin approval, and LEARNER is a fifth role. Existing accounts default to approved on migration; existing invitations were already administrator-authorised.
- React/Expo is retained for the requested React frontend and shared mobile/web codebase; a separate Next.js application would duplicate routing and offline state.
- A learner login is linked to one learner record by a unique foreign key. Each endpoint derives that identity from the session. Learner responses explicitly project only that learner's attendance/results; shared certificate evidence is not downloadable by learners.
- Self-registering providers receive a new pending organisation. They cannot choose an existing tenant. Admin verifies accreditation and dates on approval. Existing organisations can still receive admin-issued invitations.
- Pending requests are blocked in login, refresh, reset, invitation acceptance and generic admin account actions. Approval/rejection is transactional and audited; the database prevents ACTIVE accounts without APPROVED approval status.
- MFA QR PNGs are generated locally by the API. Secrets never go to a remote QR-generation service. Login setup tokens are hashed, expire in ten minutes, and cannot authorise ordinary API requests.
- The original PDF at D:/agri/figma frontend.pdf was unavailable when work resumed; the retained rendered mockup at .data/design/figma.png was inspected for the layout. New learner and approval screens follow its green/white styling; data and account controls extend the static mockups.
- The development database was backed up to .data/backups/before-five-portals.dump before applying the additive migration. Demo seeding adds only missing synthetic learner logins to an existing database.
- Browser tests now provision and reset only an explicit `_web_test` database, export a separate app, and run temporary servers on 4001/4174. CI installs Chromium and invokes the same runner. The initial legacy browser run used the working demo database; its one attendance operation was restored from the pre-migration backup after checking for intervening edits, and its temporary reviewer account was deactivated. The append-only audit trail records the restoration.

## Individual learner evidence and localised forms
- The user's follow-up replaces one-file-per-type cohort uploads with append-only file versions and individual learner packs. Existing cohort evidence remains readable; no uploaded file record is overwritten by a new upload.
- Learner uploads allow ID, consent and supporting documents before assessment. Learner identity and enrolment come from the authenticated account. Providers and assigned assessors have tenant/cohort checks. QA reviews individual packs; the existing independent moderation and milestone rules still govern final certification.
- Reviewers can request changes with any nonblank message, including after unlock. This invalidates milestone verification and hides the current learner certification record. Undelivered certification events are cancelled if the milestone has been reopened; external consumers must reconcile subsequent status. Certification reapproval updates the existing certification reference and emits a fresh event.
- Providers exclusively own cohort mutations; administrator cohort endpoints are read-only. Programme catalogue administration and assessor assignment remain administrative responsibilities.
- Account mail goes to both the new address and the creating staff member. Public applicants receive acknowledgement and decision messages. Local mail capture is active; real SMTP inbox delivery has not been tested or configured.
- Country/state selections use country-state-city data; phone validation uses libphonenumber-js. User contact phones are encrypted before persistence. Dates store UTC instants but forms interpret wall-clock input explicitly as SAST.
- Arbitrary certificate file types are permitted only outside production, as requested for testing. Malware and size checks still apply. No cryptographic certificate-authenticity claim is made.
- A fresh working-database backup was saved at `.data/backups/before-learner-packs.dump` before migration. Working records were not reset.
