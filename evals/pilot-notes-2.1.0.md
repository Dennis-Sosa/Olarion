# Interrupted 2.1.0 evaluation

[Raw evidence](remote-live-results-2.1.0-pilot.json) contains the first six completed cases of the planned 100-case run against commit `6ee46796894729aa48cf749d6f75a09d4587d300`. All six completed; four were classified correctly and two clean cases were misclassified. This interrupted diagnostic run is not an accuracy estimate for the full suite and is excluded from the final 2.1.1 comparison.

The run was stopped to address two observed false-positive mechanisms: case 001 cited an unused import as evidence of executed full-data fitting; case 005 described a fit on `X_train` after the split as full-data fitting. The 2.1.1 change rejects import-only execution evidence and requires explicit usage/boundary/counterevidence observations before producing findings. Review instructions require checking actual input variables and ordering against the entire source.

Retain this file and the raw pilot. Run every frozen case from the beginning with the new version; do not replace individual failures with selected favorable responses. The additional 20 challenge cases were already frozen before either live run.

## 2.1.1 provider-limited run

[Raw evidence](remote-live-results-2.1.1-limited.json) records 10 attempted cases: 9 complete and correctly classified, followed by one incomplete review with `rate_or_quota_limit`. The runner stopped automatically rather than retrying/selecting a favorable replacement. This is a diagnostic subset, not a full accuracy claim.

2.1.2 preserves the semantic changes, lowers output-token reservations, distinguishes rate-limit versus quota-exhausted responses, and permits one bounded rate-limit backoff within the audit deadline. It never retries exhausted quota or authentication errors. The full run starts over with a 12.5-second minimum interval and retains these earlier results separately.
