# Documentation pack

Snapshot: 13 November 2026 (SAST). Active application baseline: `e1144af`.

| Deliverable | File | Purpose |
|---|---|---|
| Agent instructions | [Agents.md](../Agents.md) / [AGENTS.md](../AGENTS.md) | Coding agent guidelines, invariants, Expo 58 rules & security |
| System documentation | [System documentation](system-documentation.md) | System architecture, 5-role portals, workflows, ERD, data & operations |
| UI/UX Design System | [Figma UI/UX Design](figma-ui-ux-design.md) | Design tokens, color palette, wireframes, role screens & guidelines |
| Interactive UI Prototype | [Figma Prototype (HTML)](figma-prototype.html) | Interactive mobile device prototype viewer for all 5 role portals |
| Project tracker (PDF) | [Tracker PDF](../output/pdf/agriprovider-project-tracker.pdf) / [Source JSON](project-tracker.json) | Evidence-based workstream status, owners, acceptance criteria |
| API documentation | [API reference](api-documentation.md) | Complete endpoint catalog, authentication mechanisms & data contracts |
| Developer API test cases | [Test guide](postman/developer-api-test-cases.md) | Step-by-step test cases, assertions, preconditions & execution flows |
| Postman collection | [Collection](postman/AgriProvider.postman_collection.json) | Importable Postman v2.1 collection covering full golden journey |
| Postman environment | [Environment](postman/AgriProvider.local.postman_environment.json) | Local & hosted environment configuration for Postman |
| Deployment guide | [Runbook](deployment.md) | Neon PostgreSQL Frankfurt setup, Render Blueprints & rollback procedures |
| Render MVP Release | [Release notes](render-mvp-release.md) | Render Docker deployment, standalone APK build & mobile validation |
| Test validation evidence | [Testing](testing.md) | Automated API and browser test suites, build outputs & audit records |

All credentials, account exports and database backups are intentionally excluded from this pack. Test results for the Postman collection are recorded separately from the automated suites.
