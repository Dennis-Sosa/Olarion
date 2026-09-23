import type { AuditRequest } from "../../../src/types.js";
import { ModelFailure } from "../../openaiClient.js";

export const sources = [
  "prediction_goal",
  "preprocessing_code",
  "model_training_code",
] as const;
export interface EvidenceRef {
  id: string;
  source: (typeof sources)[number];
  quote: string;
}
export const enumSchema = (values: readonly string[]) => ({
  type: "string",
  enum: values,
});
export const textSchema = { type: "string" };
export const objectSchema = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/** Bounded number of contiguous source spans; never invent quotes or omit the tail. */
export function evidenceCatalog(request: AuditRequest): EvidenceRef[] {
  const refs: EvidenceRef[] = [];
  for (const source of sources) {
    const text = request[source] ?? "";
    const lines = text.split("\n");
    const size = Math.max(1, Math.ceil(lines.length / 120));
    for (let at = 0; at < lines.length; at += size) {
      let quote = lines.slice(at, at + size).join("\n");
      if (quote.trim().length < 8) {
        // Include an adjacent line so short code statements can still be cited.
        quote = lines
          .slice(Math.max(0, at - 1), Math.min(lines.length, at + size + 1))
          .join("\n");
      }
      if (quote.trim().length >= 8 && text.includes(quote))
        refs.push({ id: `${source}:${at + 1}`, source, quote });
    }
  }
  return refs;
}

export function resolveEvidence(id: unknown, refs: EvidenceRef[]): EvidenceRef {
  const ref = refs.find((r) => r.id === id);
  if (!ref) throw new ModelFailure("invalid_evidence_reference");
  return ref;
}

export const LEAKAGE_STANDARD = `A finding needs a concrete forbidden information path into model inputs, learned preprocessing, selection or evaluation. Explain what unavailable/held-out information crosses which boundary and where it is used.
Predictiveness, correlation, a suggestive name, or generic "may inflate performance" is NOT such a mechanism. Numeric historical measurements available at prediction time are ordinary valid inputs. Do not flag them simply because they predict the outcome. A raw future column excluded from the model is not a leak.
Distinguish stateful fitting (StandardScaler, MinMaxScaler, SimpleImputer, PCA, learned encoders) from per-row stateless Normalizer. Fitting stateful transforms on the full dataset before splitting is evaluation leakage even if rows are independent and no labels are used. The correct fix is fit on training data only and apply that SAME fitted transform to holdout, not fit separately on test.
Target encoding requires training-row out-of-fold encodings (or a separate fitting partition) plus train-only maps for validation/test. A train-only map applied back to those same training rows can self-leak; valid out-of-fold training plus train-only test mapping is not leakage.
Entity overlap is a concern when repeated entities cross a boundary intended to represent unseen entities. GroupKFold/GroupShuffleSplit using the correct entity groups addresses that boundary. Unique row IDs alone do not prove repeated entities. Returning-entity forecasting may require time separation rather than holding out entities.
Judge operations that are actually shown. Imports, constructor names, unused helpers, and hypothetical omitted operations are not evidence that a transform was executed. Missing code can limit scope, but never invent a fit call.
Concrete boundary examples: X_train, X_test = train_test_split(X); scaler.fit(X_train); scaler.transform(X_test) uses a training-only fit and is valid. scaler.fit(X); train_test_split(X) lets holdout influence learned parameters and is a concern. Read the actual order and input variables; do not reverse these two situations. A cited fit(X_train) AFTER the split refutes an allegation that that call fitted the full dataset unless actual code shows X_train was reassigned to include holdout.
Use all supplied code and task context. Raw names and recognized assignments are not proof of use or of safety. Trace derived features to their sources. Unsupported risks belong in questions, not invented findings. Do not assert that missing evidence proves safety.`;
