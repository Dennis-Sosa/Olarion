import { AUDIT_LIMITS } from "../../auditLimits";

export function parseCsvHeader(text: string): string[] {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/, 1)[0] ?? "";
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  let closedQuote = false;

  for (let index = 0; index < firstLine.length; index += 1) {
    const character = firstLine[index];

    if (inQuotes) {
      if (character === '"' && firstLine[index + 1] === '"') {
        current += '"';
        index++;
      } else if (character === '"') {
        inQuotes = false;
        closedQuote = true;
      } else current += character;
    } else if (character === ",") {
      values.push(current.trim());
      current = "";
      closedQuote = false;
    } else if (character === '"') {
      if (current.trim() || closedQuote)
        throw new Error(
          "CSV header has misplaced quotes. Use a single header line.",
        );
      current = "";
      inQuotes = true;
    } else if (closedQuote && character.trim()) {
      throw new Error("Use a comma after a quoted CSV column name.");
    } else if (!closedQuote) current += character;
  }

  if (inQuotes)
    throw new Error(
      "CSV header has an unclosed quote. Use a single header line.",
    );
  values.push(current.trim());
  if (values.some((v) => !v))
    throw new Error(
      "Every CSV column needs a name; remove empty header cells.",
    );
  if (new Set(values).size !== values.length)
    throw new Error("CSV column names must be unique.");
  if (values.length > AUDIT_LIMITS.columns)
    throw new Error(`Use at most ${AUDIT_LIMITS.columns} CSV columns.`);
  if (values.some((v) => v.length > AUDIT_LIMITS.columnName))
    throw new Error(
      `CSV column names must be at most ${AUDIT_LIMITS.columnName} characters.`,
    );
  return values;
}

export async function extractCsvColumns(file: File): Promise<string[]> {
  if (!file.name.toLowerCase().endsWith(".csv"))
    throw new Error(
      "Upload a .csv file saved as UTF-8 with comma-separated columns.",
    );
  // Decode only the first line; invalid or split UTF-8 row bytes do not affect it.
  // No dataset rows are sent to the API.
  const bytes = new Uint8Array(
    await file.slice(0, AUDIT_LIMITS.csvHeaderBytes + 1).arrayBuffer(),
  );
  const lineEnd = bytes.findIndex((byte) => byte === 10 || byte === 13);
  const header = lineEnd < 0 ? bytes : bytes.subarray(0, lineEnd);
  if (header.length > AUDIT_LIMITS.csvHeaderBytes)
    throw new Error("CSV header exceeds 64 KB.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(header);
  } catch {
    throw new Error("Save the CSV using UTF-8 encoding, then upload it again.");
  }
  return parseCsvHeader(text);
}
