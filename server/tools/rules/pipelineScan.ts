import type { AuditRequest, AuditFinding } from "../../../src/types";
import { executableCode } from "./context";
import { ruleFinding } from "./finding";
export function pipelineScan(request: AuditRequest): AuditFinding[] {
  const code = executableCode(request.preprocessing_code),
    findings: AuditFinding[] = [];
  const split =
    /\btrain_test_split\s*\(|\b(?:GroupKFold|GroupShuffleSplit|TimeSeriesSplit|StratifiedKFold|KFold)\s*\(|\.split\s*\(/.exec(
      code,
    );
  if (!split) return findings;
  const head = code.slice(0, split.index);
  const stateless = new Set(
    [...head.matchAll(/\b(\w+)\s*=\s*Normalizer\s*\(/g)].map((m) => m[1]),
  );
  for (const match of head.matchAll(
    /(?:\b(\w+)|\b(\w+)\([^\n]*?\))\.fit(?:_transform)?\s*\(([^\n]*)/g,
  )) {
    const receiver = match[1] ?? match[2];
    if (receiver === "Normalizer" || stateless.has(receiver)) continue;
    if (/\b(?:X_train|train_X|train_df)\b/.test(match[3])) continue;
    // Encoding y class names alone is not target-mean encoding of X.
    if (
      /^\s*y\b/.test(match[3]) &&
      (receiver === "LabelEncoder" ||
        new RegExp(`\\b${receiver}\\s*=\\s*LabelEncoder\\(`).test(head))
    )
      continue;
    findings.push(
      ruleFinding(
        "pipeline-global-preprocessing",
        "evaluation",
        "A learned transform may see holdout rows",
        receiver,
        "A fit call appears before the first split. Verify that its input contains training rows only; static order alone cannot prove data flow.",
        code,
        match[0],
        "medium",
        true,
      ),
    );
    break;
  }
  const fill = /[^\n]*\.fillna\s*\([^\n]*\.(?:mean|median)\s*\([^\n]*/.exec(
    head,
  );
  if (fill)
    findings.push(
      ruleFinding(
        "pipeline-leaky-fillna",
        "evaluation",
        "Imputation statistics computed before splitting",
        "imputation",
        "Mean or median is computed before the split; holdout rows may contribute.",
        code,
        fill[0],
      ),
    );
  const agg =
    /[^\n]*\.groupby\s*\([^\n]*\.transform\s*\(\s*['"](?:mean|sum|count)['"][^\n]*/.exec(
      head,
    );
  if (agg)
    findings.push(
      ruleFinding(
        "pipeline-lookahead-groupby-mean",
        "aggregation_lookahead",
        "Full-data aggregate before splitting",
        "group aggregate",
        "An aggregate is computed before splitting. Check target dependencies and time windows; held-out rows may affect the feature.",
        code,
        agg[0],
      ),
    );
  const tail = code.slice(split.index);
  const dup = /[^\n]*\.drop_duplicates\s*\([^\n]*/.exec(tail);
  if (dup)
    findings.push(
      ruleFinding(
        "pipeline-drop-duplicates-after-split",
        "duplicate",
        "Duplicate handling follows the split",
        "duplicates",
        "Duplicate removal after splitting can leave matching rows across partitions. Actual overlap is unverified.",
        code,
        dup[0],
        "medium",
        true,
      ),
    );
  return findings;
}
