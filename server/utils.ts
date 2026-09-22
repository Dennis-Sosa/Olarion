import { AuditFinding, Severity } from "../src/types";

const severityRank: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function dedupeFindings(findings: AuditFinding[]): AuditFinding[] {
  const byId = new Map<string, AuditFinding>();
  for (const f of findings) {
    const existing = byId.get(f.id);
    if (
      !existing ||
      (severityRank[f.severity] ?? 0) > (severityRank[existing.severity] ?? 0)
    ) {
      byId.set(f.id, f);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0),
  );
}

export function findLineNumber(code: string, snippet: string): number | null {
  if (!snippet || !code) return null;
  const needle = snippet.trim();
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(needle) || lines[i].trim() === needle) return i + 1;
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(needle.toLowerCase())) return i + 1;
  }
  return null;
}

export function extractSnippet(
  code: string,
  keyword: string,
  contextLines = 2,
): string {
  const lines = code.split("\n");
  const idx = lines.findIndex((l) =>
    l.toLowerCase().includes(keyword.toLowerCase()),
  );
  if (idx === -1) return keyword;
  const start = Math.max(0, idx - contextLines);
  const end = Math.min(lines.length, idx + contextLines + 1);
  return lines
    .slice(start, end)
    .map((l, i) => `${start + i + 1} | ${l}`)
    .join("\n");
}

export function resolveLineLocation(
  code: string,
  filename: string,
  keyword: string,
): string {
  const line = findLineNumber(code, keyword);
  if (line)
    return `${filename} line ${line}: ${code.split("\n")[line - 1]?.trim() ?? keyword}`;
  return `${filename}: ${keyword}`;
}

export function validateFeatureNames(
  flagged: string[],
  validColumns: string[],
): { valid: string[]; hallucinated: string[] } {
  const valid: string[] = [];
  const hallucinated: string[] = [];
  for (const name of flagged) {
    if (validColumns.includes(name)) {
      valid.push(name);
    } else {
      hallucinated.push(name);
    }
  }
  if (hallucinated.length > 0) {
    console.warn(
      `[validateFeatureNames] Discarded hallucinated columns: ${hallucinated.join(", ")}`,
    );
  }
  return { valid, hallucinated };
}

export function computeOverallRisk(findings: AuditFinding[]): Severity {
  if (findings.some((f) => f.severity === "critical")) return "critical";
  if (findings.some((f) => f.severity === "high")) return "high";
  if (findings.filter((f) => f.severity === "medium").length >= 1)
    return "medium";
  return "low";
}
