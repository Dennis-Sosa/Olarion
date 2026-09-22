export function parseCsvHeader(text: string): string[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < firstLine.length; index += 1) {
    const character = firstLine[index];

    if (character === '"') {
      const nextCharacter = firstLine[index + 1];
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  if (current.length > 0 || firstLine.endsWith(",")) {
    values.push(current.trim());
  }

  return values.filter(Boolean);
}

export async function extractCsvColumns(file: File): Promise<string[]> {
  // Read a bounded prefix; no dataset rows are sent to the API.
  const text = await file.slice(0, 65536).text();
  if (!text.includes("\n") && file.size > 65536)
    throw new Error("CSV header exceeds 64 KB.");
  const columns = parseCsvHeader(text.replace(/^\uFEFF/, ""));
  if (!columns.length || new Set(columns).size !== columns.length)
    throw new Error("CSV headers must be nonempty and unique.");
  return columns;
}
