import type { AuditFinding, AuditRequest } from "../../../src/types.js";
import { callOpenAIJson } from "../../openaiClient.js";
import { applyReview } from "./analysis.js";
import { featureScope } from "../rules/context.js";
export async function reviewAgent(
  request: AuditRequest,
  findings: AuditFinding[],
  signal?: AbortSignal,
) {
  const result = await callOpenAIJson(
    `Review each initial finding against the supplied evidence and actual selected inputs. Challenge false positives. Explicitly keep, update impact/confidence, or retract each finding exactly once. Retract excluded columns, stateless Normalizer fitting, and claims of repeated entities contradicted by unique-row context. Do not infer safety from missing evidence: keep uncertain concerns at low confidence and request context. You cannot inspect rows. Return JSON {"decisions":[{"finding_id":string,"action":"keep"|"update"|"retract","reason":string,"source":"prediction_goal"|"preprocessing_code"|"model_training_code","quote":string,"severity":"low"|"medium"|"high"|"critical","confidence":"low"|"medium"|"high"}]}. Include severity and confidence for update. Every decision needs an exact source quote of at least 8 characters. Do not add IDs or silently omit findings. If findings is empty return decisions: [].`,
    JSON.stringify({
      input: request,
      feature_scope: featureScope(request),
      findings,
    }),
    signal,
  );
  return applyReview(findings, result.decisions, request);
}
