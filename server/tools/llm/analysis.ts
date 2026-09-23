import type {
  AuditFinding,
  AuditRequest,
  ReviewDecision,
} from "../../../src/types.js";
import { callOpenAIJson, ModelFailure } from "../../openaiClient.js";
import {
  knownColumns,
  derivedColumns,
} from "../../../src/lib/featureCatalog.js";
import {
  evidenceCatalog,
  resolveEvidence,
  objectSchema,
  enumSchema,
  textSchema,
  LEAKAGE_STANDARD,
} from "./contracts.js";
import { validateRetraction } from "./retraction.js";
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
export async function analyze(
  request: AuditRequest,
  focus: "proxy" | "temporal" | "code" | "model",
  signal?: AbortSignal,
  repair?: string,
): Promise<AuditFinding[]> {
  const instructions = {
    proxy:
      "Inspect label copies and outcome-derived target proxies among actual inputs. Historical predictors are valid; correlation alone never establishes target leakage.",
    temporal:
      "Inspect information availability at the prediction boundary, forward windows and future joins. Prior-only observations available then are valid.",
    code: "Inspect preprocessing fit scope, target aggregates and encodings, split boundaries, joins and entity overlap. Trace data usage rather than just method names or textual order.",
    model:
      "Inspect training, cross-validation, model selection, threshold tuning and final evaluation. Test-set-driven hyperparameter/model selection contaminates final test evaluation; tuning on a separate validation set followed by one untouched test is valid.",
  };
  const scope = featureScope(request);
  const featureCheck = focus === "proxy" || focus === "temporal";
  const known = knownColumns(request);
  const allowedFeatures = [
    ...new Set(
      featureCheck
        ? scope.columns.filter((column) => known.includes(column))
        : [...known, "pipeline"],
    ),
  ];
  if (!allowedFeatures.length) return [];
  const refs = evidenceCatalog(request);
  if (!refs.length) throw new ModelFailure("insufficient_source_text");
  const itemSchema = objectSchema({
    title: textSchema,
    feature: enumSchema(allowedFeatures),
    type: enumSchema(types),
    mechanism: textSchema,
    used_path: textSchema,
    severity: enumSchema(severities),
    confidence: enumSchema(confidences),
    reason: textSchema,
    fix: textSchema,
    evidence_id: enumSchema(refs.map((r) => r.id)),
  });
  const boundary = featureCheck
    ? `Only report ${focus} mechanisms tied to allowed_features. Pipeline fit/split concerns are covered by the code specialist. For derived fields, inspect their definitions in source evidence.`
    : 'Use feature="pipeline" for pipeline-level concerns, or one supplied name for a column-specific concern.';
  const result = await callOpenAIJson(
    LEAKAGE_STANDARD +
      "\n" +
      instructions[focus] +
      "\n" +
      boundary +
      `
First report concise factual observations in observed_usage (actual selected inputs), observed_boundaries (actual split/fit order and availability) and counterevidence (shown safeguards). These fields describe source facts, not speculation. Then return findings=[] when this specialist has no supported risk. Limit to 8 distinct concerns. For each finding, mechanism must identify the forbidden information, and used_path must explain how it reaches the evaluated workflow. reason must justify that claim using the supplied facts, including counterevidence. Keep fields concise. Choose evidence_id from the source catalog; the server will attach that exact source text. Do not write safe-check rows or missing-metadata findings. Review unknowns without inventing a positive finding.
${repair ? `The previous attempt failed validation (${repair}). Recheck all enum values, source references, and required fields. Return the full corrected object.` : ""}`,
    JSON.stringify({
      task: request.prediction_goal,
      target_column: request.target_column,
      csv_columns: request.csv_columns,
      context: request.context,
      feature_scope: scope,
      recognized_derived_columns: derivedColumns(request),
      allowed_features: allowedFeatures,
      sources: refs,
    }),
    signal,
    {
      name: `audit_${focus}`,
      schema: objectSchema({
        observed_usage: textSchema,
        observed_boundaries: textSchema,
        counterevidence: textSchema,
        findings: { type: "array", items: itemSchema, maxItems: 8 },
      }),
      maxTokens: 2400,
    },
  );
  if (!Array.isArray(result.findings) || result.findings.length > 8)
    throw new ModelFailure("invalid_schema");
  return result.findings.map((raw, index) => {
    const item = object(raw);
    const feature = String(item.feature);
    if (!known.includes(feature) && feature !== "pipeline")
      throw new ModelFailure("unknown_feature");
    if (!allowedFeatures.includes(feature))
      throw new ModelFailure("unused_or_unknown_feature");
    if (
      ![
        item.title,
        item.reason,
        item.fix,
        item.mechanism,
        item.used_path,
      ].every(nonempty) ||
      !types.includes(String(item.type)) ||
      !severities.includes(String(item.severity)) ||
      !confidences.includes(String(item.confidence))
    )
      throw new ModelFailure("invalid_evidence_or_schema");
    const ref = resolveEvidence(item.evidence_id, refs);
    if (
      ref.source.endsWith("code") &&
      ref.quote
        .split("\n")
        .filter((l) => l.trim())
        .every((l) => /^\s*(?:from\s+\S+\s+import\b|import\s)/.test(l))
    )
      throw new ModelFailure("invalid_import_only_evidence");
    const type = item.type as AuditFinding["fine_grained_type"];
    const text = request[ref.source] ?? "";
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
        "Potential impact of the mechanism; confidence is reported separately.",
      mechanism: String(item.mechanism),
      used_path: String(item.used_path),
      evidence: [
        {
          claim: String(item.reason),
          source: {
            filename: ref.source.endsWith("code")
              ? ref.source + ".py"
              : "task description",
            location: `line ${text.slice(0, text.indexOf(ref.quote)).split("\n").length}`,
            snippet: ref.quote,
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
    if (d.action === "retract")
      validateRetraction(findings.find((f) => f.id === id)!, d, request);
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
