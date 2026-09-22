import type { AuditRequest } from "../../../src/types.js";
import { analyze } from "./analysis.js";
export const detectTemporalLeakage = (
  request: AuditRequest,
  signal?: AbortSignal,
) => analyze(request, "temporal", signal);
