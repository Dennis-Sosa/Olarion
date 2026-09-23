# Frozen regression evaluation

Run `npm run eval:rules` from the repository root. For CI use `npm run eval:check` (does not overwrite stored results). Live evaluation is explicit: `npm run eval:live`; it incurs provider usage, validates connectivity first, writes per-case reports and stops after three consecutive degraded audits.

## Data and provenance

`cases.json` is an unchanged 100-case synthetic fixture generated before this refactor. SHA256: `03d86ffdcd73fcadf689dca9a25ec391d2007d81f13700154ca08cb9530af742`. Each pair changes one leakage mechanism. There are 10 domains, 5 families and 50 clean/leaky pairs. The templates were informed by the original rules. Domain names do not make the repeated patterns statistically independent.

`baseline.json` records the original rule module outputs at commit `908ffc384e7c079275a692797d61374bd4431b88`. It excludes missing-metadata and service diagnostics from leakage counts. `rules-results.json` includes current findings, confusion matrices and source/content hashes. The source hash is calculated over sorted server TypeScript implementation files and `src/types.ts`; tests are excluded. The git base is the checkout HEAD at evaluation time, not a claim that uncommitted code already existed in that commit.

## Results (rule layer only)

| Metric | Original | v0.2 |
|---|---:|---:|
| TP / FP / TN / FN | 35 / 10 / 40 / 15 | 40 / 0 / 50 / 10 |
| Accuracy | 75% | 90% |
| Precision | 77.8% | 100% |
| Recall | 70% | 80% |
| False-positive rate | 20% | 0% |

| Family (20 cases each) | Correct after refactor | Remaining issue |
|---|---:|---|
| Temporal | 10/20 | 10 positive cases require interpreting natural-language availability |
| Target proxy | 20/20 | No failure on these templates; not a general guarantee |
| Preprocessing | 20/20 | Limited static patterns only |
| Entity split | 20/20 | Depends on declared uniqueness/repetition, not measured overlap |
| Target aggregation | 20/20 | Limited aggregate patterns only |

The CI gate (`TP >= 40`, `FP <= 5`) catches known regressions. It is not a production acceptance threshold. No fixtures or labels were rewritten to make results pass. This suite is development regression evidence, not an independent holdout or evidence of causal business impact.

## Full Agent status

The personal production run has now attempted all 100 frozen cases with `gpt-4o` and prompt `audit-2.0.1`: **85 complete, 15 degraded**. Of the complete cases, TP/FP/TN/FN = **32/16/33/4** (76.5% accuracy, 66.7% precision, 88.9% recall, 32.7% false-positive rate). There were **65 complete and correct reports out of 100 planned cases**. Only 36/50 positive cases completed versus 49/50 negative cases, so completed-case recall is not overall recall. All training-code stages were skipped because the frozen requests contain no training code.

[Readable report, matched rule comparison and failure analysis](remote-report-2.0.1.md) · [All 100 original responses](remote-live-results-2.0.1.json). The run used commit `41840f3a56add001d8092e489f94c1b7807bd797` throughout; its 100 rows, fixture hash, labels, versions and reported metrics were independently recomputed and verified before publication. No failed case was replaced with a favorable rerun.

`live-results.json` records the historical local preflight failure: **authentication**. Zero of the 100 cases completed in that attempt. Production credentials have since been configured separately; they are not downloaded for remote evaluation. Offline tests exercise mocked valid/malformed model responses, failure handling, review transactions and SSE handling; they are not live model evaluations.

A 200 response or a rules-only partial report must never be counted as successful AI evaluation. Inspect completion coverage separately from completed-case detection metrics. Even after 100 cases complete, add independently authored unseen cases and multiple runs before claiming reliability.

Historical smoke evidence: `production-smoke.json` and `personal-production-smoke.json` recorded the respective deployments before model keys were available. `personal-model-smoke.json` recorded successful authentication but degraded specialist output validation with prompt `audit-2.0.0`.

After explicit specialist scopes and output requirements were added, `personal-model-smoke-2.0.1.json` recorded two complete audits. All applicable checks and review completed; training-code checks were skipped because no training code was supplied. The clean temporal example produced a proxy false positive: the model treated a potentially predictive historical feature as suspicious without establishing a prohibited information path. Exact quote validation alone cannot establish sound reasoning. These smoke checks are excluded from the 100-case run and retained rather than replaced by more favorable reruns.

## Evaluate the deployed API

Verify the deployment's commit in Vercel/GitHub, then run:

```bash
node evals/run-remote.mjs \
  --url https://olarion-zeta.vercel.app \
  --commit TESTED_FULL_COMMIT_SHA \
  --deployment https://vercel.com/WORKSPACE/PROJECT/DEPLOYMENT_ID \
  --output evals/remote-live-UNIQUE_RUN.json
```

This incurs real provider usage through the server and does not read the Vercel secret. Keep the deployment unchanged during the run. The runner checks the frozen fixture hash and model/prompt versions, respects the endpoint cooldown, checkpoints every response and refuses to overwrite earlier evidence. It retries only an HTTP 429 cooldown once, never a model result. Authentication/quota errors or three consecutive degraded audits stop the run. Detection metrics include only complete audits; coverage uses all 100 planned cases as its denominator. Read failed stages and individual findings before interpreting aggregate numbers.
