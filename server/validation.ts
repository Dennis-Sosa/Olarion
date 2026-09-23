import type { AuditRequest, AuditReport, AgentMessage } from "../src/types.js";
import { knownColumns } from "../src/lib/featureCatalog.js";
import { AUDIT_LIMITS } from "../src/auditLimits.js";
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function text(v: unknown, max: number, empty = false): v is string {
  return typeof v === "string" && v.length <= max && (empty || !!v.trim());
}
export function validateRequest(v: unknown): v is AuditRequest {
  if (
    !record(v) ||
    !text(v.prediction_goal, AUDIT_LIMITS.goal) ||
    !text(v.preprocessing_code, AUDIT_LIMITS.code) ||
    !Array.isArray(v.csv_columns) ||
    !v.csv_columns.length ||
    v.csv_columns.length > AUDIT_LIMITS.columns ||
    !v.csv_columns.every((c) => text(c, AUDIT_LIMITS.columnName)) ||
    new Set(v.csv_columns).size !== v.csv_columns.length ||
    !text(v.target_column, AUDIT_LIMITS.columnName) ||
    !v.csv_columns.includes(v.target_column) ||
    (v.model_training_code !== undefined &&
      !text(v.model_training_code, AUDIT_LIMITS.code, true))
  )
    return false;
  const columns = knownColumns(v as unknown as AuditRequest);
  if (v.context === undefined) return true;
  const c = v.context;
  if (!record(c)) return false;
  if (
    c.prediction_time !== undefined &&
    !text(c.prediction_time, AUDIT_LIMITS.predictionTime, true)
  )
    return false;
  if (
    c.used_features !== undefined &&
    (!Array.isArray(c.used_features) ||
      !c.used_features.length ||
      c.used_features.length > AUDIT_LIMITS.columns ||
      !c.used_features.every(
        (f) => typeof f === "string" && columns.includes(f),
      ))
  )
    return false;
  if (
    c.entity_column !== undefined &&
    (typeof c.entity_column !== "string" ||
      !v.csv_columns.includes(c.entity_column))
  )
    return false;
  if (
    c.entity_repetition !== undefined &&
    !["unknown", "unique", "repeated"].includes(String(c.entity_repetition))
  )
    return false;
  if (
    c.feature_availability !== undefined &&
    (!record(c.feature_availability) ||
      !Object.entries(c.feature_availability).every(
        ([key, val]) =>
          columns.includes(key) &&
          ["before", "after", "unknown"].includes(String(val)),
      ))
  )
    return false;
  return true;
}
export function validateChat(v: unknown): v is {
  request: AuditRequest;
  report: AuditReport;
  question: string;
  history?: AgentMessage[];
} {
  if (
    !record(v) ||
    !validateRequest(v.request) ||
    !text(v.question, 4000) ||
    !record(v.report) ||
    !Array.isArray(v.report.findings) ||
    JSON.stringify(v.report).length > 180000
  )
    return false;
  return (
    v.history === undefined ||
    (Array.isArray(v.history) &&
      v.history.length <= 20 &&
      v.history.every(
        (h) =>
          record(h) &&
          ["user", "assistant"].includes(String(h.role)) &&
          text(h.content, 6000),
      ))
  );
}
