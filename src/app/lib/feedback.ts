import type { AuditReport, AuditRequest, FindingFeedback } from "../../types";
const KEY = "olarion.finding-feedback.v1";
export function reportKey(report: AuditReport): string {
  if (report.quality?.created_at) return report.quality.created_at;
  let hash = 2166136261;
  for (const char of JSON.stringify([report.summary, report.findings]))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `legacy-${hash >>> 0}`;
}
export function readFeedback(report: AuditReport): FindingFeedback[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}")[
      reportKey(report)
    ];
    if (!Array.isArray(values)) return [];
    return values.filter(
      (v) =>
        v &&
        typeof v.finding_id === "string" &&
        ["confirmed", "false_positive", "needs_context"].includes(v.verdict) &&
        typeof v.note === "string" &&
        typeof v.updated_at === "string",
    );
  } catch {
    return [];
  }
}
export function saveFeedback(
  report: AuditReport,
  feedback: FindingFeedback,
): FindingFeedback[] {
  const all = readFeedback(report).filter(
    (f) => f.finding_id !== feedback.finding_id,
  );
  all.push(feedback);
  let store: Record<string, FindingFeedback[]> = {};
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) store = raw;
  } catch {
    /* replace corrupted feedback */
  }
  store[reportKey(report)] = all;
  const keys = Object.keys(store);
  for (const key of keys.slice(0, Math.max(0, keys.length - 12)))
    delete store[key];
  localStorage.setItem(KEY, JSON.stringify(store)); // Caller displays quota/private-mode errors.
  return all;
}
export function regressionCandidate(
  request: AuditRequest,
  report: AuditReport,
  feedback: FindingFeedback[],
) {
  return {
    schema_version: 1,
    status: "requires_human_label_review",
    exported_at: new Date().toISOString(),
    source: {
      model: report.quality?.model ?? "unknown",
      prompt_version: report.quality?.prompt_version ?? "legacy",
      rules_version: report.quality?.rules_version ?? "legacy",
    },
    request,
    report,
    feedback,
    expected_leakage: null,
    note: "Feedback is a candidate label, not ground truth. Review evidence, remove sensitive content and assign case-level labels before adding to regression tests. No automatic retraining occurs.",
  };
}
