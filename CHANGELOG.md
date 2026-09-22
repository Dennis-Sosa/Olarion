# Changelog

## 0.2.0 — Audit quality and feedback

- Use feature scope and declared prediction/entity context to reduce known false positives.
- Replace append-only review with validated keep/update/retract decisions and retained history.
- Record stage coverage, version, timing and explicit degradation; separate model errors from findings.
- Render reports from validated facts; surface SSE errors, cancellation and invalid API inputs.
- Add local per-finding feedback and exportable, unlabelled regression candidates; correct privacy copy.
- Preserve 100 frozen synthetic cases and publish before/after rule results plus live preflight status.
- Upgrade the development toolchain and vulnerable runtime dependencies; pin the patched qs range through an override.
- Replace conflicting legacy Vercel builds/functions configuration with the Vite preset and explicit API routing.
- Extend type-checking to the backend and add offline tests and CI.

Known limitation: live model preflight failed authentication in the evaluation environment. No completed live Agent benchmark is claimed. The live Vercel environment requires separate verification after GitHub publication.
