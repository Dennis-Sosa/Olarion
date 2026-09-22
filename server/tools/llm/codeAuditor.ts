import type { AuditFinding, AuditRequest } from "../../../src/types";
import { analyze } from "./analysis";
export interface CodeAuditResult {
  findings: AuditFinding[];
  split_method: string | null;
  detected_entity_keys: string[];
}
export async function auditPreprocessingCode(
  request: AuditRequest,
  signal?: AbortSignal,
): Promise<CodeAuditResult> {
  return {
    findings: await analyze(request, "code", signal),
    split_method: null,
    detected_entity_keys: [],
  };
}
