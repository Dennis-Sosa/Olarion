# Interrupted 2.1.0 evaluation

[Raw evidence](remote-live-results-2.1.0-pilot.json) contains the first six completed cases of the planned 100-case run against commit `6ee46796894729aa48cf749d6f75a09d4587d300`. All six completed; four were classified correctly and two clean cases were misclassified. This interrupted diagnostic run is not an accuracy estimate for the full suite and is excluded from the final 2.1.1 comparison.

The run was stopped to address two observed false-positive mechanisms: case 001 cited an unused import as evidence of executed full-data fitting; case 005 described a fit on `X_train` after the split as full-data fitting. The 2.1.1 change rejects import-only execution evidence and requires explicit usage/boundary/counterevidence observations before producing findings. Review instructions require checking actual input variables and ordering against the entire source.

Retain this file and the raw pilot. Run every frozen case from the beginning with the new version; do not replace individual failures with selected favorable responses. The additional 20 challenge cases were already frozen before either live run.
