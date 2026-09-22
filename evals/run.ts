import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { runRules, runAudit } from "../server/orchestrator";
import {
  callOpenAIJson,
  modelErrorCode,
  MODEL,
  PROMPT_VERSION,
} from "../server/openaiClient";
import { RULES_VERSION } from "../server/tools/rules/context";
import type { AuditRequest } from "../src/types";
const root = path.dirname(fileURLToPath(import.meta.url));
const bytes = fs.readFileSync(path.join(root, "cases.json"));
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
);
if (
  crypto.createHash("sha256").update(bytes).digest("hex") !==
  manifest.cases_sha256
)
  throw new Error("Frozen case set changed");
type Case = {
  id: string;
  family: string;
  expected_leakage: boolean;
  request: AuditRequest;
};
const cases: Case[] = JSON.parse(bytes.toString());
const baseline = JSON.parse(
  fs.readFileSync(path.join(root, "baseline.json"), "utf8"),
);
const sourceFiles = ["server", "src/types.ts"]
  .flatMap((p) => {
    const walk = (p: string): string[] =>
      fs.statSync(p).isDirectory()
        ? fs
            .readdirSync(p)
            .sort()
            .flatMap((n) => walk(path.join(p, n)))
        : [p];
    return walk(p);
  })
  .filter((p) => /\.ts$/.test(p) && !p.endsWith(".test.ts"));
const sourceHash = crypto.createHash("sha256");
for (const p of sourceFiles) sourceHash.update(p).update(fs.readFileSync(p));
const provenance = {
  git_base: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  source_sha256: sourceHash.digest("hex"),
  cases_sha256: manifest.cases_sha256,
  model: MODEL,
  prompt_version: PROMPT_VERSION,
  rules_version: RULES_VERSION,
  executed_at: new Date().toISOString(),
};
function metrics(
  rows: Array<{ expected_leakage: boolean; predicted_leakage: boolean }>,
) {
  const tp = rows.filter(
      (r) => r.expected_leakage && r.predicted_leakage,
    ).length,
    fp = rows.filter((r) => !r.expected_leakage && r.predicted_leakage).length;
  const fn = rows.filter(
      (r) => r.expected_leakage && !r.predicted_leakage,
    ).length,
    tn = rows.length - tp - fp - fn;
  return {
    n: rows.length,
    tp,
    fp,
    tn,
    fn,
    accuracy: (tp + tn) / rows.length,
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    false_positive_rate: fp + tn ? fp / (fp + tn) : null,
  };
}
const mode = process.argv.includes("--live") ? "live" : "rules";
const resultPath = path.join(
  root,
  mode === "live" ? "live-results.json" : "rules-results.json",
);
if (mode === "rules") {
  const rows = cases.map((c) => {
    const findings = runRules(c.request),
      leakage = findings.filter(
        (f) => f.fine_grained_type !== "missing_metadata",
      );
    return {
      case_id: c.id,
      family: c.family,
      expected_leakage: c.expected_leakage,
      predicted_leakage: leakage.length > 0,
      findings,
    };
  });
  const result = {
    mode,
    provenance,
    scope: manifest.design,
    baseline: metrics(baseline),
    current: metrics(rows),
    families: Object.fromEntries(
      [...new Set(cases.map((c) => c.family))].map((f) => [
        f,
        metrics(rows.filter((r) => r.family === f)),
      ]),
    ),
    rows,
  };
  if (process.argv.includes("--check")) {
    // CI acceptance thresholds are frozen regression gates, not proof of generalization.
    if (result.current.tp < 40 || result.current.fp > 5)
      throw new Error("Rule regression gate failed");
  } else fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        baseline: result.baseline,
        current: result.current,
        families: result.families,
      },
      null,
      2,
    ),
  );
} else {
  const result: {
    mode: string;
    provenance: typeof provenance;
    status: string;
    preflight?: unknown;
    attempted: number;
    completed: number;
    coverage: number;
    metrics: unknown;
    rows: unknown[];
  } = {
    mode,
    provenance,
    status: "running",
    attempted: 0,
    completed: 0,
    coverage: 0,
    metrics: null,
    rows: [],
  };
  try {
    await callOpenAIJson('Return JSON {"ok":true}.', "Connection check");
  } catch (error) {
    result.status = "blocked";
    result.preflight = { ok: false, error_code: modelErrorCode(error) };
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + "\n");
    console.log(
      JSON.stringify({ status: result.status, preflight: result.preflight }),
    );
    process.exitCode = 2;
  }
  if (result.status !== "blocked") {
    let failedInRow = 0;
    const completed: Array<{
      expected_leakage: boolean;
      predicted_leakage: boolean;
    }> = [];
    for (const c of cases) {
      const report = await runAudit(c.request);
      const full = report.quality?.status === "complete";
      const row = {
        case_id: c.id,
        expected_leakage: c.expected_leakage,
        predicted_leakage: report.findings.some(
          (f) => f.fine_grained_type !== "missing_metadata",
        ),
        report,
      };
      result.rows.push(row);
      result.attempted++;
      if (full) {
        completed.push(row);
        failedInRow = 0;
      } else failedInRow++;
      result.completed = completed.length;
      result.coverage = result.completed / cases.length;
      result.metrics = completed.length ? metrics(completed) : null;
      result.status =
        result.attempted === cases.length
          ? "finished"
          : failedInRow >= 3
            ? "stopped_after_repeated_degradation"
            : "running";
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + "\n");
      console.log(`${c.id}: ${report.quality?.status}`);
      if (failedInRow >= 3) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
