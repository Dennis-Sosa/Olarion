import type {
  AuditFinding,
  AuditRequest,
  ReviewDecision,
} from "../../../src/types.js";
import { callOpenAIJson, ModelFailure } from "../../openaiClient.js";
import { featureScope } from "../rules/context.js";
export const severities = ["low", "medium", "high", "critical"];
const confidences = ["low", "medium", "high"];
const types = [
  "temporal",
  "proxy",
  "evaluation",
  "boundary",
  "join_entity",
  "duplicate",
  "aggregation_lookahead",
  "label_definition",
  "missing_metadata",
];
export const sources = [
  "prediction_goal",
  "preprocessing_code",
  "model_training_code",
] as const;
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ModelFailure("invalid_schema");
  return value as Record<string, unknown>;
}
export function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
export function evidenceValid(
  item: Record<string, unknown>,
  request: AuditRequest,
): boolean {
  return (
    sources.includes(item.source as (typeof sources)[number]) &&
    nonempty(item.quote) &&
    item.quote.trim().length >= 8 &&
    !!request[item.source as (typeof sources)[number]]?.includes(item.quote)
  );
}
export const INPUT_SCHEMA = `Return JSON {"findings": [{"title": string, "feature": string, "type": "temporal"|"proxy"|"evaluation"|"boundary"|"join_entity"|"duplicate"|"aggregation_lookahead"|"label_definition"|"missing_metadata", "severity": "low"|"medium"|"high"|"critical", "confidence": "low"|"medium"|"high", "reason": string, "fix": string, "source": "prediction_goal"|"preprocessing_code"|"model_training_code", "quote": string}]}. Use an empty findings array when there is no supported concern. The quote MUST be an exact, nonempty substring (at least 8 characters) from the specified input source. Quotes cannot be invented; no row numbers or correlations. Feature must be a supplied column, or "pipeline" for a code issue. Limit to 8 findings. Uncertain concerns need low confidence, not fabricated evidence.`;
export async function analyze(
  request: AuditRequest,
  focus: "proxy" | "temporal" | "code" | "model",
  signal?: AbortSignal,
): Promise<AuditFinding[]> {
  const instructions = {
    proxy:
      "Inspect target proxies among actual model inputs. Historical outcomes and out-of-fold predictions can be valid. A feature excluded from X is not a leak.",
    temporal:
      "Inspect feature availability at prediction time. Post-outcome inputs and forward-looking windows can leak. Prior-only windows are valid; do not flag an unused future column.",
    code: "Inspect learned preprocessing fit scope, target aggregates, split boundaries and repeated entities. Normalizer and encoding class names of y alone are not distribution leakage. Mere column-name suspicion is insufficient. Inspect code and declared context together.",
    model:
      "Inspect the training code for selection/tuning on held-out test data, target leakage and evaluation boundary misuse.",
  };
  const scope = featureScope(request);
  const result = await callOpenAIJson(
    instructions[focus] + "\n" + INPUT_SCHEMA,
    JSON.stringify({ input: request, feature_scope: scope }),
    signal,
  );
  if (!Array.isArray(result.findings) || result.findings.length > 8)
    throw new ModelFailure("invalid_schema");
  return result.findings.map((raw, index) => {
    const item = object(raw);
    if (
      ![item.title, item.reason, item.feature, item.fix].every(nonempty) ||
      !types.includes(String(item.type)) ||
      !severities.includes(String(item.severity)) ||
      !confidences.includes(String(item.confidence)) ||
      !evidenceValid(item, request)
    )
      throw new ModelFailure("invalid_evidence_or_schema");
    const feature = String(item.feature);
    if (feature !== "pipeline" && !request.csv_columns.includes(feature))
      throw new ModelFailure("unknown_feature");
    if (
      (focus === "proxy" || focus === "temporal") &&
      (feature === "pipeline" ||
        (scope.known && !scope.columns.includes(feature)))
    )
      throw new ModelFailure("unused_or_unknown_feature");
    const type = item.type as AuditFinding["fine_grained_type"];
    const source = item.source as (typeof sources)[number];
    const text = request[source] ?? "",
      at = text.indexOf(String(item.quote));
    return {
      id: `${focus}-${index}`,
      title: String(item.title),
      flagged_object: feature,
      macro_bucket:
        type === "temporal"
          ? "Time leakage"
          : type === "proxy"
            ? "Feature / proxy leakage"
            : "Structure / pipeline leakage",
      fine_grained_type: type,
      severity: item.severity as AuditFinding["severity"],
      confidence: item.confidence as AuditFinding["confidence"],
      severity_rationale:
        "Potential impact of the described mechanism; confidence is reported separately.",
      evidence: [
        {
          claim: String(item.reason),
          source: {
            filename: source.endsWith("code")
              ? source + ".py"
              : "task description",
            location: `line ${text.slice(0, at).split("\n").length}`,
            snippet: String(item.quote),
          },
        },
      ],
      why_it_matters: String(item.reason),
      fix_recommendation: [String(item.fix)],
      needs_human_review: true,
    } as AuditFinding;
  });
}
export function applyReview(
  findings: AuditFinding[],
  raw: unknown,
  request: AuditRequest,
): {
  findings: AuditFinding[];
  retracted: AuditFinding[];
  decisions: ReviewDecision[];
} {
  if (!Array.isArray(raw) || raw.length !== findings.length)
    throw new ModelFailure("incomplete_review");
  const seen = new Set<string>();
  const decisions = raw.map((value) => {
    const d = object(value),
      id = String(d.finding_id);
    if (
      seen.has(id) ||
      !findings.some((f) => f.id === id) ||
      !["keep", "update", "retract"].includes(String(d.action)) ||
      !nonempty(d.reason) ||
      !evidenceValid(d, request)
    )
      throw new ModelFailure("invalid_review_evidence");
    if (
      d.action === "update" &&
      (!severities.includes(String(d.severity)) ||
        !confidences.includes(String(d.confidence)))
    )
      throw new ModelFailure("invalid_review_update");
    seen.add(id);
    return d as unknown as ReviewDecision;
  });
  // Validate the entire transaction before applying any retractions.
  const active: AuditFinding[] = [],
    retracted: AuditFinding[] = [];
  for (const f of findings) {
    const d = decisions.find((d) => d.finding_id === f.id)!;
    if (d.action === "retract") retracted.push(f);
    else
      active.push(
        d.action === "update"
          ? {
              ...f,
              severity: d.severity!,
              confidence: d.confidence!,
              needs_human_review: true,
            }
          : f,
      );
  }
  return { findings: active, retracted, decisions };
}
