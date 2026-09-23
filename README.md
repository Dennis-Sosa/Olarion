# Olarion — AI-assisted ML leakage auditor

Olarion helps practitioners review whether an ML pipeline uses information unavailable at prediction time or contaminates evaluation splits. It combines deterministic rules, focused LLM checks, evidence validation and a review pass that can retract findings.

Originally built for EmpireHacks 2026, Track 2: The Auditor. Original teammates: Youzhu Jin, Dennis Wang, Michael Meng, Weicong Hong. This repository preserves the original history and adds the v0.2 quality and feedback refactor.

[Live app](https://olarion-zeta.vercel.app/) · [Personal repository](https://github.com/Dennis-Sosa/Olarion) · [部署指南](docs/deployment.md) · [产品说明与能力边界](docs/product.md) · [Evaluation](evals/README.md) · [Release notes](CHANGELOG.md)

**Preparing an audit:** read the [upload guide](https://olarion-zeta.vercel.app/guide) or [中文上传指南](https://olarion-zeta.vercel.app/guide?lang=zh). The site explains file requirements, useful prediction context, current evaluation results and remaining model-quality work. Downloadable task examples are included.

> This is a code/context audit prototype. It does not execute submitted Python, inspect CSV rows, measure feature correlations, retrain models or quantify business impact. Check the coverage banner on every report. A partial audit is not a clean bill of health.

## What changed in v0.2

- **Feature scope:** distinguishes explicit model inputs from unused raw columns. Optional prediction boundary, feature availability and entity context help resolve ambiguity.
- **Evidence-based review:** each initial finding receives a keep/update/retract decision. Source quotes must exist in the supplied input; retracted findings remain in the report for traceability.
- **Honest failure handling:** missing credentials, model errors, timeouts and malformed outputs produce degraded coverage. Service failures are not counted as leakage findings. Narrative text is rendered from validated findings.
- **Feedback workflow:** record a decision and evidence for each finding locally, then export a regression candidate with the input, report and versions. Human approval of labels is required before adding candidates to tests; no automatic training occurs.
- **Reproducible evaluation:** 100 frozen synthetic paired cases, source hashes, previous rule baseline, current results, adversarial boundary tests, API/SSE failure tests and CI.

## Evaluation snapshot

| Rule-only metric | Original baseline | v0.2 |
|---|---:|---:|
| Case accuracy | 75/100 (75%) | 90/100 (90%) |
| Precision | 35/45 (77.8%) | 40/40 (100%) |
| Recall | 35/50 (70%) | 40/50 (80%) |
| False-positive rate | 10/50 (20%) | 0/50 (0%) |

These are **source-informed synthetic regression results**, not real-world accuracy. The remaining 10 rule-layer misses are temporal cases expressed in natural language.

**Latest Agent run (`audit-2.1.2`):** on the same frozen 100 cases, 98 audits completed, 95 were complete and correctly classified, and 2 were incomplete due to provider rate limits. Complete-case TP/FP/TN/FN = **49/3/46/0** (95/98 = **96.9%** accuracy). On the 84 cases completed by both versions, false positives fell from 16 to 3 and false negatives from 4 to 0. A separate 20-case synthetic challenge set completed 20/20, with **18 correct and 2 false negatives** (manual median imputation and test-set threshold selection); it includes 6 training-code audits. These are development evaluations, not independent blind tests or real-world accuracy guarantees. See the [full version comparison, remaining failures and raw evidence](evals/remote-report-2.1.2.md).

**Live Agent run (`audit-2.0.1`):** all 100 cases were requested from the personal production deployment; 85 returned complete audits and 15 were degraded. Among the 85 complete audits, accuracy was 65/85 (76.5%), precision 32/48 (66.7%), recall 32/36 (88.9%) and false-positive rate 16/49 (32.7%). Thus 65 of all 100 cases were both complete and correctly classified. Failed audits were excluded from detection metrics, not treated as true negatives; the completed subset has selection bias. In the same subset, adding Agent checks/review improved recall but reduced precision and accuracy versus rules alone. See the [full report and failure analysis](evals/remote-report-2.0.1.md) and [raw results and methodology](evals/README.md).

## Run locally

Requires Node.js 22 and npm.

```bash
git clone https://github.com/Dennis-Sosa/Olarion.git
cd Olarion
npm ci
cp .env.example .env
# Set OPENAI_API_KEY in .env; never commit it.
npm run dev:full
```

Open `http://localhost:5173/setup`. Use a Quick Fill example or provide a CSV, prediction goal, target column and preprocessing code. Inspect the selected code before running. Training code and structured context are optional. Without a valid key, rule checks still run and the result is visibly partial.

CSV headers are checked on upload (UTF-8, nonempty and unique names, at most 300 columns and a 64 KB header). A header-only file is sufficient for static review. ZIP uploads support exactly one CSV and 1–10 Python files, at most 10 MB compressed. For multiple scripts, explicitly choose preprocessing and optional training roles, then review/edit the code. Other scripts are not automatically audited. Each code input is limited to 60,000 characters and is never silently truncated. Feature lists accept CSV names and derived fields recognized from Python column assignments or assign() calls; describe their sources in the code/task. Recognition is lexical, not full data-flow analysis. Leave the list blank when it cannot represent the full input set.

`OPENAI_MODEL` defaults to `gpt-4o`. A replacement must support Chat Completions JSON mode and the configured sampling parameters. Model compatibility and quality must be retested before changing the default.

```bash
npm test                 # Offline tests; no provider calls
npm run test:runtime     # Compile and load the API under native Node ESM
npm run build            # Type-check frontend AND backend; build frontend
npm run eval:rules       # Run frozen 100-case regression; write raw results
npm run eval:check       # CI regression gate; does not overwrite evidence
npm run eval:live        # Actual model calls; requires a valid key and incurs API usage
```

## Data flow and API

The browser reads CSV headers. Headers, submitted code and declared context go to the Express API and OpenAI. CSV rows are not submitted. Follow-up questions include the report and a bounded chat history. Audit history and feedback are stored in browser local storage (up to 12 reports); clear them in Past Audits. The application has no server database. Hosting/provider logs and retention are governed by the deployment and provider settings.

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Version and configuration presence; **not** a live model health check |
| `POST /api/audit` | Full structured report; inspect `quality.status` |
| `POST /api/audit-stream` | SSE progress, complete report or explicit error |
| `POST /api/chat` | Questions about a report |
| `POST /api/classify-code` | Suggest roles for uploaded Python files; uncertain results return an error |

Input: `{ "request": { "prediction_goal": "…", "target_column": "y", "csv_columns": ["a", "y"], "preprocessing_code": "…", "context": { "prediction_time": "At signup", "used_features": ["a"], "entity_repetition": "unique", "feature_availability": { "a": "before" } } }`.

Model requests have a 15-second timeout and no implicit retries; the audit deadline is 48 seconds. A per-process 10-second cooldown limits repeated endpoint requests. This is not a distributed production quota or authentication system. See [deployment notes and remaining work](docs/product.md).

## Deploy

The existing Vercel entry point is `api/index.ts`; `vercel.json` builds the frontend and routes API requests. Set `OPENAI_API_KEY` in Vercel's environment settings and redeploy. Never put secrets in `VITE_*` variables. Confirm `/api/health` identifies `audit-2.1.2`, then run both a clean and leaky example and inspect coverage.

This personal repository is published under **Dennis-Sosa/Olarion** and deployed at **[olarion-zeta.vercel.app](https://olarion-zeta.vercel.app/)** in the `sosadennis39-debugs-projects` Vercel workspace. The project imports this repository's `main` branch. See the [deployment guide](docs/deployment.md).

The personal deployment now has its Production model key configured and has been redeployed. [Authenticated smoke evidence](evals/personal-model-smoke-2.0.1.json) records two complete model-assisted audits at commit `41840f3`. Their training-code stage was skipped because those inputs contain no training code; all applicable checks and review completed. This is a connectivity/coverage check, not an accuracy benchmark.

Historical evidence is preserved: [initial personal deployment](evals/personal-production-smoke.json) had no key; [first authenticated smoke](evals/personal-model-smoke.json) exposed invalid specialist outputs; [original team deployment](evals/production-smoke.json) had no key when tested. The local credential preflight also failed authentication. These earlier outcomes do not describe the current personal deployment and are not included in detection metrics.

## Demo data

The original synthetic demo bundles remain under [`test dataset/`](test%20dataset/). Use their task and target text with the corresponding ZIP. Labels in demos describe intended examples; they are not independent evidence of model performance.
