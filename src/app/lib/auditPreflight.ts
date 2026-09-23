import type { AuditRequest } from "../../types";
import { knownColumns } from "../../lib/featureCatalog";
import { AUDIT_LIMITS } from "../../auditLimits";

export function auditPreflight(request: AuditRequest): string[] {
  const errors: string[] = [];
  if (!request.prediction_goal.trim())
    errors.push("Describe your prediction task.");
  if (request.prediction_goal.length > AUDIT_LIMITS.goal)
    errors.push("Keep the task description within 12,000 characters.");
  if (
    !request.target_column ||
    !request.csv_columns.includes(request.target_column)
  )
    errors.push("The target column must match a CSV header exactly.");
  if (!request.preprocessing_code.trim())
    errors.push(
      "Add the preprocessing code, including feature creation and data splitting.",
    );
  if (
    request.preprocessing_code.length > AUDIT_LIMITS.code ||
    (request.model_training_code?.length ?? 0) > AUDIT_LIMITS.code
  )
    errors.push(
      "Each code input must be at most 60,000 characters. Keep all steps relevant to this audit; pasted code is not truncated.",
    );
  if (
    (request.context?.prediction_time?.length ?? 0) >
    AUDIT_LIMITS.predictionTime
  )
    errors.push("Keep the prediction time within 2,000 characters.");
  const context = request.context;
  const declared = [
    ...(context?.used_features ?? []),
    ...Object.keys(context?.feature_availability ?? {}),
    ...(context?.entity_column ? [context.entity_column] : []),
  ];
  const unknown = [
    ...new Set(
      declared.filter(
        (c) =>
          !(
            c === context?.entity_column
              ? request.csv_columns
              : knownColumns(request)
          ).includes(c),
      ),
    ),
  ];
  if (unknown.length)
    errors.push(
      `These context fields are not recognized: ${unknown.join(", ")}. Describe derived fields and include their assignments in the code. Feature lists accept CSV columns and recognized df['name'] assignments; entity IDs must be in the CSV.`,
    );
  if ((context?.used_features?.length ?? 0) > AUDIT_LIMITS.columns)
    errors.push("Use at most 300 feature names.");
  return errors;
}
