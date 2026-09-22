import type { AuditRequest, AuditFinding } from "../../../src/types.js";
import type { CodeAuditResult } from "../llm/codeAuditor.js";
import { executableCode, entityState } from "./context.js";
import { ruleFinding } from "./finding.js";
export function structuralCheck(
  request: AuditRequest,
  _codeResult: CodeAuditResult | null,
): AuditFinding[] {
  const code = executableCode(request.preprocessing_code),
    state = entityState(request);
  const random = /\btrain_test_split\s*\([\s\S]*?\)/.exec(code);
  if (!random || /shuffle\s*=\s*False/.test(random[0]) || state === "unique")
    return [];
  const ids = request.context?.entity_column
    ? [request.context.entity_column]
    : request.csv_columns.filter((c) => /(?:_id|_key)$|^id$/i.test(c));
  if (!ids.length) return [];
  return [
    ruleFinding(
      "structural-entity-leakage",
      "join_entity",
      state === "repeated"
        ? "Random split may overlap repeated entities"
        : "Entity overlap needs verification",
      ids.join(", "),
      state === "repeated"
        ? "Context declares repeated entities and code uses a row split. Verify overlap and intended generalization."
        : "An ID and a row split do not establish leakage. Confirm repeated entities and cross-partition overlap.",
      code,
      random[0].split("\n")[0],
      state === "repeated" ? "high" : "low",
      state !== "repeated",
    ),
  ];
}
