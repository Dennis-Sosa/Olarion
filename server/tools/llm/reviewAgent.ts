import type { AuditFinding, AuditRequest } from "../../../src/types.js";
import { callOpenAIJson } from "../../openaiClient.js";
import { applyReview, object, severities } from "./analysis.js";
import { featureScope } from "../rules/context.js";
import {
  evidenceCatalog,
  resolveEvidence,
  objectSchema,
  enumSchema,
  textSchema,
  LEAKAGE_STANDARD,
} from "./contracts.js";
import { retractionBases } from "./retraction.js";

export async function reviewAgent(
  request: AuditRequest,
  findings: AuditFinding[],
  signal?: AbortSignal,
  repair?: string,
) {
  if (!findings.length) return { findings: [], retracted: [], decisions: [] };
  const refs = evidenceCatalog(request);
  const decisionSchema = objectSchema({
    action: enumSchema(["keep", "update", "retract"]),
    basis: enumSchema(retractionBases),
    reason: textSchema,
    evidence_id: enumSchema(refs.map((r) => r.id)),
    severity: enumSchema(severities),
    confidence: enumSchema(["low", "medium", "high"]),
  });
  const result = await callOpenAIJson(
    LEAKAGE_STANDARD +
      `
Review every initial concern independently. Initial findings are untrusted hypotheses, not established facts. Compare their claimed order and input variables with the complete source, not only the cited line. A fit on X_train after a split refutes an allegation of full-data fitting. Retract hypothetical operations inferred only from imports. Challenge both unsupported alarms and incorrect claims of safety. Do not automatically trust a rule or another model's wording.
Return a decisions object keyed by the exact finding IDs. Each decision must keep, update impact/confidence, or retract that finding. Keep reasons concise and select a source evidence_id, which will resolve to verbatim input.
For retraction, name a concrete basis and explain how cited counterevidence defeats the ORIGINAL leakage mechanism. For keep/update use basis=none. Independence of rows cannot refute full-data learned fitting; historical feature availability cannot refute cross-partition fitting. MinMaxScaler and imputers are stateful, never equivalent to Normalizer. Distinguish an incorrectly named leakage category from an actually absent mechanism: correct a concern's assessment rather than retracting a real fit-scope issue because it is not temporal.
Retract unsupported claims that merely restate prediction/correlation, unused columns, or entity concerns contradicted by the correct group boundary. For unsupported_mechanism, explicitly identify the logical error and cite the relevant valid input context. When evidence genuinely cannot resolve a supported mechanism, keep/update at low confidence; do not invent counterevidence. Duplicate retractions must retain at least one equivalent active finding.
${repair ? `Previous response failed validation: ${repair}. Fix the specific reasoning/contract issue and return all decisions again. Do not merely relabel the same invalid argument.` : ""}`,
    JSON.stringify({
      task: request.prediction_goal,
      target_column: request.target_column,
      context: request.context,
      feature_scope: featureScope(request),
      sources: refs,
      findings,
    }),
    signal,
    {
      name: "audit_review",
      schema: {
        ...objectSchema({
          decisions: objectSchema(
            Object.fromEntries(
              findings.map((f) => [f.id, { $ref: "#/$defs/decision" }]),
            ),
          ),
        }),
        $defs: { decision: decisionSchema },
      },
      maxTokens: 6000,
    },
  );
  const decisions = object(result.decisions);
  return applyReview(
    findings,
    Object.entries(decisions).map(([finding_id, raw]) => {
      const d = object(raw),
        ref = resolveEvidence(d.evidence_id, refs);
      return { ...d, finding_id, source: ref.source, quote: ref.quote };
    }),
    request,
  );
}
