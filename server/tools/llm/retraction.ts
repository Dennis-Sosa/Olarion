import type { AuditFinding, AuditRequest } from "../../../src/types.js";
import { ModelFailure } from "../../openaiClient.js";
import { executableCode, escapeRegex } from "../rules/context.js";

export const retractionBases = [
  "none",
  "not_used",
  "available_before_prediction",
  "train_only_fit",
  "stateless_transform",
  "valid_entity_boundary",
  "valid_oof_encoding",
  "unsupported_mechanism",
  "duplicate",
] as const;

/** Narrow semantic guards, not an assertion that all other decisions are correct. */
export function validateRetraction(
  finding: AuditFinding,
  decision: Record<string, unknown>,
  request: AuditRequest,
) {
  if (
    !retractionBases.includes(
      decision.basis as (typeof retractionBases)[number],
    ) ||
    decision.basis === "none"
  )
    throw new ModelFailure("invalid_retraction_basis");
  const preprocessingRisk =
    finding.id.startsWith("pipeline-global-") ||
    finding.id === "pipeline-leaky-fillna" ||
    /fit|scal|imput/i.test(finding.title + " " + finding.why_it_matters);
  if (
    preprocessingRisk &&
    ["available_before_prediction", "valid_entity_boundary"].includes(
      String(decision.basis),
    )
  )
    throw new ModelFailure("retraction_does_not_address_fit_scope");
  if (decision.basis !== "stateless_transform") return;
  const code = executableCode(
    request.preprocessing_code + "\n" + (request.model_training_code ?? ""),
  );
  const snippets = finding.evidence
    .map((e) => e.source?.snippet ?? "")
    .join("\n");
  const stateful =
    /\b(?:StandardScaler|MinMaxScaler|RobustScaler|MaxAbsScaler|SimpleImputer|KNNImputer|IterativeImputer|PCA|OneHotEncoder|TargetEncoder|QuantileTransformer|PowerTransformer)\s*\(/;
  const receivers = [
    ...snippets.matchAll(/\b(\w+)\.(?:fit|fit_transform)\s*\(/g),
  ].map((m) => m[1]);
  const declarations = receivers
    .flatMap((receiver) =>
      [
        ...code.matchAll(
          new RegExp(`\\b${escapeRegex(receiver)}\\s*=\\s*([^\\n]+)`, "g"),
        ),
      ].map((m) => m[1]),
    )
    .join("\n");
  if (
    stateful.test(snippets + "\n" + declarations) ||
    /\.(?:mean|median)\s*\(/.test(snippets)
  )
    throw new ModelFailure("stateful_transform_is_not_stateless");
  if (
    !/\bNormalizer\s*\(|\bnormalize\s*\(/.test(snippets + "\n" + declarations)
  )
    throw new ModelFailure("stateless_retraction_needs_evidence");
}
