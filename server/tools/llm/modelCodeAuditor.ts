import type { AuditRequest } from "../../../src/types.js";
import { analyze } from "./analysis.js";
export const auditModelTrainingCode = (
  request: AuditRequest,
  signal?: AbortSignal,
) => analyze(request, "model", signal);
