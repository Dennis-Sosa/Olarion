import type { AuditRequest } from "../types.js";

/** Lexical support only: this is not a Python interpreter or a data-flow proof. */
export function executableCode(raw: string): string {
  return raw
    .replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) =>
      line.replace(/(['"])(?:\\.|(?!\1).)*?\1|#[^\n]*/g, (token) =>
        token.startsWith("#") ? " ".repeat(token.length) : token,
      ),
    )
    .join("\n");
}

/** Names explicitly assigned by df['name'] = ... or df.assign(name=...).
 * Recognition permits a citation, not a conclusion that the field is used/safe.
 */
export function derivedColumns(
  request: Pick<
    AuditRequest,
    "preprocessing_code" | "model_training_code" | "csv_columns"
  >,
): string[] {
  const code = executableCode(
    request.preprocessing_code + "\n" + (request.model_training_code ?? ""),
  );
  const names = [
    ...code.matchAll(/^\s*\w+\s*\[\s*['"]([^'"\n]+)['"]\s*\]\s*=(?!=)/gm),
  ].map((m) => m[1]);
  for (const call of code.matchAll(/\.assign\s*\(/g)) {
    let depth = 1,
      quote = "",
      fieldStart = true;
    for (
      let i = call.index! + call[0].length;
      i < code.length && depth > 0;
      i++
    ) {
      const c = code[i];
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = "";
        continue;
      }
      if (c === "'" || c === '"') {
        quote = c;
        continue;
      }
      if (depth === 1 && fieldStart) {
        if (/\s/.test(c)) continue;
        const field = /^([A-Za-z_]\w*)\s*=(?!=)/.exec(code.slice(i));
        if (field) names.push(field[1]);
        fieldStart = false;
      }
      if ("([{ ".trim().includes(c)) depth++;
      else if (")] }".replace(" ", "").includes(c)) depth--;
      else if (c === "," && depth === 1) fieldStart = true;
    }
  }
  return [...new Set(names)]
    .filter((name) => !request.csv_columns.includes(name) && name.length <= 200)
    .slice(0, 300);
}

export function knownColumns(
  request: Pick<
    AuditRequest,
    "preprocessing_code" | "model_training_code" | "csv_columns"
  >,
): string[] {
  return [...request.csv_columns, ...derivedColumns(request)];
}
