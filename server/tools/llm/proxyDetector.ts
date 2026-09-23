import type { AuditRequest } from "../../../src/types.js";
import { analyze } from "./analysis.js";
export const detectProxyLeakage = (
  request: AuditRequest,
  signal?: AbortSignal,
  repair?: string,
) => analyze(request, "proxy", signal, repair);
