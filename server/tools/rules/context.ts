import type { AuditRequest } from "../../../src/types.js";

export const RULES_VERSION = "2.0.0";
export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export { executableCode } from "../../../src/lib/featureCatalog.js";
import {
  executableCode,
  knownColumns,
} from "../../../src/lib/featureCatalog.js";
export function featureScope(request: AuditRequest): {
  columns: string[];
  known: boolean;
  source: string;
} {
  if (request.context?.used_features)
    return {
      columns: request.context.used_features,
      known: true,
      source: "user-declared feature list",
    };
  const code = executableCode(request.preprocessing_code);
  // Only infer a literal X selection when later X assignments/mutations cannot invalidate it.
  const matches = [
    ...code.matchAll(
      /^\s*X\s*=\s*\w+\s*\[\s*\[([^\]]+)\]\s*\](?:\.copy\(\))?\s*$/gm,
    ),
  ];
  const match = matches.at(-1);
  if (match) {
    const rest = code.slice(match.index! + match[0].length);
    if (
      !/^\s*X(?:\s*=|\s*\[|\s*\.(?:insert|update|pop|drop|assign)\s*\()/m.test(
        rest,
      )
    ) {
      const columns = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(
        (m) => m[1],
      );
      if (columns.length)
        return {
          columns,
          known: true,
          source: "literal X selection (limited static inference)",
        };
    }
  }
  return {
    columns: knownColumns(request).filter((c) => c !== request.target_column),
    known: false,
    source: "raw headers; feature use is unresolved",
  };
}
export function entityState(
  request: AuditRequest,
): "unique" | "repeated" | "unknown" {
  if (
    request.context?.entity_repetition &&
    request.context.entity_repetition !== "unknown"
  )
    return request.context.entity_repetition;
  // Goal text is a declaration, not empirical verification of rows.
  const goal = request.prediction_goal.toLowerCase();
  if (
    /(?:each|every|same)\s+\w+(?:\s+\w+){0,4}\s+(?:appears|has|occurs).{0,35}(?:multiple|repeated|several)|repeated (?:entities|observations|records|rows)|multiple (?:rows|records|observations) per/.test(
      goal,
    )
  )
    return "repeated";
  if (
    /\bunique (?:per row|for each row|row identifier)|\bone row per\b|no (?:persons\/items|entities) repeat|\bno repeated entities\b/.test(
      goal,
    )
  )
    return "unique";
  return "unknown";
}
export function missingContext(request: AuditRequest): string[] {
  const missing: string[] = [];
  if (!featureScope(request).known)
    missing.push("Confirm exactly which columns reach the model.");
  if (!request.context?.prediction_time)
    missing.push(
      "Confirm the prediction-time boundary and when each feature becomes available.",
    );
  if (entityState(request) === "unknown")
    missing.push(
      "Confirm whether entities repeat across rows and whether evaluation targets unseen entities.",
    );
  return missing;
}
