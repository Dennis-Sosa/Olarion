import type { AuditRequest } from "../../../src/types";
import { analyze } from "./analysis";
export const auditModelTrainingCode = (
  request: AuditRequest,
  signal?: AbortSignal,
) => analyze(request, "model", signal);
