import type { AuditRequest, AuditFinding } from "../../../src/types";
import { featureScope, executableCode, escapeRegex } from "./context";
import { ruleFinding } from "./finding";
export function metadataCheck(request: AuditRequest): AuditFinding[] {
  const scope = featureScope(request),
    code = executableCode(request.preprocessing_code),
    findings: AuditFinding[] = [];
  const target = request.target_column;
  if (!target || !request.csv_columns.includes(target)) {
    findings.push({
      ...ruleFinding(
        "metadata-target",
        "missing_metadata",
        "Target column needs confirmation",
        target ?? "target",
        "The target is absent from the declared schema.",
        code,
        "",
        "low",
        true,
      ),
    });
  }
  for (const column of scope.columns) {
    const quoted = `["']${escapeRegex(column)}["']`,
      targetQuoted = `["']${escapeRegex(target ?? "")}["']`;
    const copy =
      target &&
      new RegExp(
        `\\b(\\w+)\\[${quoted}\\]\\s*=\\s*\\1\\[${targetQuoted}\\](?:\\.astype\\([^\\n]*\\))?\\s*$`,
        "m",
      ).exec(code);
    const direct = column === target && scope.known;
    if (direct || copy) {
      findings.push(
        ruleFinding(
          `metadata-target-copy-${column}`,
          "proxy",
          "Target or direct target copy may reach the model",
          column,
          scope.known
            ? `The selected input ${column} is the target or a direct copy of it.`
            : `${column} copies the target; confirm whether it reaches the model.`,
          code,
          copy?.[0] ?? column,
          "critical",
          !scope.known,
        ),
      );
    } else if (
      scope.known &&
      /^(label|target|outcome|y_true|y_pred|prediction|class_label)$/.test(
        column.toLowerCase(),
      )
    ) {
      findings.push(
        ruleFinding(
          `metadata-suspect-${column}`,
          "proxy",
          "Selected label-like input requires lineage review",
          column,
          "The name suggests a possible proxy but does not establish leakage (it could be a historical or out-of-fold prediction).",
          code,
          column,
          "medium",
          true,
        ),
      );
    }
    if (request.context?.feature_availability?.[column] === "after") {
      findings.push(
        ruleFinding(
          `metadata-after-${column}`,
          "temporal",
          "Input declared unavailable at prediction time",
          column,
          `User-provided availability for ${column} is after the prediction boundary. ${scope.known ? "It is selected as an input." : "Feature use is unresolved."}`,
          code,
          column,
          "high",
          !scope.known,
        ),
      );
    }
  }
  return findings;
}
