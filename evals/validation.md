# Release validation — 2026-09-22

- `npm test`: 56 tests passed across 5 files, including input validation, feature-scope boundaries, model schema/evidence rejection, review transactions, cancellation, SSE errors and local feedback storage.
- `npm run test:runtime`: compiled native Node ESM API imported successfully and `/api/health` returned the expected version. This catches missing import extensions that a bundler-only type-check does not.
- `npm run build`: passed TypeScript checking for frontend/backend and Vite production bundling. The existing main bundle still exceeds Vite’s 500 kB warning threshold; this is a performance follow-up, not a failed build.
- `npm run eval:rules`: all 100 frozen cases executed; 90 correct, 40 TP / 0 FP / 50 TN / 10 FN. See raw findings in `rules-results.json`.
- `npm audit`: 0 known vulnerabilities in the resolved lockfile at validation time. See `dependency-audit.json`; this is not a guarantee against undisclosed vulnerabilities.
- `npm run eval:live`: preflight failed authentication; 0 full Agent cases completed. No model quality claim is made.
- Local browser checks: setup quick-fill and context form, run a synthetic example with provider credentials disabled, visible partial coverage with per-stage failures, per-finding feedback save, feedback retained after refresh. Refresh uses the completed report and does not start another audit.

Offline model-dependent tests use mocked responses. They validate software behavior, not model reasoning quality. Browser validation used local synthetic demo data only.

Production validation at code commit `0c441a13b0a60bbb0e2831aba11dddec832168a8`: GitHub CI and both Vercel deployments succeeded. `https://olarion.vercel.app/api/health` returned HTTP 200 with `audit-2.0.0` and `model_configured=false`. Two synthetic API smoke cases returned HTTP 200: the empty rule result was explicitly inconclusive; the preprocessing leak retained its rule finding with degraded coverage. See `production-smoke.json`. The new setup page and context controls were also verified in the browser. This proves deployment and failure presentation, not live model quality.
