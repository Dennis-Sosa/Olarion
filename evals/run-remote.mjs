// Evaluate the deployed API without downloading its server-side API key.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  url: { type: "string" }, output: { type: "string" },
  commit: { type: "string" }, deployment: { type: "string" },
} });
if (!values.url || !values.output || !values.commit || !values.deployment) {
  throw new Error("Provide --url, --output, --commit and --deployment. This makes real model calls and incurs provider usage.");
}
const base = new URL(values.url);
if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
  throw new Error("Use an HTTPS deployment URL without credentials, query or fragment.");
}
const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(values.output);
if (fs.existsSync(output)) throw new Error("Refusing to overwrite evaluation evidence; choose a new output path.");
const bytes = fs.readFileSync(path.join(root, "cases.json"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const hash = crypto.createHash("sha256").update(bytes).digest("hex");
if (hash !== manifest.cases_sha256) throw new Error("Frozen case set changed");
const cases = JSON.parse(bytes);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const healthResponse = await fetch(new URL("/api/health", base), { signal: AbortSignal.timeout(20000) });
if (!healthResponse.ok) throw new Error(`Health HTTP ${healthResponse.status}`);
const health = await healthResponse.json();
if (!health.model_configured) throw new Error("Deployment has no model key configured");

function metrics(rows) {
  const tp = rows.filter((r) => r.expected_leakage && r.predicted_leakage).length;
  const fp = rows.filter((r) => !r.expected_leakage && r.predicted_leakage).length;
  const fn = rows.filter((r) => r.expected_leakage && !r.predicted_leakage).length;
  const tn = rows.length - tp - fp - fn;
  return { n: rows.length, tp, fp, tn, fn,
    accuracy: rows.length ? (tp + tn) / rows.length : null,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    false_positive_rate: fp + tn ? fp / (fp + tn) : null,
  };
}
const result = {
  mode: "live_remote", status: "running",
  provenance: {
    url: base.origin, tested_commit: values.commit, deployment_url: values.deployment,
    cases_sha256: hash, executed_at: new Date().toISOString(), health,
  },
  scope: manifest.design,
  protocol: "One sequential request per frozen case; at least 10.1 seconds between starts. One retry only for the app's HTTP 429 cooldown. No model retries or cherry-picked reruns. Detection metrics include only complete audits; degraded audits remain in raw evidence. Stop after three consecutive degraded/error audits or an authentication/quota error. Training-code checks are out of scope where no training code is supplied.",
  total: cases.length, attempted: 0, completed: 0, coverage: 0,
  metrics: null, families: {}, rows: [],
};
function save() {
  const complete = result.rows.filter((r) => r.complete);
  result.attempted = result.rows.length;
  result.completed = complete.length;
  result.coverage = complete.length / cases.length;
  result.metrics = complete.length ? metrics(complete) : null;
  result.families = Object.fromEntries([...new Set(cases.map((c) => c.family))].map((family) => [
    family, metrics(complete.filter((r) => r.family === family)),
  ]));
  fs.writeFileSync(output + ".tmp", JSON.stringify(result, null, 2) + "\n");
  fs.renameSync(output + ".tmp", output);
}
process.once("SIGINT", () => {
  result.status = "interrupted";
  save();
  process.exit(130);
});
save();
let lastStart = 0, failedInRow = 0;
for (const c of cases) {
  await delay(Math.max(0, lastStart + 10100 - Date.now()));
  const row = { case_id: c.id, family: c.family, expected_leakage: c.expected_leakage,
    started_at: new Date().toISOString(), complete: false, predicted_leakage: null };
  const started = Date.now();
  try {
    const request = () => {
      lastStart = Date.now();
      return fetch(new URL("/api/audit", base), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: c.request }), signal: AbortSignal.timeout(65000),
      });
    };
    let response = await request();
    if (response.status === 429) {
      await response.text();
      row.cooldown_retries = 1;
      await delay(11000);
      response = await request();
    }
    row.http_status = response.status;
    if (!response.ok) throw new Error(`http_${response.status}`);
    const body = await response.json();
    if (!body.report?.quality || !Array.isArray(body.report.findings)) throw new Error("invalid_report");
    row.report = body.report;
    const quality = row.report.quality;
    if (quality.model !== health.model || quality.prompt_version !== health.prompt_version) {
      throw new Error("deployment_version_changed");
    }
    row.complete = quality.status === "complete";
    row.predicted_leakage = row.report.findings.some((f) => f.fine_grained_type !== "missing_metadata");
  } catch (error) {
    row.error = error.name === "TimeoutError" ? "request_timeout" : error.message;
  }
  row.duration_ms = Date.now() - started;
  result.rows.push(row);
  failedInRow = row.complete ? 0 : failedInRow + 1;
  const errors = row.report?.quality.stages.filter((s) => s.status === "failed").map((s) => s.error_code) ?? [];
  const credentialError = errors.some((e) => ["authentication", "rate_or_quota_limit", "not_configured"].includes(e));
  if (credentialError) result.status = "stopped_provider_configuration";
  else if (row.error === "deployment_version_changed") result.status = "stopped_deployment_changed";
  else if (failedInRow >= 3) result.status = "stopped_after_repeated_degradation";
  else if (result.rows.length === cases.length) result.status = "finished";
  save();
  console.log(JSON.stringify({ case_id: c.id, complete: row.complete,
    correct: row.complete ? row.predicted_leakage === c.expected_leakage : null,
    errors, error: row.error, attempted: result.attempted, completed: result.completed }));
  if (result.status !== "running") break;
}
result.finished_at = new Date().toISOString();
save();
console.log(JSON.stringify({ status: result.status, attempted: result.attempted,
  completed: result.completed, coverage: result.coverage, metrics: result.metrics }));
