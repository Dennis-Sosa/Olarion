import type { AuditRequest } from "../../../src/types.js";
import { analyze } from "./analysis.js";
export const detectTemporalLeakage = (
  request: AuditRequest,
  signal?: AbortSignal,
  repair?: string,
) => analyze(request, "temporal", signal, repair);
