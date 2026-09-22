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

`live-results.json` records an actual preflight failure: **authentication**. Zero of the 100 full Agent cases completed; full Agent accuracy/precision/recall are unavailable. Offline tests exercise mocked valid/malformed model responses, failure handling, review transactions and SSE handling; they are not live model evaluations.

To finish validation, configure a valid server-side `OPENAI_API_KEY`, rerun `npm run eval:live` and inspect completion coverage separately from completed-case detection metrics. A 200 response or a rules-only partial report must never be counted as successful AI evaluation. Even after 100 cases complete, add independently authored unseen cases and multiple runs before claiming reliability.
