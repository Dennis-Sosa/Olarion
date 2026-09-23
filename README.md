# Olarion — AI-assisted ML leakage auditor

Olarion helps practitioners review whether an ML pipeline uses information unavailable at prediction time or contaminates evaluation splits. It combines deterministic rules, focused LLM checks, evidence validation and a review pass that can retract findings.

Originally built for EmpireHacks 2026, Track 2: The Auditor. Original teammates: Youzhu Jin, Dennis Wang, Michael Meng, Weicong Hong. This repository preserves the original history and adds the v0.2 quality and feedback refactor.

[Live app](https://olarion-zeta.vercel.app/) · [Personal repository](https://github.com/Dennis-Sosa/Olarion) · [部署指南](docs/deployment.md) · [产品说明与能力边界](docs/product.md) · [Evaluation](evals/README.md) · [Release notes](CHANGELOG.md)

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

These are **source-informed synthetic regression results**, not real-world accuracy. The remaining 10 misses are temporal cases expressed in natural language. No live Agent accuracy is claimed: the current environment's model connection failed authentication during preflight. See [raw results and methodology](evals/README.md).

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

The existing Vercel entry point is `api/index.ts`; `vercel.json` builds the frontend and routes API requests. Set `OPENAI_API_KEY` in Vercel's environment settings and redeploy. Never put secrets in `VITE_*` variables. Confirm `/api/health` identifies `audit-2.0.0`, then run both a clean and leaky example and inspect coverage.

This personal repository is published under **Dennis-Sosa/Olarion** and deployed at **[olarion-zeta.vercel.app](https://olarion-zeta.vercel.app/)** in the `sosadennis39-debugs-projects` Vercel workspace. The project imports this repository's `main` branch. See the [deployment guide](docs/deployment.md).

Initial personal-deployment verification passed for the setup page, health endpoint and two synthetic audit requests. **At this check, the new project had no `OPENAI_API_KEY`: AI stages correctly reported incomplete coverage.** Add a valid key to this project's Production environment and redeploy before evaluating model quality. [Personal deployment evidence](evals/personal-production-smoke.json) records the tested commit and raw API results.

The [production smoke evidence](evals/production-smoke.json) records two historical synthetic API checks against the original team's deployment at `olarion.vercel.app`, where the model key was absent at the time of testing. It is not a deployment of this personal repository or a model-performance result. Local live preflight separately failed authentication; a valid key and a new live evaluation are still required.

## Demo data

The original synthetic demo bundles remain under [`test dataset/`](test%20dataset/). Use their task and target text with the corresponding ZIP. Labels in demos describe intended examples; they are not independent evidence of model performance.
