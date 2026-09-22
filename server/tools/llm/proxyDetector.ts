import type { AuditRequest } from "../../../src/types";
import { analyze } from "./analysis";
export const detectProxyLeakage = (
  request: AuditRequest,
  signal?: AbortSignal,
) => analyze(request, "proxy", signal);
