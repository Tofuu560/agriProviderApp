# Documentation pack

Snapshot: 12 November 2026 (SAST). Active application baseline: `e1144af`, branch `my-new-app`.

| Deliverable | File | Purpose |
|---|---|---|
| Agent instructions | [AGENTS.md](../AGENTS.md) | Rules for future coding agents |
| System documentation | [System](system-documentation.md) | Architecture, roles, workflows, data and operations |
| Project tracker | [PDF](../output/pdf/agriprovider-project-tracker.pdf) / [source](project-tracker.json) | Evidence-based status, owners and remaining acceptance |
| API documentation | [API reference](api-documentation.md) | Authentication, contracts and all registered endpoints |
| Developer API test cases | [Test guide](postman/developer-api-test-cases.md) | Preconditions, assertions, execution and results |
| Postman collection | [Collection](postman/AgriProvider.postman_collection.json) | Importable requests with test scripts |
| Postman environment | [Environment](postman/AgriProvider.local.postman_environment.json) | Blank credentials and disposable-test configuration |
| Deployment | [Runbook](deployment.md) | Neon setup, hosting and rollback |
| Existing validation evidence | [Testing](testing.md) | Prior API/browser/build results and remaining acceptance |

All credentials, account exports and database backups are intentionally excluded from this pack. Test results for the new Postman collection are recorded separately from the existing automated suites.
