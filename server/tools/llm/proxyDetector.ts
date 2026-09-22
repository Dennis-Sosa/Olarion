import type { AuditRequest } from "../../../src/types.js";
import { analyze } from "./analysis.js";
export const detectProxyLeakage = (
  request: AuditRequest,
  signal?: AbortSignal,
) => analyze(request, "proxy", signal);
