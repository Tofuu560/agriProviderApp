# Documentation and Postman validation

Date: 12 November 2026 (SAST). Target: local API `http://localhost:4000`, connected to the working Neon development branch. Only the six credential-free GET smoke requests were executed against this target.

| Check | Result |
|---|---|
| Actual Postman smoke request definitions and test scripts | 6 requests / 16 assertions passed using `scripts/check-postman.mjs` with Node and Chai |
| Liveness / database readiness | HTTP 200 / 200 |
| Missing session / missing integration key | HTTP 401 UNAUTHENTICATED / 403 INVALID_KEY |
| Unknown path / unauthenticated provider route | HTTP 404 NOT_FOUND / 401 UNAUTHENTICATED |
| Collection/environment JSON | Parsed; request scripts compiled; variables checked |
| Route reference | 91 unique registered routes, including generated role variants |
| Project tracker PDF | Four pages rendered and visually inspected; no clipping or overlapping tables |
| Project checks | TypeScript and ESLint passed |
| Postman application import / authenticated and mutation cases | Not executed; require disposable fixtures and local credentials |
| Official JSON Schema validation | Not completed: schema host returned HTTP 403 to the local downloader; structural checks are not a substitute for schema validation |

The local smoke runner executes the collection's actual assertion code in a minimal `pm` adapter; it is not the Postman desktop runtime or Newman. It makes no claim about full sandbox compatibility. Run `node scripts/check-postman.mjs http://localhost:4000` to repeat the read-only checks. Detailed output is stored privately under `.data/docs-preview/`.

AU-01 through AU-08 and WF-01 through WF-16 are **not run** in this documentation task. The additional EX scenarios are manual specifications, also not run. Existing application-suite results in `../testing.md` are historical and must not be relabelled as collection runs.
