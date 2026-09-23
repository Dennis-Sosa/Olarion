# Changelog

## Prompt audit-2.0.1

- Give feature specialists an explicit list of allowed columns and separate their scope from preprocessing/split checks.
- Require an empty findings array for clean checks; clarify exact source quotes and reject safe-feature summaries masquerading as findings.
- Preserve all existing evidence, feature-scope and review validation. The first authenticated production smoke run (`evals/personal-model-smoke.json`) exposed degraded proxy/temporal checks and is retained as regression evidence.

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

Known limitation: live model preflight failed authentication in the evaluation environment. No completed live Agent benchmark is claimed. The deployed Vercel API and new UI are verified; production has no model key configured and correctly returns partial coverage. Configure a valid server-side key to enable full AI audits.
