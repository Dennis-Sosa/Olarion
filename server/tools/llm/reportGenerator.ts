import type { AuditReport } from "../../../src/types.js";
/** Render only validated structured facts; no additional model claims. */
export function renderNarrative(report: AuditReport): string {
  const q = report.quality;
  return [
    "# Olarion audit",
    report.summary,
    q?.status === "degraded"
      ? "**Incomplete coverage. Failed checks are not evidence that the pipeline is safe.**"
      : "All configured checks returned validated responses. This is not a guarantee of no leakage.",
    "## Findings",
    ...report.findings.map(
      (f) =>
        `### ${f.title}\nSeverity: ${f.severity}; confidence: ${f.confidence}.\n${f.why_it_matters}\n${f.fix_recommendation.map((x) => `- ${x}`).join("\n")}`,
    ),
    "## Context to verify",
    ...report.clarifying_questions.map((x) => `- ${x}`),
    "## Review decisions",
    ...(report.review_decisions ?? []).map(
      (d) =>
        `- ${d.finding_id}: ${d.action}. ${d.reason} Evidence: ${d.source}: ${d.quote}`,
    ),
    "## Coverage",
    ...(q?.stages ?? []).map(
      (s) =>
        `- ${s.id}: ${s.status}${s.error_code ? ` (${s.error_code})` : ""}`,
    ),
    `Scope: ${q?.input_scope ?? "legacy report"}. No Python execution, model training, row-level statistics or measured business impact.`,
  ].join("\n\n");
}
