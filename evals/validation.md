# Release validation — 2026-09-22

- `npm test`: 56 tests passed across 5 files, including input validation, feature-scope boundaries, model schema/evidence rejection, review transactions, cancellation, SSE errors and local feedback storage.
- `npm run test:runtime`: compiled native Node ESM API imported successfully and `/api/health` returned the expected version. This catches missing import extensions that a bundler-only type-check does not.
- `npm run build`: passed TypeScript checking for frontend/backend and Vite production bundling. The existing main bundle still exceeds Vite’s 500 kB warning threshold; this is a performance follow-up, not a failed build.
- `npm run eval:rules`: all 100 frozen cases executed; 90 correct, 40 TP / 0 FP / 50 TN / 10 FN. See raw findings in `rules-results.json`.
- `npm audit`: 0 known vulnerabilities in the resolved lockfile at validation time. See `dependency-audit.json`; this is not a guarantee against undisclosed vulnerabilities.
- `npm run eval:live`: preflight failed authentication; 0 full Agent cases completed. No model quality claim is made.
- Local browser checks: setup quick-fill and context form, run a synthetic example with provider credentials disabled, visible partial coverage with per-stage failures, per-finding feedback save, feedback retained after refresh. Refresh uses the completed report and does not start another audit.

Offline model-dependent tests use mocked responses. They validate software behavior, not model reasoning quality. Browser validation used local synthetic demo data only.
