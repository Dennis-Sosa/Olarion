import type { AuditFinding } from "../../../src/types";
export function ruleFinding(
  id: string,
  type: AuditFinding["fine_grained_type"],
  title: string,
  object: string,
  claim: string,
  code: string,
  keyword: string,
  severity: AuditFinding["severity"] = "high",
  uncertain = false,
): AuditFinding {
  const line = code.split("\n").findIndex((l) => l.includes(keyword));
  return {
    id,
    title,
    macro_bucket:
      type === "temporal"
        ? "Time leakage"
        : type === "proxy"
          ? "Feature / proxy leakage"
          : "Structure / pipeline leakage",
    fine_grained_type: type,
    severity,
    confidence: uncertain ? "low" : "medium",
    flagged_object: object,
    evidence: [
      {
        claim,
        source: {
          filename: "preprocessing_code.py",
          location: line >= 0 ? `line ${line + 1}` : "static analysis",
          snippet: line >= 0 ? code.split("\n")[line].trim() : undefined,
        },
      },
    ],
    rule_cited: id,
    why_it_matters: claim,
    severity_rationale:
      "Severity estimates potential evaluation impact; confidence reflects available evidence.",
    fix_recommendation: [
      type === "join_entity"
        ? "Verify entity overlap; use a group split when evaluating unseen entities."
        : type === "proxy" || type === "temporal"
          ? "Keep only inputs available at prediction time; verify the feature lineage."
          : "Fit learned transforms and aggregates inside training folds; apply the fitted mapping to holdout data.",
    ],
    needs_human_review: true,
  };
}
