import type {
  AuditRequest,
  AuditReport,
  AuditFinding,
  AuditStage,
} from "../src/types.js";
import { metadataCheck } from "./tools/rules/metadataCheck.js";
import { pipelineScan } from "./tools/rules/pipelineScan.js";
import { structuralCheck } from "./tools/rules/structuralCheck.js";
import { RULES_VERSION, missingContext } from "./tools/rules/context.js";
import { detectProxyLeakage } from "./tools/llm/proxyDetector.js";
import { detectTemporalLeakage } from "./tools/llm/temporalDetector.js";
import { auditPreprocessingCode } from "./tools/llm/codeAuditor.js";
import { auditModelTrainingCode } from "./tools/llm/modelCodeAuditor.js";
import { reviewAgent } from "./tools/llm/reviewAgent.js";
import { renderNarrative } from "./tools/llm/reportGenerator.js";
import { MODEL, PROMPT_VERSION, modelErrorCode } from "./openaiClient.js";
import { dedupeFindings, computeOverallRisk } from "./utils.js";
export interface ProgressEvent {
  type: "step";
  id: string;
  status: "running" | "done" | "skipped" | "failed";
  title: string;
  detail?: string;
}
export function runRules(request: AuditRequest): AuditFinding[] {
  return dedupeFindings([
    ...metadataCheck(request),
    ...pipelineScan(request),
    ...structuralCheck(request, null),
  ]);
}
export async function runAudit(
  request: AuditRequest,
  progress: (e: ProgressEvent) => void = () => {},
  externalSignal?: AbortSignal,
): Promise<AuditReport> {
  const started = Date.now(),
    stages: AuditStage[] = [];
  const controller = new AbortController(),
    abort = () => controller.abort();
  const timeout = setTimeout(abort, 48_000);
  externalSignal?.addEventListener("abort", abort, { once: true });
  if (externalSignal?.aborted) abort();
  const signal = controller.signal;
  async function stage<T>(
    id: string,
    title: string,
    task: (repair?: string) => Promise<T>,
  ): Promise<T | null> {
    const at = Date.now();
    progress({ type: "step", id, title, status: "running" });
    let attempts = 0;
    const recovered_errors: string[] = [];
    try {
      let result: T;
      for (;;) {
        signal.throwIfAborted();
        attempts++;
        try {
          result = await task(recovered_errors.at(-1));
          break;
        } catch (error) {
          const code = modelErrorCode(error);
          const repairable =
            /^(invalid_|incomplete_|unknown_feature|unused_or_unknown_feature|retraction_|stateful_transform_|stateless_retraction_)/.test(
              code,
            ) || code === "provider_unavailable";
          if (
            !repairable ||
            attempts >= 2 ||
            signal.aborted ||
            Date.now() - started > 30_000
          )
            throw error;
          recovered_errors.push(code);
          progress({
            type: "step",
            id,
            title,
            status: "running",
            detail: `Repairing invalid result (${code}); one bounded retry`,
          });
        }
      }
      stages.push({
        id,
        status: "done",
        duration_ms: Date.now() - at,
        attempts,
        ...(recovered_errors.length ? { recovered_errors } : {}),
      });
      progress({
        type: "step",
        id,
        title,
        status: "done",
        detail: "Validated result received",
      });
      return result;
    } catch (error) {
      const error_code = modelErrorCode(error);
      stages.push({
        id,
        status: "failed",
        duration_ms: Date.now() - at,
        error_code,
        attempts,
        ...(recovered_errors.length ? { recovered_errors } : {}),
      });
      progress({
        type: "step",
        id,
        title,
        status: "failed",
        detail: `Unavailable (${error_code}); coverage incomplete`,
      });
      return null;
    }
  }
  try {
    let findings =
      (await stage("rules", "Checking schema and pipeline rules", async () =>
        runRules(request),
      )) ?? [];
    const tasks = [
      stage("proxy", "Checking target proxies", (repair) =>
        detectProxyLeakage(request, signal, repair),
      ),
      stage("temporal", "Checking feature availability", (repair) =>
        detectTemporalLeakage(request, signal, repair),
      ),
      stage(
        "code",
        "Auditing preprocessing",
        async (repair) =>
          (await auditPreprocessingCode(request, signal, repair)).findings,
      ),
    ];
    if (request.model_training_code?.trim())
      tasks.push(
        stage("model", "Auditing model training", (repair) =>
          auditModelTrainingCode(request, signal, repair),
        ),
      );
    else {
      stages.push({ id: "model", status: "skipped", duration_ms: 0 });
      progress({
        type: "step",
        id: "model",
        title: "Training code not supplied",
        status: "skipped",
      });
    }
    for (const result of await Promise.all(tasks))
      if (result) findings.push(...result);
    findings = dedupeFindings(findings);
    const review = await stage(
      "review",
      "Reviewing and challenging findings",
      (repair) => reviewAgent(request, findings, signal, repair),
    );
    if (review) findings = review.findings;
    const degraded = stages.some((s) => s.status === "failed");
    const leakage = findings.filter(
      (f) => f.fine_grained_type !== "missing_metadata",
    );
    const missing = missingContext(request);
    const report: AuditReport = {
      overall_risk: computeOverallRisk(leakage),
      summary: `${degraded ? "Partial audit" : "Audit checks completed"}: ${leakage.length} active concern(s); ${review?.retracted.length ?? 0} retracted after review. ${degraded ? "Some checks failed; safety cannot be established." : "Results require verification against actual data and deployment context."}`,
      executive_summary: "",
      narrative_report: "",
      findings,
      missing_metadata: missing,
      clarifying_questions: missing,
      bucket_summary: {
        "Time leakage": 0,
        "Feature / proxy leakage": 0,
        "Structure / pipeline leakage": 0,
      },
      review_decisions: review?.decisions ?? [],
      retracted_findings: review?.retracted ?? [],
      agent_trace: (review?.decisions ?? []).map((d) => ({
        round: 1,
        tool_called: "review_finding",
        arguments: { finding_id: d.finding_id, action: d.action },
        result_summary: d.reason,
      })),
      quality: {
        status: degraded ? "degraded" : "complete",
        assessment: leakage.length
          ? "risk_detected"
          : degraded
            ? "inconclusive"
            : "no_risk_detected",
        stages,
        model: MODEL,
        prompt_version: PROMPT_VERSION,
        rules_version: RULES_VERSION,
        created_at: new Date(started).toISOString(),
        duration_ms: Date.now() - started,
        input_scope:
          "CSV headers, submitted Python text and user-declared context",
      },
    };
    for (const f of leakage) report.bucket_summary[f.macro_bucket]++;
    report.executive_summary = report.summary;
    report.narrative_report = renderNarrative(report);
    return report;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abort);
  }
}
