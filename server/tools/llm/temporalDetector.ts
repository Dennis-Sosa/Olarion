import type { AuditRequest } from "../../../src/types";
import { analyze } from "./analysis";
export const detectTemporalLeakage = (
  request: AuditRequest,
  signal?: AbortSignal,
) => analyze(request, "temporal", signal);
