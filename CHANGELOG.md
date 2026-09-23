# Changelog

## Prompt audit-2.0.1

- Give feature specialists an explicit list of allowed columns and separate their scope from preprocessing/split checks.
- Require an empty findings array for clean checks; clarify exact source quotes and reject safe-feature summaries masquerading as findings.
- Preserve all existing evidence, feature-scope and review validation. The first authenticated production smoke run (`evals/personal-model-smoke.json`) exposed degraded proxy/temporal checks and is retained as regression evidence.
- Redeploy the personal Vercel project with its Production model key. Two subsequent smoke audits completed all applicable checks and review; one clean case had a false positive, retained in `evals/personal-model-smoke-2.0.1.json`.
- Add a sequential remote evaluator that uses the deployed API, preserves per-case evidence and separates completion coverage from detection quality without retrieving server secrets.
- Publish all 100 production evaluation responses: 85 complete, 15 degraded; 65 complete and correctly classified. Retain false positives, false negatives and failed stages, and compare Agent output with rules on the same completed subset. See `evals/remote-report-2.0.1.md`.

## 0.2.0 — Audit quality and feedback

- Use feature scope and declared prediction/entity context to reduce known false positives.
- Replace append-only review with validated keep/update/retract decisions and retained history.
- Record stage coverage, version, timing and explicit degradation; separate model errors from findings.
- Render reports from validated facts; surface SSE errors, cancellation and invalid API inputs.
- Add local per-finding feedback and exportable, unlabelled regression candidates; correct privacy copy.
- Preserve 100 frozen synthetic cases and publish before/after rule results plus live preflight status.
- Upgrade the development toolchain and vulnerable runtime dependencies; pin the patched qs range through an override.
- Replace conflicting legacy Vercel builds/functions configuration with the Vite preset and explicit API routing.
- Use explicit ESM import extensions and compile/load the API under Node in CI to catch runtime-only module failures.
- Extend type-checking to the backend and add offline tests and CI.

Historical release status: local live preflight failed authentication, and the deployments initially had no model key configured, correctly returning partial coverage. The personal production configuration was subsequently completed in the `audit-2.0.1` follow-up above. Earlier smoke results remain historical evidence.
